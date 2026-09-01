import { env } from 'cloudflare:workers';

import { ensureDatabase } from '@/db/initialize';
import { sendTenantWhatsAppText } from '@/lib/whatsapp';

type AutomationKind = 'reminder_24h' | 'reminder_2h' | 'follow_up' | 'survey';

export async function enqueueAppointmentAutomations(
  clinicId: string,
  appointmentId: string,
): Promise<void> {
  await ensureDatabase();
  const appointment = await env.DB.prepare(
    `SELECT a.id, a.patient_id AS patientId, a.starts_at AS startsAt, a.ends_at AS endsAt, p.full_name AS patientName, p.phone, c.name AS businessName, c.timezone FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN clinics c ON c.id = a.clinic_id WHERE a.id = ? AND a.clinic_id = ?`,
  )
    .bind(appointmentId, clinicId)
    .first<{
      id: string;
      patientId: string;
      startsAt: string;
      endsAt: string;
      patientName: string;
      phone: string;
      businessName: string;
      timezone: string;
    }>();
  if (!appointment) return;
  const rules = await env.DB.prepare(
    `SELECT kind, offset_minutes AS offsetMinutes, template FROM automation_rules WHERE clinic_id = ? AND enabled = 1`,
  )
    .bind(clinicId)
    .all<{ kind: AutomationKind; offsetMinutes: number; template: string }>();
  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    `SELECT kind FROM scheduled_messages WHERE clinic_id = ? AND appointment_id = ? AND status IN ('pending', 'sent')`,
  )
    .bind(clinicId, appointmentId)
    .all<{ kind: string }>();
  const existingKinds = new Set(existing.results.map((item) => item.kind));
  const statements = rules.results
    .filter((rule) => !existingKinds.has(rule.kind))
    .map((rule) => {
      const base =
        rule.kind === 'follow_up' || rule.kind === 'survey'
          ? new Date(appointment.endsAt).getTime()
          : new Date(appointment.startsAt).getTime();
      const scheduledFor = new Date(
        base + rule.offsetMinutes * 60_000,
      ).toISOString();
      const appointmentDate = new Intl.DateTimeFormat('es-MX', {
        timeZone: appointment.timezone,
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(new Date(appointment.startsAt));
      const body = rule.template
        .replaceAll('{{patient_name}}', appointment.patientName)
        .replaceAll('{{business_name}}', appointment.businessName)
        .replaceAll('{{appointment_date}}', appointmentDate);
      return env.DB.prepare(
        `INSERT INTO scheduled_messages (id, clinic_id, patient_id, appointment_id, campaign_id, kind, channel, recipient, body, scheduled_for, status, attempts, last_error, sent_at, created_at) VALUES (?, ?, ?, ?, NULL, ?, 'whatsapp', ?, ?, ?, 'pending', 0, NULL, NULL, ?)`,
      ).bind(
        `scheduled_${crypto.randomUUID()}`,
        clinicId,
        appointment.patientId,
        appointmentId,
        rule.kind,
        appointment.phone,
        body,
        scheduledFor,
        now,
      );
    });
  if (statements.length) await env.DB.batch(statements);
}

export async function processDueAutomations(
  limit = 30,
  clinicId?: string,
): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  await ensureDatabase();
  const cappedLimit = Math.min(Math.max(limit, 1), 100);
  const jobs = await (
    clinicId
      ? env.DB.prepare(
          `SELECT id, clinic_id AS clinicId, patient_id AS patientId, appointment_id AS appointmentId, kind, recipient, body FROM scheduled_messages WHERE clinic_id = ? AND status = 'pending' AND scheduled_for <= ? ORDER BY scheduled_for LIMIT ?`,
        ).bind(clinicId, new Date().toISOString(), cappedLimit)
      : env.DB.prepare(
          `SELECT id, clinic_id AS clinicId, patient_id AS patientId, appointment_id AS appointmentId, kind, recipient, body FROM scheduled_messages WHERE status = 'pending' AND scheduled_for <= ? ORDER BY scheduled_for LIMIT ?`,
        ).bind(new Date().toISOString(), cappedLimit)
  ).all<{
    id: string;
    clinicId: string;
    patientId: string | null;
    appointmentId: string | null;
    kind: string;
    recipient: string;
    body: string;
  }>();
  let sent = 0;
  let failed = 0;
  for (const job of jobs.results) {
    const result = await sendTenantWhatsAppText(
      job.clinicId,
      job.recipient,
      job.body,
    );
    const now = new Date().toISOString();
    if (result.sent) {
      sent += 1;
      await env.DB.prepare(
        `UPDATE scheduled_messages SET status = 'sent', attempts = attempts + 1, sent_at = ?, last_error = NULL WHERE id = ?`,
      )
        .bind(now, job.id)
        .run();
      if (job.kind === 'survey' && job.patientId) {
        await env.DB.prepare(
          `INSERT INTO surveys (id, clinic_id, patient_id, appointment_id, score, comment, status, sent_at, responded_at, created_at) VALUES (?, ?, ?, ?, NULL, NULL, 'pending', ?, NULL, ?)`,
        )
          .bind(
            `survey_${crypto.randomUUID()}`,
            job.clinicId,
            job.patientId,
            job.appointmentId,
            now,
            now,
          )
          .run();
      }
    } else {
      failed += 1;
      await env.DB.prepare(
        `UPDATE scheduled_messages SET status = CASE WHEN attempts >= 2 THEN 'failed' ELSE 'pending' END, attempts = attempts + 1, last_error = ? WHERE id = ?`,
      )
        .bind(result.error ?? 'No fue posible enviar.', job.id)
        .run();
      await env.DB.prepare(
        `INSERT INTO staff_notifications (id, clinic_id, user_id, kind, title, body, entity_type, entity_id, read_at, created_at) VALUES (?, ?, NULL, 'automation_error', 'Automatización pendiente', ?, 'scheduled_message', ?, NULL, ?)`,
      )
        .bind(
          `notification_${crypto.randomUUID()}`,
          job.clinicId,
          result.error ?? 'No fue posible enviar el mensaje.',
          job.id,
          now,
        )
        .run();
    }
  }
  return { processed: jobs.results.length, sent, failed };
}
