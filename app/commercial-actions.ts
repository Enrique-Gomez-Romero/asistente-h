'use server';

import { env } from 'cloudflare:workers';
import { revalidatePath } from 'next/cache';

import { ensureDatabase } from '@/db/initialize';
import { processDueAutomations } from '@/lib/automations';
import { getRequestUser, requireClinicAccess } from '@/lib/saas';

export type CommercialActionResult = {
  ok: boolean;
  message: string;
  processed?: number;
};

export async function adminUpdateSubscription(input: {
  clinicId: string;
  planId: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  periodEnd: string;
}): Promise<CommercialActionResult> {
  return commercialAction(async () => {
    const user = await requirePlatformAdmin();
    const [subscription, plan] = await Promise.all([
      env.DB.prepare(
        `SELECT id, plan_id AS planId, status, current_period_end AS periodEnd FROM subscriptions WHERE clinic_id = ?`,
      )
        .bind(input.clinicId)
        .first<{
          id: string;
          planId: string;
          status: string;
          periodEnd: string;
        }>(),
      env.DB.prepare(
        `SELECT id FROM subscription_plans WHERE id = ? AND active = 1`,
      )
        .bind(input.planId)
        .first<{ id: string }>(),
    ]);
    if (!subscription || !plan)
      throw new Error('No se encontró la suscripción o el plan.');
    const periodEnd = new Date(`${input.periodEnd}T23:59:59.000Z`);
    if (Number.isNaN(periodEnd.getTime()))
      throw new Error('Selecciona una fecha de vigencia válida.');
    const previous = JSON.stringify({
      planId: subscription.planId,
      status: subscription.status,
      periodEnd: subscription.periodEnd,
    });
    const next = JSON.stringify({
      planId: input.planId,
      status: input.status,
      periodEnd: periodEnd.toISOString(),
    });
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE subscriptions SET plan_id = ?, status = ?, current_period_end = ?, trial_ends_at = CASE WHEN ? = 'trialing' THEN ? ELSE trial_ends_at END, updated_at = ? WHERE clinic_id = ?`,
      ).bind(
        input.planId,
        input.status,
        periodEnd.toISOString(),
        input.status,
        periodEnd.toISOString(),
        now,
        input.clinicId,
      ),
      env.DB.prepare(
        `INSERT INTO subscription_events (id, clinic_id, action, previous_value, next_value, actor, created_at) VALUES (?, ?, 'manual_update', ?, ?, ?, ?)`,
      ).bind(
        `subscription_event_${crypto.randomUUID()}`,
        input.clinicId,
        previous,
        next,
        user.email,
        now,
      ),
    ]);
    refreshCommercialViews();
    return { ok: true, message: 'Plan, estado y vigencia actualizados.' };
  });
}

export async function adminSetOrganizationStatus(input: {
  clinicId: string;
  status: 'active' | 'suspended';
  reason?: string;
}): Promise<CommercialActionResult> {
  return commercialAction(async () => {
    const user = await requirePlatformAdmin();
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO organization_states (clinic_id, status, suspended_at, suspension_reason, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(clinic_id) DO UPDATE SET status = excluded.status, suspended_at = excluded.suspended_at, suspension_reason = excluded.suspension_reason, updated_at = excluded.updated_at`,
      ).bind(
        input.clinicId,
        input.status,
        input.status === 'suspended' ? now : null,
        input.status === 'suspended'
          ? input.reason?.trim() || 'Suspensión administrativa'
          : null,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO audit_logs (id, clinic_id, actor, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, 'organization', ?, ?, ?)`,
      ).bind(
        `audit_${crypto.randomUUID()}`,
        input.clinicId,
        user.email,
        input.status === 'suspended' ? 'suspend' : 'reactivate',
        input.clinicId,
        JSON.stringify({ reason: input.reason ?? null }),
        now,
      ),
    ]);
    refreshCommercialViews();
    return {
      ok: true,
      message:
        input.status === 'suspended'
          ? 'Organización suspendida.'
          : 'Organización reactivada.',
    };
  });
}

export async function adminRecordManualPayment(input: {
  clinicId: string;
  amountPesos: number;
  periodStart: string;
  periodEnd: string;
  receivedAt: string;
  reference?: string;
  invoiceFolio?: string;
  invoiceUrl?: string;
  notes?: string;
}): Promise<CommercialActionResult> {
  return commercialAction(async () => {
    const user = await requirePlatformAdmin();
    if (!Number.isFinite(input.amountPesos) || input.amountPesos <= 0)
      throw new Error('Captura un monto válido.');
    const start = new Date(`${input.periodStart}T00:00:00.000Z`);
    const end = new Date(`${input.periodEnd}T23:59:59.000Z`);
    const received = new Date(`${input.receivedAt}T12:00:00.000Z`);
    if (
      [start, end, received].some((value) => Number.isNaN(value.getTime())) ||
      end <= start
    )
      throw new Error('Revisa las fechas del pago.');
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO manual_payments (id, clinic_id, amount_cents, currency, period_start, period_end, received_at, method, reference, invoice_folio, invoice_url, notes, created_by, created_at) VALUES (?, ?, ?, 'MXN', ?, ?, ?, 'bank_transfer', ?, ?, ?, ?, ?, ?)`,
      ).bind(
        `payment_${crypto.randomUUID()}`,
        input.clinicId,
        Math.round(input.amountPesos * 100),
        start.toISOString(),
        end.toISOString(),
        received.toISOString(),
        input.reference?.trim() || null,
        input.invoiceFolio?.trim() || null,
        input.invoiceUrl?.trim() || null,
        input.notes?.trim() || null,
        user.email,
        now,
      ),
      env.DB.prepare(
        `UPDATE subscriptions SET status = 'active', current_period_start = ?, current_period_end = ?, updated_at = ? WHERE clinic_id = ?`,
      ).bind(start.toISOString(), end.toISOString(), now, input.clinicId),
      env.DB.prepare(
        `INSERT INTO subscription_events (id, clinic_id, action, previous_value, next_value, actor, created_at) VALUES (?, ?, 'payment_recorded', NULL, ?, ?, ?)`,
      ).bind(
        `subscription_event_${crypto.randomUUID()}`,
        input.clinicId,
        JSON.stringify({
          amountPesos: input.amountPesos,
          periodEnd: end.toISOString(),
        }),
        user.email,
        now,
      ),
    ]);
    refreshCommercialViews();
    return {
      ok: true,
      message: 'Transferencia registrada y suscripción activada.',
    };
  });
}

