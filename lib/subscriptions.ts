import { env } from 'cloudflare:workers';

import { ensureDatabase } from '@/db/initialize';
import { sendSubscriptionEmail } from '@/lib/email';

export async function expirePastDueSubscriptions(): Promise<number> {
  await ensureDatabase();
  const now = new Date().toISOString();
  const expiring = await env.DB.prepare(
    `SELECT s.clinic_id AS clinicId, s.current_period_end AS periodEnd, c.name AS organizationName, u.email FROM subscriptions s JOIN clinics c ON c.id = s.clinic_id LEFT JOIN memberships m ON m.clinic_id = s.clinic_id AND m.role = 'owner' AND m.status = 'active' LEFT JOIN saas_users u ON u.id = m.user_id WHERE s.status IN ('trialing', 'active') AND s.current_period_end < ? GROUP BY s.clinic_id`,
  )
    .bind(now)
    .all<{ clinicId: string; periodEnd: string; organizationName: string; email: string | null }>();
  const result = await env.DB.prepare(
    `UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE status IN ('trialing', 'active') AND current_period_end < ?`,
  )
    .bind(now, now)
    .run();
  for (const item of expiring.results) {
    if (!item.email) continue;
    await sendSubscriptionEmail({
      recipient: item.email,
      organizationName: item.organizationName,
      subject: 'Tu suscripción venció',
      message: 'La vigencia terminó. Contacta a administración para registrar tu transferencia y reactivar el servicio.',
    });
  }
  return Number(result.meta.changes ?? 0);
}

export async function sendUpcomingSubscriptionNotices(): Promise<number> {
  await ensureDatabase();
  const now = new Date();
  const limit = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
  const rows = await env.DB.prepare(
    `SELECT s.clinic_id AS clinicId, s.current_period_end AS periodEnd, c.name AS organizationName, u.email FROM subscriptions s JOIN clinics c ON c.id = s.clinic_id LEFT JOIN memberships m ON m.clinic_id = s.clinic_id AND m.role = 'owner' AND m.status = 'active' LEFT JOIN saas_users u ON u.id = m.user_id WHERE s.status IN ('trialing', 'active') AND s.current_period_end >= ? AND s.current_period_end <= ? GROUP BY s.clinic_id`,
  )
    .bind(now.toISOString(), limit.toISOString())
    .all<{ clinicId: string; periodEnd: string; organizationName: string; email: string | null }>();
  let sent = 0;
  for (const item of rows.results) {
    if (!item.email) continue;
    const days = Math.max(0, Math.ceil((Date.parse(item.periodEnd) - now.getTime()) / 86_400_000));
    const action = `expiry_notice_${days}`;
    const exists = await env.DB.prepare(
      `SELECT id FROM subscription_events WHERE clinic_id = ? AND action = ? AND next_value = ? LIMIT 1`,
    )
      .bind(item.clinicId, action, item.periodEnd)
      .first();
    if (exists) continue;
    const delivery = await sendSubscriptionEmail({
      recipient: item.email,
      organizationName: item.organizationName,
      subject: `Tu suscripción vence en ${days} día${days === 1 ? '' : 's'}`,
      message: `La vigencia termina el ${new Date(item.periodEnd).toLocaleDateString('es-MX')}. Realiza la transferencia y comparte tu referencia con administración para mantener el servicio activo.`,
    });
    if (!delivery.sent) continue;
    await env.DB.prepare(
      `INSERT INTO subscription_events (id, clinic_id, action, previous_value, next_value, actor, created_at) VALUES (?, ?, ?, NULL, ?, 'system', ?)`,
    )
      .bind(`subscription_event_${crypto.randomUUID()}`, item.clinicId, action, item.periodEnd, new Date().toISOString())
      .run();
    sent += 1;
  }
  return sent;
}
