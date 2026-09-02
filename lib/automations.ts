import { env } from 'cloudflare:workers';

import { ensureDatabase } from '@/db/initialize';
import { renderAutomationTemplate } from '@/lib/automation-template';
import { sendTenantWhatsAppTemplate } from '@/lib/whatsapp';

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
    `SELECT kind, offset_minutes AS offsetMinutes, template, template_name AS templateName, template_language AS templateLanguage FROM automation_rules WHERE clinic_id = ? AND enabled = 1`,
  )
    .bind(clinicId)
    .all<{
      kind: AutomationKind;
      offsetMinutes: number;
      template: string;
      templateName: string | null;
      templateLanguage: string;
    }>();
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
      const body = renderAutomationTemplate(rule.template, {
        patientName: appointment.patientName,
        businessName: appointment.businessName,
        appointmentDate,
      });
      return env.DB.prepare(
        `INSERT INTO scheduled_messages (id, clinic_id, patient_id, appointment_id, campaign_id, kind, channel, recipient, body, template_name, template_language, scheduled_for, status, attempts, last_error, sent_at, created_at) VALUES (?, ?, ?, ?, NULL, ?, 'whatsapp', ?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, ?)`,
      ).bind(
        `scheduled_${crypto.randomUUID()}`,
        clinicId,
        appointment.patientId,
        appointmentId,
        rule.kind,
        appointment.phone,
        body,
        rule.templateName ?? configuredTemplateName(rule.kind),
        rule.templateLanguage || 'es_MX',
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
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 15 * 60_000).toISOString();
  await env.DB.prepare(
    `UPDATE scheduled_messages SET status = 'pending', processing_started_at = NULL, last_error = 'Reintento tras ejecución interrumpida' WHERE status = 'processing' AND processing_started_at < ?`,
  )
    .bind(staleBefore)
    .run();
  const jobs = await (
    clinicId
      ? env.DB.prepare(
          `SELECT id, clinic_id AS clinicId, patient_id AS patientId, appointment_id AS appointmentId, kind, recipient, body, template_name AS templateName, template_language AS templateLanguage FROM scheduled_messages WHERE clinic_id = ? AND status = 'pending' AND scheduled_for <= ? ORDER BY scheduled_for LIMIT ?`,
        ).bind(clinicId, now.toISOString(), cappedLimit)
      : env.DB.prepare(
          `SELECT id, clinic_id AS clinicId, patient_id AS patientId, appointment_id AS appointmentId, kind, recipient, body, template_name AS templateName, template_language AS templateLanguage FROM scheduled_messages WHERE status = 'pending' AND scheduled_for <= ? ORDER BY scheduled_for LIMIT ?`,
        ).bind(now.toISOString(), cappedLimit)
  ).all<{
    id: string;
    clinicId: string;
    patientId: string | null;
    appointmentId: string | null;
    kind: string;
    recipient: string;
    body: string;
    templateName: string | null;
    templateLanguage: string;
  }>();
  let processed = 0;
  let sent = 0;
  let failed = 0;
  for (const job of jobs.results) {
    const lock = await env.DB.prepare(
      `UPDATE scheduled_messages SET status = 'processing', processing_started_at = ? WHERE id = ? AND status = 'pending'`,
    )
      .bind(new Date().toISOString(), job.id)
      .run();
    if (!lock.meta.changes) continue;
    processed += 1;
    const templateName =
      job.templateName ?? configuredTemplateName(job.kind);
    const result = templateName
      ? await sendTenantWhatsAppTemplate(
          job.clinicId,
          job.recipient,
          templateName,
          job.templateLanguage || 'es_MX',
          job.body,
        )
      : {
          sent: false,
          error:
            'Falta una plantilla aprobada de WhatsApp para este mensaje automático.',
        };
    const now = new Date().toISOString();
    if (result.sent) {
      sent += 1;
      await env.DB.prepare(
        `UPDATE scheduled_messages SET status = 'sent', attempts = attempts + 1, processing_started_at = NULL, sent_at = ?, last_error = NULL WHERE id = ?`,
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
        `UPDATE scheduled_messages SET status = CASE WHEN attempts >= 2 THEN 'failed' ELSE 'pending' END, attempts = attempts + 1, processing_started_at = NULL, last_error = ? WHERE id = ?`,
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
  return { processed, sent, failed };
}

function configuredTemplateName(kind: string): string | null {
  const key =
    {
      reminder_24h: 'WHATSAPP_TEMPLATE_REMINDER_24H',
      reminder_2h: 'WHATSAPP_TEMPLATE_REMINDER_2H',
      follow_up: 'WHATSAPP_TEMPLATE_FOLLOW_UP',
      survey: 'WHATSAPP_TEMPLATE_SURVEY',
      reactivation: 'WHATSAPP_TEMPLATE_REACTIVATION',
    }[kind] ?? null;
  return key ? process.env[key] || null : null;
}