export async function addWaitlistEntry(input: {
  clinicId: string;
  patientId: string;
  serviceId?: string;
  doctorId?: string;
  dateFrom?: string;
  dateTo?: string;
  preferredTime?: string;
  notes?: string;
}): Promise<CommercialActionResult> {
  return commercialAction(async () => {
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
      'staff',
    ]);
    const patient = await env.DB.prepare(
      `SELECT id FROM patients WHERE id = ? AND clinic_id = ?`,
    )
      .bind(input.patientId, input.clinicId)
      .first<{ id: string }>();
    if (!patient) throw new Error('No se encontró el paciente.');
    const id = `waitlist_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO waitlist_entries (id, clinic_id, patient_id, service_id, doctor_id, preferred_date_from, preferred_date_to, preferred_time, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?)`,
      ).bind(
        id,
        input.clinicId,
        input.patientId,
        input.serviceId || null,
        input.doctorId || null,
        input.dateFrom || null,
        input.dateTo || null,
        input.preferredTime || null,
        input.notes?.trim() || null,
        now,
        now,
      ),
      patientEvent(
        input.clinicId,
        input.patientId,
        'waitlist',
        'Agregado a lista de espera',
        input.notes ?? null,
        id,
        now,
      ),
      audit(
        input.clinicId,
        access.user.email,
        'create',
        'waitlist',
        id,
        null,
        now,
      ),
    ]);
    refreshCommercialViews();
    return { ok: true, message: 'Paciente agregado a la lista de espera.' };
  });
}

export async function setWaitlistStatus(
  id: string,
  status: 'waiting' | 'contacted' | 'booked' | 'closed',
): Promise<CommercialActionResult> {
  return commercialAction(async () => {
    const entry = await env.DB.prepare(
      `SELECT clinic_id AS clinicId, patient_id AS patientId FROM waitlist_entries WHERE id = ?`,
    )
      .bind(id)
      .first<{ clinicId: string; patientId: string }>();
    if (!entry) throw new Error('No se encontró la entrada.');
    const access = await requireClinicAccess(entry.clinicId, [
      'owner',
      'admin',
      'staff',
    ]);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE waitlist_entries SET status = ?, updated_at = ? WHERE id = ? AND clinic_id = ?`,
      ).bind(status, now, id, entry.clinicId),
      patientEvent(
        entry.clinicId,
        entry.patientId,
        'waitlist',
        `Lista de espera: ${status}`,
        null,
        id,
        now,
      ),
      audit(
        entry.clinicId,
        access.user.email,
        'update_status',
        'waitlist',
        id,
        { status },
        now,
      ),
    ]);
    refreshCommercialViews();
    return { ok: true, message: 'Lista de espera actualizada.' };
  });
}

export async function updateAutomationRule(input: {
  clinicId: string;
  kind: string;
  enabled: boolean;
  offsetMinutes: number;
  template: string;
}): Promise<CommercialActionResult> {
  return commercialAction(async () => {
    await requireClinicAccess(input.clinicId, ['owner', 'admin']);
    if (
      !['reminder_24h', 'reminder_2h', 'follow_up', 'survey'].includes(
        input.kind,
      ) ||
      input.template.trim().length < 10
    )
      throw new Error('Revisa la automatización.');
    await env.DB.prepare(
      `UPDATE automation_rules SET enabled = ?, offset_minutes = ?, template = ?, updated_at = ? WHERE clinic_id = ? AND kind = ?`,
    )
      .bind(
        input.enabled ? 1 : 0,
        Math.round(input.offsetMinutes),
        input.template.trim(),
        new Date().toISOString(),
        input.clinicId,
        input.kind,
      )
      .run();
    refreshCommercialViews();
    return { ok: true, message: 'Automatización actualizada.' };
  });
}

export async function createReactivationCampaign(input: {
  clinicId: string;
  name: string;
  template: string;
  scheduledFor?: string;
}): Promise<CommercialActionResult> {
  return commercialAction(async () => {
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
    ]);
    if (input.name.trim().length < 3 || input.template.trim().length < 20)
      throw new Error('Revisa el nombre y el mensaje.');
    const clinic = await env.DB.prepare(`SELECT name FROM clinics WHERE id = ?`)
      .bind(input.clinicId)
      .first<{ name: string }>();
    if (!clinic) throw new Error('No se encontró el negocio.');
    const inactiveBefore = new Date(
      Date.now() - 180 * 24 * 60 * 60_000,
    ).toISOString();
    const patients = await env.DB.prepare(
      `SELECT id, full_name AS fullName, phone FROM patients WHERE clinic_id = ? AND (last_visit_at IS NULL OR last_visit_at < ?) ORDER BY created_at LIMIT 500`,
    )
      .bind(input.clinicId, inactiveBefore)
      .all<{ id: string; fullName: string; phone: string }>();
    const campaignId = `campaign_${crypto.randomUUID()}`;
    const scheduledFor = input.scheduledFor
      ? new Date(input.scheduledFor).toISOString()
      : new Date().toISOString();
    const now = new Date().toISOString();
    const statements = [
      env.DB.prepare(
        `INSERT INTO campaigns (id, clinic_id, name, audience, template, status, scheduled_for, created_by, created_at) VALUES (?, ?, ?, 'inactive_patients', ?, 'scheduled', ?, ?, ?)`,
      ).bind(
        campaignId,
        input.clinicId,
        input.name.trim(),
        input.template.trim(),
        scheduledFor,
        access.user.email,
        now,
      ),
    ];
    for (const patient of patients.results) {
      const body = input.template
        .trim()
        .replaceAll('{{patient_name}}', patient.fullName)
        .replaceAll('{{business_name}}', clinic.name);
      statements.push(
        env.DB.prepare(
          `INSERT INTO campaign_recipients (id, clinic_id, campaign_id, patient_id, status, sent_at) VALUES (?, ?, ?, ?, 'queued', NULL)`,
        ).bind(
          `recipient_${crypto.randomUUID()}`,
          input.clinicId,
          campaignId,
          patient.id,
        ),
        env.DB.prepare(
          `INSERT INTO scheduled_messages (id, clinic_id, patient_id, appointment_id, campaign_id, kind, channel, recipient, body, scheduled_for, status, attempts, last_error, sent_at, created_at) VALUES (?, ?, ?, NULL, ?, 'reactivation', 'whatsapp', ?, ?, ?, 'pending', 0, NULL, NULL, ?)`,
        ).bind(
          `scheduled_${crypto.randomUUID()}`,
          input.clinicId,
          patient.id,
          campaignId,
          patient.phone,
          body,
          scheduledFor,
          now,
        ),
      );
    }
    await env.DB.batch(statements);
    refreshCommercialViews();
    return {
      ok: true,
      message: `Campaña programada para ${patients.results.length} paciente(s).`,
    };
  });
}

export async function requestAppointmentDeposit(input: {
  appointmentId: string;
  amountPesos: number;
  reference?: string;
}): Promise<CommercialActionResult> {
  return commercialAction(async () => {
    const appointment = await env.DB.prepare(
      `SELECT clinic_id AS clinicId, patient_id AS patientId FROM appointments WHERE id = ?`,
    )
      .bind(input.appointmentId)
      .first<{ clinicId: string; patientId: string | null }>();
    if (!appointment || !appointment.patientId)
      throw new Error('No se encontró la cita.');
    const access = await requireClinicAccess(appointment.clinicId, [
      'owner',
      'admin',
      'staff',
    ]);
    if (!Number.isFinite(input.amountPesos) || input.amountPesos <= 0)
      throw new Error('Captura un anticipo válido.');
    const id = `deposit_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO deposit_requests (id, clinic_id, appointment_id, amount_cents, currency, status, reference, requested_at, paid_at, verified_by) VALUES (?, ?, ?, ?, 'MXN', 'requested', ?, ?, NULL, NULL) ON CONFLICT(appointment_id) DO UPDATE SET amount_cents = excluded.amount_cents, reference = excluded.reference, status = 'requested', requested_at = excluded.requested_at`,
      ).bind(
        id,
        appointment.clinicId,
        input.appointmentId,
        Math.round(input.amountPesos * 100),
        input.reference?.trim() || null,
        now,
      ),
      patientEvent(
        appointment.clinicId,
        appointment.patientId,
        'deposit',
        'Anticipo solicitado',
        JSON.stringify({ amountPesos: input.amountPesos }),
        input.appointmentId,
        now,
      ),
      audit(
        appointment.clinicId,
        access.user.email,
        'request',
        'deposit',
        input.appointmentId,
        { amountPesos: input.amountPesos },
        now,
      ),
    ]);
    refreshCommercialViews();
    return { ok: true, message: 'Solicitud de anticipo registrada.' };
  });
}

export async function verifyAppointmentDeposit(
  appointmentId: string,
): Promise<CommercialActionResult> {
  return commercialAction(async () => {
    const deposit = await env.DB.prepare(
      `SELECT clinic_id AS clinicId FROM deposit_requests WHERE appointment_id = ?`,
    )
      .bind(appointmentId)
      .first<{ clinicId: string }>();
    if (!deposit) throw new Error('No se encontró el anticipo.');
    const access = await requireClinicAccess(deposit.clinicId, [
      'owner',
      'admin',
    ]);
    await env.DB.prepare(
      `UPDATE deposit_requests SET status = 'paid', paid_at = ?, verified_by = ? WHERE appointment_id = ?`,
    )
      .bind(new Date().toISOString(), access.user.email, appointmentId)
      .run();
    refreshCommercialViews();
    return { ok: true, message: 'Anticipo marcado como recibido.' };
  });
}

export async function runAutomationsNow(
  clinicId: string,
): Promise<CommercialActionResult> {
  return commercialAction(async () => {
    await requireClinicAccess(clinicId, ['owner', 'admin']);
    const result = await processDueAutomations(50, clinicId);
    refreshCommercialViews();
    return {
      ok: true,
      message: `Procesadas ${result.processed}: ${result.sent} enviadas y ${result.failed} pendientes.`,
      processed: result.processed,
    };
  });
}

async function requirePlatformAdmin() {
  await ensureDatabase();
  const user = await getRequestUser();
  if (!user) throw new Error('Tu sesión expiró.');
  const admin = await env.DB.prepare(
    `SELECT user_id FROM platform_admins WHERE user_id = ?`,
  )
    .bind(user.userId)
    .first();
  if (!admin)
    throw new Error('Acceso exclusivo para administración de plataforma.');
  return user;
}

async function commercialAction(
  operation: () => Promise<CommercialActionResult>,
): Promise<CommercialActionResult> {
  try {
    await ensureDatabase();
    return await operation();
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'No fue posible completar la acción.',
    };
  }
}

function refreshCommercialViews() {
  revalidatePath('/app');
  revalidatePath('/platform');
}

function patientEvent(
  clinicId: string,
  patientId: string,
  kind: string,
  title: string,
  details: string | null,
  entityId: string,
  createdAt: string,
) {
  return env.DB.prepare(
    `INSERT INTO patient_events (id, clinic_id, patient_id, kind, title, details, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    `patient_event_${crypto.randomUUID()}`,
    clinicId,
    patientId,
    kind,
    title,
    details,
    entityId,
    createdAt,
  );
}

function audit(
  clinicId: string,
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  details: unknown,
  createdAt: string,
) {
  return env.DB.prepare(
    `INSERT INTO audit_logs (id, clinic_id, actor, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    `audit_${crypto.randomUUID()}`,
    clinicId,
    actor,
    action,
    entityType,
    entityId,
    details ? JSON.stringify(details) : null,
    createdAt,
  );
}
