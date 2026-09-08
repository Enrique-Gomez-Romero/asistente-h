'use server';

import { env } from 'cloudflare:workers';
import { revalidatePath } from 'next/cache';

import { ensureDatabase } from '@/db/initialize';
import { enqueueAppointmentAutomations } from '@/lib/automations';
import { sendInvitationEmail } from '@/lib/email';
import { syncAppointmentToGoogleCalendar } from '@/lib/google-calendar';
import { deleteOrganizationSecret } from '@/lib/google-secrets';
import { createInvitationToken, hashInvitationToken } from '@/lib/invitations';
import { normalizePhone } from '@/lib/phone';
import { appointmentEnd } from '@/lib/scheduling';
import {
  ensureSaasUser,
  getRequestUser,
  requireClinicAccess,
  type BusinessHour,
  type MembershipRole,
} from '@/lib/saas';
import { sendTenantWhatsAppText } from '@/lib/whatsapp';

export type ActionResult = {
  ok: boolean;
  message: string;
  organizationId?: string;
  invitationPath?: string;
};

type AppointmentInput = {
  clinicId: string;
  locationId: string;
  patientName: string;
  phone: string;
  email?: string;
  serviceId: string;
  doctorId: string;
  startsAtLocal: string;
  notes?: string;
  marketingOptIn?: boolean;
};

const statusLabelsForAudit: Record<string, string> = {
  pending: 'pendiente',
  confirmed: 'confirmada',
  completed: 'completada',
  cancelled: 'cancelada',
  no_show: 'marcada como inasistencia',
};

export async function createAppointment(
  input: AppointmentInput,
): Promise<ActionResult> {
  return actionResult(async () => {
    await ensureDatabase();
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
      'staff',
    ]);
    const patientName = input.patientName.trim();
    const phone = normalizePhone(input.phone);
    if (patientName.length < 2 || !phone)
      throw new Error('Escribe el nombre y un teléfono válido.');
    const [service, doctor, clinic, location] = await Promise.all([
      env.DB.prepare(
        'SELECT id, duration_minutes AS durationMinutes FROM services WHERE id = ? AND clinic_id = ? AND active = 1',
      )
        .bind(input.serviceId, input.clinicId)
        .first<{ id: string; durationMinutes: number }>(),
      env.DB.prepare(
        'SELECT id FROM doctors WHERE id = ? AND clinic_id = ? AND active = 1',
      )
        .bind(input.doctorId, input.clinicId)
        .first<{ id: string }>(),
      env.DB.prepare('SELECT timezone FROM clinics WHERE id = ?')
        .bind(input.clinicId)
        .first<{ timezone: string }>(),
      env.DB.prepare(
        `SELECT l.id FROM locations l WHERE l.id = ? AND l.clinic_id = ? AND l.active = 1 AND (
          ? IN ('owner', 'admin') OR ? = 1 OR EXISTS (
            SELECT 1 FROM memberships m JOIN membership_locations ml ON ml.membership_id = m.id
            WHERE m.clinic_id = l.clinic_id AND m.user_id = ? AND ml.location_id = l.id AND m.status = 'active'
          )
        )`,
      )
        .bind(
          input.locationId,
          input.clinicId,
          access.role,
          access.isPlatformAdmin ? 1 : 0,
          access.user.userId,
        )
        .first<{ id: string }>(),
    ]);
    if (!service || !doctor || !clinic || !location)
      throw new Error(
        'La sucursal, el servicio o el profesional seleccionado ya no está disponible.',
      );
    const doctorLocation = await env.DB.prepare(
      `SELECT id FROM doctor_locations WHERE clinic_id = ? AND doctor_id = ? AND location_id = ? AND active = 1`,
    )
      .bind(input.clinicId, input.doctorId, input.locationId)
      .first();
    if (!doctorLocation)
      throw new Error('Ese profesional no está asignado a la sucursal elegida.');
    const startsAt = parseLocalDate(input.startsAtLocal, clinic.timezone);
    if (!startsAt || Number.isNaN(startsAt.getTime()))
      throw new Error('Selecciona una fecha y hora válidas.');
    const endsAt = appointmentEnd(startsAt, service.durationMinutes);
    const patient = await env.DB.prepare(
      'SELECT id FROM patients WHERE clinic_id = ? AND phone = ?',
    )
      .bind(input.clinicId, phone)
      .first<{ id: string }>();
    const now = new Date().toISOString();
    const patientId = patient?.id ?? `pat_${crypto.randomUUID()}`;
    const appointmentId = `appt_${crypto.randomUUID()}`;
    const consentAt = input.marketingOptIn ? now : null;
    if (!patient) {
      await env.DB.prepare(
        'INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, marketing_opt_in, consent_at, consent_source, created_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)',
      )
        .bind(
          patientId,
          input.clinicId,
          patientName,
          phone,
          input.email?.trim() || null,
          input.marketingOptIn ? 1 : 0,
          consentAt,
          input.marketingOptIn ? 'staff_booking' : null,
          now,
        )
        .run();
    } else {
      await env.DB.prepare(
        `UPDATE patients SET full_name = ?, email = COALESCE(?, email), marketing_opt_in = CASE WHEN ? = 1 THEN 1 ELSE marketing_opt_in END, consent_at = CASE WHEN ? = 1 THEN ? ELSE consent_at END, consent_source = CASE WHEN ? = 1 THEN 'staff_booking' ELSE consent_source END WHERE id = ? AND clinic_id = ?`,
      )
        .bind(
          patientName,
          input.email?.trim() || null,
          input.marketingOptIn ? 1 : 0,
          input.marketingOptIn ? 1 : 0,
          consentAt,
          input.marketingOptIn ? 1 : 0,
          patientId,
          input.clinicId,
        )
        .run();
    }

    const appointment = await env.DB.prepare(
      `INSERT INTO appointments (id, clinic_id, location_id, patient_id, doctor_id, service_id, starts_at, ends_at, status, source, notes, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'manual', ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM appointments
         WHERE clinic_id = ? AND doctor_id = ?
           AND status NOT IN ('cancelled', 'no_show')
           AND starts_at < ? AND ends_at > ?
       )`,
    )
      .bind(
        appointmentId,
        input.clinicId,
        input.locationId,
        patientId,
        input.doctorId,
        input.serviceId,
        startsAt.toISOString(),
        endsAt.toISOString(),
        input.notes?.trim() || null,
        now,
        input.clinicId,
        input.doctorId,
        endsAt.toISOString(),
        startsAt.toISOString(),
      )
      .run();
    if (!appointment.meta.changes)
      throw new Error('Ese horario acaba de ocuparse. Elige otro horario.');

    await env.DB.batch([
      auditStatement(
        input.clinicId,
        access.user.email,
        'create',
        'appointment',
        appointmentId,
        { patientName, startsAt: startsAt.toISOString() },
      ),
      env.DB.prepare(
        `INSERT INTO patient_events (id, clinic_id, patient_id, kind, title, details, entity_id, created_at) VALUES (?, ?, ?, 'appointment', 'Cita creada', ?, ?, ?)`,
      ).bind(
        `patient_event_${crypto.randomUUID()}`,
        input.clinicId,
        patientId,
        JSON.stringify({ startsAt: startsAt.toISOString(), status: 'pending' }),
        appointmentId,
        now,
      ),
    ]);
    await syncAppointmentToGoogleCalendar(input.clinicId, appointmentId);
    revalidatePath('/app');
    return {
      ok: true,
      message: 'Cita creada correctamente. Quedó pendiente de confirmación.',
    };
  });
}

export async function setAppointmentStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  return actionResult(async () => {
    await ensureDatabase();
    if (
      !new Set([
        'pending',
        'confirmed',
        'completed',
        'cancelled',
        'no_show',
      ]).has(status)
    )
      throw new Error('Estado no permitido.');
    const entity = await env.DB.prepare(
      'SELECT clinic_id AS clinicId, location_id AS locationId, patient_id AS patientId, starts_at AS startsAt FROM appointments WHERE id = ?',
    )
      .bind(id)
      .first<{
        clinicId: string;
        locationId: string | null;
        patientId: string | null;
        startsAt: string;
      }>();
    if (!entity) throw new Error('No se encontró la cita.');
    const access = await requireClinicAccess(entity.clinicId, [
      'owner',
      'admin',
      'staff',
    ]);
    await assertLocationAssignment(access, entity.clinicId, entity.locationId);
    const now = new Date().toISOString();
    const statements = [
      env.DB.prepare(
        'UPDATE appointments SET status = ? WHERE id = ? AND clinic_id = ?',
      ).bind(status, id, entity.clinicId),
    ];
    if (entity.patientId) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO patient_events (id, clinic_id, patient_id, kind, title, details, entity_id, created_at) VALUES (?, ?, ?, 'appointment_status', ?, ?, ?, ?)`,
        ).bind(
          `patient_event_${crypto.randomUUID()}`,
          entity.clinicId,
          entity.patientId,
          `Cita ${statusLabelsForAudit[status] ?? status}`,
          JSON.stringify({ status, startsAt: entity.startsAt }),
          id,
          now,
        ),
      );
      if (status === 'completed') {
        statements.push(
          env.DB.prepare(
            'UPDATE patients SET last_visit_at = ? WHERE id = ? AND clinic_id = ?',
          ).bind(entity.startsAt, entity.patientId, entity.clinicId),
        );
      }
    }
    const results = await env.DB.batch(statements);
    const result = results[0];
    if (!result.meta.changes) throw new Error('No se encontró la cita.');
    await logAudit(
      entity.clinicId,
      access.user.email,
      'update_status',
      'appointment',
      id,
      { status },
    );
    if (status === 'confirmed' || status === 'completed')
      await enqueueAppointmentAutomations(entity.clinicId, id);
    await syncAppointmentToGoogleCalendar(entity.clinicId, id);
    revalidatePath('/app');
    return { ok: true, message: 'Estado de la cita actualizado.' };
  });
}

export async function createService(input: {
  clinicId: string;
  name: string;
  category: string;
  durationMinutes: number;
  pricePesos: number;
  description?: string;
}): Promise<ActionResult> {
  return actionResult(async () => {
    await ensureDatabase();
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
    ]);
    if (
      input.name.trim().length < 3 ||
      input.durationMinutes < 10 ||
      input.pricePesos < 0
    )
      throw new Error('Revisa el nombre, duración y precio del servicio.');
    const id = `service_${crypto.randomUUID()}`;
    await env.DB.prepare(
      'INSERT INTO services (id, clinic_id, name, category, description, duration_minutes, price_cents, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
    )
      .bind(
        id,
        input.clinicId,
        input.name.trim(),
        input.category.trim() || 'General',
        input.description?.trim() || null,
        Math.round(input.durationMinutes),
        Math.round(input.pricePesos * 100),
      )
      .run();
    await logAudit(input.clinicId, access.user.email, 'create', 'service', id, {
      name: input.name,
    });
    revalidatePath('/app');
    return { ok: true, message: 'Servicio agregado al catálogo.' };
  });
}

export async function createLocation(input: {
  clinicId: string;
  name: string;
  address?: string;
  phone?: string;
}): Promise<ActionResult> {
  return actionResult(async () => {
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
    ]);
    if (input.name.trim().length < 2)
      throw new Error('Escribe el nombre de la sucursal.');
    const [subscription, total] = await Promise.all([
      env.DB.prepare(
        `SELECT p.max_locations AS maxLocations FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id WHERE s.clinic_id = ?`,
      )
        .bind(input.clinicId)
        .first<{ maxLocations: number }>(),
      env.DB.prepare(
        `SELECT COUNT(*) AS total FROM locations WHERE clinic_id = ? AND active = 1`,
      )
        .bind(input.clinicId)
        .first<{ total: number }>(),
    ]);
    if (subscription && (total?.total ?? 0) >= subscription.maxLocations)
      throw new Error('El plan actual alcanzó su límite de sucursales.');
    const id = `location_${crypto.randomUUID()}`;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO locations (id, clinic_id, name, address, phone, active) VALUES (?, ?, ?, ?, ?, 1)`,
      ).bind(
        id,
        input.clinicId,
        input.name.trim(),
        input.address?.trim() || null,
        input.phone?.trim() || null,
      ),
      auditStatement(
        input.clinicId,
        access.user.email,
        'create',
        'location',
        id,
        {
          name: input.name,
        },
      ),
    ]);
    revalidatePath('/app');
    return { ok: true, message: 'Sucursal agregada.' };
  });
}

export async function createProfessional(input: {
  clinicId: string;
  name: string;
  email?: string;
  specialty?: string;
  locationId?: string;
}): Promise<ActionResult> {
  return actionResult(async () => {
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
    ]);
    if (input.name.trim().length < 3)
      throw new Error('Escribe el nombre del profesional.');
    if (input.locationId) {
      const location = await env.DB.prepare(
        `SELECT id FROM locations WHERE id = ? AND clinic_id = ? AND active = 1`,
      )
        .bind(input.locationId, input.clinicId)
        .first();
      if (!location) throw new Error('La sucursal seleccionada no es válida.');
    }
    const id = `professional_${crypto.randomUUID()}`;
    const statements = [
      env.DB.prepare(
        `INSERT INTO doctors (id, clinic_id, name, email, specialty, color, active) VALUES (?, ?, ?, ?, ?, '#248a73', 1)`,
      ).bind(
        id,
        input.clinicId,
        input.name.trim(),
        input.email?.trim() || null,
        input.specialty?.trim() || 'Profesional',
      ),
      auditStatement(
        input.clinicId,
        access.user.email,
        'create',
        'professional',
        id,
        { name: input.name },
      ),
    ];
    if (input.locationId) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO doctor_locations (id, clinic_id, doctor_id, location_id, active) VALUES (?, ?, ?, ?, 1)`,
        ).bind(
          `doctor_location_${crypto.randomUUID()}`,
          input.clinicId,
          id,
          input.locationId,
        ),
      );
    }
    await env.DB.batch(statements);
    revalidatePath('/app');
    return { ok: true, message: 'Profesional agregado a la agenda.' };
  });
}

export async function toggleService(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  return actionResult(async () => {
    const entity = await env.DB.prepare(
      'SELECT clinic_id AS clinicId FROM services WHERE id = ?',
    )
      .bind(id)
      .first<{ clinicId: string }>();
    if (!entity) throw new Error('No se encontró el servicio.');
    const access = await requireClinicAccess(entity.clinicId, [
      'owner',
      'admin',
    ]);
    await env.DB.prepare(
      'UPDATE services SET active = ? WHERE id = ? AND clinic_id = ?',
    )
      .bind(active ? 1 : 0, id, entity.clinicId)
      .run();
    await logAudit(
      entity.clinicId,
      access.user.email,
      'toggle',
      'service',
      id,
      { active },
    );
    revalidatePath('/app');
    return {
      ok: true,
      message: active ? 'Servicio activado.' : 'Servicio pausado.',
    };
  });
}

export async function toggleBotPaused(
  conversationId: string,
  paused: boolean,
): Promise<ActionResult> {
  return actionResult(async () => {
    const entity = await env.DB.prepare(
      'SELECT clinic_id AS clinicId, location_id AS locationId FROM conversations WHERE id = ?',
    )
      .bind(conversationId)
      .first<{ clinicId: string; locationId: string | null }>();
    if (!entity) throw new Error('No se encontró la conversación.');
    const access = await requireClinicAccess(entity.clinicId, [
      'owner',
      'admin',
      'staff',
    ]);
    await assertLocationAssignment(access, entity.clinicId, entity.locationId);
    await env.DB.prepare(
      'UPDATE conversations SET bot_paused = ?, assigned_to = ? WHERE id = ? AND clinic_id = ?',
    )
      .bind(
        paused ? 1 : 0,
        paused ? access.user.displayName : null,
        conversationId,
        entity.clinicId,
      )
      .run();
    await logAudit(
      entity.clinicId,
      access.user.email,
      paused ? 'human_takeover' : 'resume_bot',
      'conversation',
      conversationId,
      null,
    );
    revalidatePath('/app');
    return {
      ok: true,
      message: paused
        ? 'La conversación quedó a cargo de una persona.'
        : 'El asistente volvió a atender la conversación.',
    };
  });
}

export async function markConversationRead(
  conversationId: string,
): Promise<void> {
  const entity = await env.DB.prepare(
    'SELECT clinic_id AS clinicId, location_id AS locationId FROM conversations WHERE id = ?',
  )
    .bind(conversationId)
    .first<{ clinicId: string; locationId: string | null }>();
  if (!entity) return;
  const access = await requireClinicAccess(entity.clinicId, ['owner', 'admin', 'staff']);
  await assertLocationAssignment(access, entity.clinicId, entity.locationId);
  await env.DB.prepare(
    'UPDATE conversations SET unread_count = 0 WHERE id = ? AND clinic_id = ?',
  )
    .bind(conversationId, entity.clinicId)
    .run();
  revalidatePath('/app');
}

export async function sendConversationMessage(
  conversationId: string,
  body: string,
): Promise<ActionResult> {
  return actionResult(async () => {
    const message = body.trim();
    if (!message) throw new Error('Escribe un mensaje.');
    const conversation = await env.DB.prepare(
      `SELECT c.id, c.clinic_id AS clinicId, c.location_id AS locationId, p.phone FROM conversations c LEFT JOIN patients p ON p.id = c.patient_id WHERE c.id = ?`,
    )
      .bind(conversationId)
      .first<{ id: string; clinicId: string; locationId: string | null; phone: string | null }>();
    if (!conversation) throw new Error('No se encontró la conversación.');
    const access = await requireClinicAccess(conversation.clinicId, [
      'owner',
      'admin',
      'staff',
    ]);
    await assertLocationAssignment(access, conversation.clinicId, conversation.locationId);
    const now = new Date().toISOString();
    const messageId = `msg_${crypto.randomUUID()}`;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, delivery_status, last_error, created_at) VALUES (?, ?, 'outbound', 'staff', ?, NULL, 'pending', NULL, ?)`,
      ).bind(messageId, conversationId, message, now),
      env.DB.prepare(
        'UPDATE conversations SET last_message_at = ?, unread_count = 0 WHERE id = ? AND clinic_id = ?',
      ).bind(now, conversationId, conversation.clinicId),
    ]);
    const delivery = conversation.phone
      ? await sendTenantWhatsAppText(
        conversation.clinicId,
        conversation.phone,
        message,
        conversation.locationId,
      )
      : { sent: false, error: 'El paciente no tiene un teléfono registrado.' };
    await env.DB.prepare(
      `UPDATE messages SET external_id = ?, delivery_status = ?, last_error = ? WHERE id = ? AND conversation_id = ?`,
    )
      .bind(
        delivery.externalId ?? null,
        delivery.sent ? 'accepted' : 'failed',
        delivery.error ?? null,
        messageId,
        conversationId,
      )
      .run();
    await logAudit(
      conversation.clinicId,
      access.user.email,
      'send_message',
      'conversation',
      conversationId,
      null,
    );
    if (!delivery.sent)
      throw new Error(
        delivery.error ?? 'Meta no confirmó la entrega del mensaje.',
      );
    revalidatePath('/app');
    return { ok: true, message: 'Mensaje enviado.' };
  });
}

export async function createOrganization(input: {
  name: string;
  businessType: string;
  planId?: string;
  ownerEmail?: string;
  phone?: string;
  address?: string;
  timezone?: string;
}): Promise<ActionResult> {
  return actionResult(async () => {
    await ensureDatabase();
    const user = await getRequestUser();
    if (!user) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    await ensureSaasUser(user);
    const platformAdmin = await env.DB.prepare(
      `SELECT user_id FROM platform_admins WHERE user_id = ?`,
    )
      .bind(user.userId)
      .first();
    if (!platformAdmin)
      throw new Error(
        'Solo la administración de Asistente H puede crear nuevos negocios.',
      );
    const name = input.name.trim();
    if (name.length < 3) throw new Error('Escribe el nombre del negocio.');
    const businessType = input.businessType.trim() || 'dental';
    const ownerEmail = (input.ownerEmail || user.email)
      .trim()
      .toLocaleLowerCase('es-MX');
    if (!/^\S+@\S+\.\S+$/.test(ownerEmail))
      throw new Error('Escribe un correo válido para el propietario.');
    const requestedPlan = input.planId?.trim() || 'plan_trial';
    const plan = await env.DB.prepare(
      'SELECT id FROM subscription_plans WHERE id = ? AND active = 1 LIMIT 1',
    )
      .bind(requestedPlan)
      .first<{ id: string }>();
    if (!plan) throw new Error('Selecciona un plan válido.');
    const timezone = input.timezone?.trim() || 'America/Mexico_City';
    const id = `org_${crypto.randomUUID()}`;
    const locationId = `location_${crypto.randomUUID()}`;
    const professionalId = `professional_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString();
    let slug = slugify(name) || id;
    if (
      await env.DB.prepare(
        'SELECT clinic_id FROM organization_profiles WHERE slug = ?',
      )
        .bind(slug)
        .first()
    )
      slug = `${slug}-${id.slice(-6)}`;
    const statements = [
      env.DB.prepare(
        'INSERT INTO clinics (id, name, timezone, phone, address, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(
        id,
        name,
        timezone,
        input.phone?.trim() || null,
        input.address?.trim() || null,
        'MXN',
        now,
      ),
      env.DB.prepare(
        `INSERT INTO organization_profiles (clinic_id, slug, business_type, vertical_template, brand_color, onboarding_status, updated_at) VALUES (?, ?, ?, ?, '#2e9b7f', 'complete', ?)`,
      ).bind(
        id,
        slug,
        businessType,
        businessType === 'dental' ? 'dental' : 'general',
        now,
      ),
      env.DB.prepare(
        'INSERT INTO locations (id, clinic_id, name, address, timezone, phone, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      ).bind(
        locationId,
        id,
        'Sede principal',
        input.address?.trim() || null,
        timezone,
        input.phone?.trim() || null,
      ),
      env.DB.prepare(
        `INSERT INTO subscriptions (id, clinic_id, plan_id, status, current_period_start, current_period_end, trial_ends_at, billing_provider, customer_reference, subscription_reference, updated_at) VALUES (?, ?, ?, 'trialing', ?, ?, ?, NULL, NULL, NULL, ?)`,
      ).bind(
        `subscription_${crypto.randomUUID()}`,
        id,
        plan.id,
        now,
        trialEnd,
        trialEnd,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO integration_connections (id, clinic_id, provider, status, created_at, updated_at) VALUES (?, ?, 'whatsapp', 'pending', ?, ?)`,
      ).bind(`integration_${crypto.randomUUID()}`, id, now, now),
      env.DB.prepare(
        `INSERT INTO integration_connections (id, clinic_id, provider, status, created_at, updated_at) VALUES (?, ?, 'google_calendar', 'pending', ?, ?)`,
      ).bind(`integration_${crypto.randomUUID()}`, id, now, now),
      env.DB.prepare(
        `INSERT INTO organization_states (clinic_id, status, suspended_at, suspension_reason, updated_at) VALUES (?, 'active', NULL, NULL, ?)`,
      ).bind(id, now),
      env.DB.prepare(
        `INSERT INTO doctors (id, clinic_id, name, email, specialty, color, active) VALUES (?, ?, ?, ?, ?, '#2e9b7f', 1)`,
      ).bind(
        professionalId,
        id,
        'Profesional principal',
        ownerEmail,
        businessType === 'dental' ? 'Odontología general' : 'Profesional',
      ),
      env.DB.prepare(
        `INSERT INTO doctor_locations (id, clinic_id, doctor_id, location_id, active) VALUES (?, ?, ?, ?, 1)`,
      ).bind(
        `doctor_location_${crypto.randomUUID()}`,
        id,
        professionalId,
        locationId,
      ),
    ];
    const defaultAutomations = [
      [
        'reminder_24h',
        -1440,
        'Hola {{patient_name}}, te recordamos tu cita en {{business_name}} el {{appointment_date}}. Responde CONFIRMAR, CANCELAR o REPROGRAMAR.',
      ],
      [
        'reminder_2h',
        -120,
        'Tu cita en {{business_name}} comienza en aproximadamente 2 horas. Si necesitas ayuda, responde a este mensaje.',
      ],
      [
        'follow_up',
        1440,
        'Hola {{patient_name}}, esperamos que tu atención en {{business_name}} haya salido muy bien. ¿Hay algo en lo que podamos ayudarte?',
      ],
      [
        'survey',
        120,
        '¿Cómo calificarías tu experiencia en {{business_name}} del 1 al 5? Responde solo con un número.',
      ],
    ] as const;
    for (const [kind, offsetMinutes, template] of defaultAutomations) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO automation_rules (id, clinic_id, kind, enabled, offset_minutes, template, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)`,
        ).bind(
          `automation_${crypto.randomUUID()}`,
          id,
          kind,
          offsetMinutes,
          template,
          now,
        ),
      );
    }
    for (let day = 0; day <= 6; day += 1) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO business_hours (id, clinic_id, location_id, day_of_week, opens_at, closes_at, break_start, break_end, active) VALUES (?, ?, ?, ?, '09:00', ?, NULL, NULL, ?)`,
        ).bind(
          `hours_${crypto.randomUUID()}`,
          id,
          locationId,
          day,
          day === 6 ? '14:00' : '19:00',
          day === 0 ? 0 : 1,
        ),
      );
    }
    let invitationPath: string | undefined;
    let invitationIdForEmail: string | undefined;
    let invitationTokenForEmail: string | undefined;
    if (ownerEmail === user.email) {
      const ownerMembershipId = `membership_${crypto.randomUUID()}`;
      statements.push(
        env.DB.prepare(
          `INSERT INTO memberships (id, clinic_id, user_id, role, status, created_at) VALUES (?, ?, ?, 'owner', 'active', ?)`,
        ).bind(ownerMembershipId, id, user.userId, now),
        env.DB.prepare(
          `INSERT INTO membership_locations (id, clinic_id, membership_id, location_id, created_at) VALUES (?, ?, ?, ?, ?)`,
        ).bind(
          `membership_location_${crypto.randomUUID()}`,
          id,
          ownerMembershipId,
          locationId,
          now,
        ),
      );
    } else {
      const invitationId = `invitation_${crypto.randomUUID()}`;
      const token = createInvitationToken();
      const tokenHash = await hashInvitationToken(token);
      statements.push(
        env.DB.prepare(
          `INSERT INTO invitations (id, clinic_id, email, role, status, token_hash, expires_at, created_at) VALUES (?, ?, ?, 'owner', 'pending', ?, ?, ?)`,
        ).bind(invitationId, id, ownerEmail, tokenHash, trialEnd, now),
        env.DB.prepare(
          `INSERT INTO invitation_locations (id, invitation_id, location_id) VALUES (?, ?, ?)`,
        ).bind(
          `invitation_location_${crypto.randomUUID()}`,
          invitationId,
          locationId,
        ),
      );
      invitationPath = `/invite/${encodeURIComponent(token)}`;
      invitationIdForEmail = invitationId;
      invitationTokenForEmail = token;
    }
    await env.DB.batch(statements);
    if (invitationIdForEmail && invitationTokenForEmail) {
      await sendInvitationEmail({
        invitationId: invitationIdForEmail,
        recipient: ownerEmail,
        inviterName: user.displayName,
        organizationName: name,
        role: 'Propietario',
        token: invitationTokenForEmail,
      });
    }
    revalidatePath('/app');
    revalidatePath('/platform');
    return {
      ok: true,
      message:
        invitationPath
          ? 'Negocio creado. Copia la invitación y envíala al propietario.'
          : 'Negocio creado y asignado a tu cuenta.',
      organizationId: id,
      invitationPath,
    };
  });
}

export async function updateOrganizationProfile(input: {
  clinicId: string;
  name: string;
  phone?: string;
  address?: string;
  timezone: string;
}): Promise<ActionResult> {
  return actionResult(async () => {
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
    ]);
    if (input.name.trim().length < 3)
      throw new Error('Escribe un nombre válido para el negocio.');
    await env.DB.prepare(
      'UPDATE clinics SET name = ?, phone = ?, address = ?, timezone = ? WHERE id = ?',
    )
      .bind(
        input.name.trim(),
        input.phone?.trim() || null,
        input.address?.trim() || null,
        input.timezone,
        input.clinicId,
      )
      .run();
    await env.DB.prepare(
      'UPDATE locations SET address = ?, phone = ?, timezone = ? WHERE clinic_id = ? AND active = 1',
    )
      .bind(
        input.address?.trim() || null,
        input.phone?.trim() || null,
        input.timezone,
        input.clinicId,
      )
      .run();
    await logAudit(
      input.clinicId,
      access.user.email,
      'update',
      'organization',
      input.clinicId,
      { name: input.name },
    );
    revalidatePath('/app');
    return { ok: true, message: 'Datos del negocio actualizados.' };
  });
}

export async function updateBusinessHours(
  clinicId: string,
  values: Array<
    Pick<BusinessHour, 'dayOfWeek' | 'opensAt' | 'closesAt' | 'active'>
  >,
): Promise<ActionResult> {
  return actionResult(async () => {
    const access = await requireClinicAccess(clinicId, ['owner', 'admin']);
    const location = await env.DB.prepare(
      'SELECT id FROM locations WHERE clinic_id = ? AND active = 1 ORDER BY id LIMIT 1',
    )
      .bind(clinicId)
      .first<{ id: string }>();
    if (!location) throw new Error('No se encontró una sede activa.');
    const statements = values.map((value) => {
      if (
        value.dayOfWeek < 0 ||
        value.dayOfWeek > 6 ||
        !/^\d{2}:\d{2}$/.test(value.opensAt) ||
        !/^\d{2}:\d{2}$/.test(value.closesAt) ||
        value.opensAt >= value.closesAt
      )
        throw new Error('Revisa los horarios capturados.');
      return env.DB.prepare(
        `INSERT INTO business_hours (id, clinic_id, location_id, day_of_week, opens_at, closes_at, break_start, break_end, active) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?) ON CONFLICT(clinic_id, location_id, day_of_week) DO UPDATE SET opens_at = excluded.opens_at, closes_at = excluded.closes_at, active = excluded.active`,
      ).bind(
        `hours_${crypto.randomUUID()}`,
        clinicId,
        location.id,
        value.dayOfWeek,
        value.opensAt,
        value.closesAt,
        value.active ? 1 : 0,
      );
    });
    await env.DB.batch(statements);
    await logAudit(
      clinicId,
      access.user.email,
      'update',
      'business_hours',
      clinicId,
      null,
    );
    revalidatePath('/app');
    return {
      ok: true,
      message: 'Horarios actualizados. La IA ya usará esta disponibilidad.',
    };
  });
}

export async function inviteMember(input: {
  clinicId: string;
  email: string;
  role: MembershipRole;
  locationIds?: string[];
}): Promise<ActionResult> {
  return actionResult(async () => {
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
    ]);
    const email = input.email.trim().toLocaleLowerCase('es-MX');
    if (!/^\S+@\S+\.\S+$/.test(email))
      throw new Error('Revisa el correo y el rol.');
    if (
      !['admin', 'staff', 'viewer'].includes(input.role) &&
      !(input.role === 'owner' && access.isPlatformAdmin)
    )
      throw new Error('No puedes asignar ese rol.');
    const plan = await env.DB.prepare(
      `SELECT p.max_users AS maxUsers, (SELECT COUNT(*) FROM memberships m WHERE m.clinic_id = s.clinic_id AND m.status = 'active') AS currentUsers, (SELECT COUNT(*) FROM invitations i WHERE i.clinic_id = s.clinic_id AND i.status = 'pending' AND i.expires_at > ?) AS pendingInvites FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id WHERE s.clinic_id = ?`,
    )
      .bind(new Date().toISOString(), input.clinicId)
      .first<{
        maxUsers: number;
        currentUsers: number;
        pendingInvites: number;
      }>();
    if (plan && plan.currentUsers + plan.pendingInvites >= plan.maxUsers)
      throw new Error('Alcanzaste el límite de usuarios de tu plan.');
    const locationIds = [...new Set(input.locationIds ?? [])].filter(Boolean);
    if (['staff', 'viewer'].includes(input.role) && !locationIds.length)
      throw new Error('Selecciona al menos una sucursal para este usuario.');
    if (locationIds.length) {
      const validLocations = await env.DB.prepare(
        `SELECT COUNT(*) AS total FROM locations WHERE clinic_id = ? AND active = 1 AND id IN (${locationIds.map(() => '?').join(',')})`,
      )
        .bind(input.clinicId, ...locationIds)
        .first<{ total: number }>();
      if (Number(validLocations?.total ?? 0) !== locationIds.length)
        throw new Error('Una de las sucursales seleccionadas no es válida.');
    }
    const [existingMembership, clinic] = await Promise.all([
      env.DB.prepare(
        `SELECT m.id FROM memberships m JOIN saas_users u ON u.id = m.user_id WHERE m.clinic_id = ? AND u.email = ? AND m.status = 'active'`,
      )
        .bind(input.clinicId, email)
        .first<{ id: string }>(),
      env.DB.prepare('SELECT name FROM clinics WHERE id = ?')
        .bind(input.clinicId)
        .first<{ name: string }>(),
    ]);
    if (!clinic) throw new Error('No se encontró el negocio.');
    if (existingMembership)
      throw new Error('Ese usuario ya forma parte del equipo.');
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
    const invitationId = `invitation_${crypto.randomUUID()}`;
    const token = createInvitationToken();
    const tokenHash = await hashInvitationToken(token);
    const statements = [
      env.DB.prepare(
        `UPDATE invitations SET status = 'revoked' WHERE clinic_id = ? AND email = ? AND status = 'pending'`,
      ).bind(input.clinicId, email),
      env.DB.prepare(
        `INSERT INTO invitations (id, clinic_id, email, role, status, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        invitationId,
        input.clinicId,
        email,
        input.role,
        'pending',
        tokenHash,
        expiresAt,
        now,
      ),
    ];
    for (const locationId of locationIds) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO invitation_locations (id, invitation_id, location_id) VALUES (?, ?, ?)`,
        ).bind(
          `invitation_location_${crypto.randomUUID()}`,
          invitationId,
          locationId,
        ),
      );
    }
    await env.DB.batch(statements);
    const delivery = await sendInvitationEmail({
      invitationId,
      recipient: email,
      inviterName: access.user.displayName,
      organizationName: clinic.name,
      role: membershipRoleLabel(input.role),
      token,
    });
    await logAudit(
      input.clinicId,
      access.user.email,
      'invite',
      'membership',
      email,
      { role: input.role },
    );
    revalidatePath('/app');
    return {
      ok: true,
      message: delivery.sent
        ? 'Invitación enviada por correo. Vence en siete días.'
        : `Invitación creada, pero el correo quedó pendiente. ${delivery.error}`,
      invitationPath: `/invite/${encodeURIComponent(token)}`,
    };
  });
}

export async function updateMemberLocations(input: {
  clinicId: string;
  membershipId: string;
  locationIds: string[];
}): Promise<ActionResult> {
  return actionResult(async () => {
    const access = await requireClinicAccess(input.clinicId, ['owner', 'admin']);
    const membership = await env.DB.prepare(
      `SELECT id, role FROM memberships WHERE id = ? AND clinic_id = ? AND status = 'active'`,
    )
      .bind(input.membershipId, input.clinicId)
      .first<{ id: string; role: MembershipRole }>();
    if (!membership) throw new Error('No se encontró ese integrante.');
    const locationIds = [...new Set(input.locationIds)].filter(Boolean);
    if (['staff', 'viewer'].includes(membership.role) && !locationIds.length)
      throw new Error('El personal debe tener al menos una sucursal asignada.');
    if (locationIds.length) {
      const valid = await env.DB.prepare(
        `SELECT COUNT(*) AS total FROM locations WHERE clinic_id = ? AND active = 1 AND id IN (${locationIds.map(() => '?').join(',')})`,
      )
        .bind(input.clinicId, ...locationIds)
        .first<{ total: number }>();
      if (Number(valid?.total ?? 0) !== locationIds.length)
        throw new Error('Una de las sucursales seleccionadas no es válida.');
    }
    const statements = [
      env.DB.prepare(
        `DELETE FROM membership_locations WHERE membership_id = ? AND clinic_id = ?`,
      ).bind(input.membershipId, input.clinicId),
    ];
    const now = new Date().toISOString();
    for (const locationId of locationIds) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO membership_locations (id, clinic_id, membership_id, location_id, created_at) VALUES (?, ?, ?, ?, ?)`,
        ).bind(
          `membership_location_${crypto.randomUUID()}`,
          input.clinicId,
          input.membershipId,
          locationId,
          now,
        ),
      );
    }
    await env.DB.batch(statements);
    await logAudit(
      input.clinicId,
      access.user.email,
      'assign_locations',
      'membership',
      input.membershipId,
      { locationIds },
    );
    revalidatePath('/app');
    return { ok: true, message: 'Sucursales del usuario actualizadas.' };
  });
}

export async function resendInvitation(
  invitationId: string,
): Promise<ActionResult> {
  return actionResult(async () => {
    const invitation = await env.DB.prepare(
      `SELECT i.id, i.clinic_id AS clinicId, i.email, i.role, i.status, c.name AS clinicName FROM invitations i JOIN clinics c ON c.id = i.clinic_id WHERE i.id = ?`,
    )
      .bind(invitationId)
      .first<{
        id: string;
        clinicId: string;
        email: string;
        role: MembershipRole;
        status: string;
        clinicName: string;
      }>();
    if (!invitation) throw new Error('No se encontró la invitación.');
    const access = await requireClinicAccess(invitation.clinicId, [
      'owner',
      'admin',
    ]);
    if (invitation.status === 'accepted')
      throw new Error('El usuario ya forma parte del equipo.');
    const token = createInvitationToken();
    const tokenHash = await hashInvitationToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
    await env.DB.prepare(
      `UPDATE invitations SET status = 'pending', token_hash = ?, expires_at = ? WHERE id = ? AND clinic_id = ?`,
    )
      .bind(tokenHash, expiresAt, invitation.id, invitation.clinicId)
      .run();
    const delivery = await sendInvitationEmail({
      invitationId: invitation.id,
      recipient: invitation.email,
      inviterName: access.user.displayName,
      organizationName: invitation.clinicName,
      role: membershipRoleLabel(invitation.role),
      token,
    });
    revalidatePath('/app');
    return {
      ok: true,
      message: delivery.sent
        ? 'Invitación reenviada y vigencia renovada.'
        : `Se renovó la invitación. ${delivery.error ?? 'El correo no pudo enviarse; copia el enlace manualmente.'}`,
      invitationPath: `/invite/${encodeURIComponent(token)}`,
    };
  });
}

export async function revokeInvitation(
  invitationId: string,
): Promise<ActionResult> {
  return actionResult(async () => {
    const invitation = await env.DB.prepare(
      `SELECT clinic_id AS clinicId, status FROM invitations WHERE id = ?`,
    )
      .bind(invitationId)
      .first<{ clinicId: string; status: string }>();
    if (!invitation) throw new Error('No se encontró la invitación.');
    const access = await requireClinicAccess(invitation.clinicId, [
      'owner',
      'admin',
    ]);
    if (invitation.status !== 'pending')
      throw new Error('La invitación ya no está pendiente.');
    await env.DB.prepare(
      `UPDATE invitations SET status = 'revoked', token_hash = NULL WHERE id = ? AND clinic_id = ?`,
    )
      .bind(invitationId, invitation.clinicId)
      .run();
    await logAudit(
      invitation.clinicId,
      access.user.email,
      'revoke',
      'invitation',
      invitationId,
      null,
    );
    revalidatePath('/app');
    return { ok: true, message: 'Invitación revocada.' };
  });
}

export async function saveIntegrationMetadata(input: {
  clinicId: string;
  provider: 'google_calendar';
  externalAccountId?: string;
  locationId?: string;
  label?: string;
}): Promise<ActionResult> {
  return actionResult(async () => {
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
    ]);
    const now = new Date().toISOString();
    const configured = Boolean(input.externalAccountId?.trim());
    await env.DB.prepare(
      `INSERT INTO integration_connections (id, clinic_id, location_id, provider, label, status, external_account_id, phone_number_id, secret_reference, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    )
      .bind(
        `integration_${crypto.randomUUID()}`,
        input.clinicId,
        input.locationId?.trim() || null,
        input.provider,
        input.label?.trim() || 'Google Calendar',
        configured ? 'metadata_ready' : 'pending',
        input.externalAccountId?.trim() || null,
        null,
        now,
        now,
      )
      .run();
    await logAudit(
      input.clinicId,
      access.user.email,
      'configure',
      'integration',
      input.provider,
      { metadataReady: configured },
    );
    revalidatePath('/app');
    return {
      ok: true,
      message:
        'Datos de integración guardados. Las llaves secretas se conectan desde el servidor.',
    };
  });
}

export async function disconnectGoogleCalendar(
  clinicId: string,
  connectionId: string,
): Promise<ActionResult> {
  return actionResult(async () => {
    const access = await requireClinicAccess(clinicId, ['owner', 'admin']);
    const connection = await env.DB.prepare(
      `SELECT secret_reference AS secretReference FROM integration_connections WHERE id = ? AND clinic_id = ? AND provider = 'google_calendar'`,
    )
      .bind(connectionId, clinicId)
      .first<{ secretReference: string | null }>();
    if (!connection) throw new Error('No se encontró esa conexión de Google.');
    if (connection.secretReference)
      await deleteOrganizationSecret(connection.secretReference);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE integration_connections SET status = 'disconnected', secret_reference = NULL, updated_at = ? WHERE id = ? AND clinic_id = ?`,
    )
      .bind(now, connectionId, clinicId)
      .run();
    await logAudit(
      clinicId,
      access.user.email,
      'disconnect',
      'integration',
      connectionId,
      { provider: 'google_calendar' },
    );
    revalidatePath('/app');
    return { ok: true, message: 'Google Calendar quedó desconectado.' };
  });
}

export async function updatePatientConsent(
  patientId: string,
  allowed: boolean,
): Promise<ActionResult> {
  return actionResult(async () => {
    const patient = await env.DB.prepare(
      `SELECT clinic_id AS clinicId FROM patients WHERE id = ?`,
    )
      .bind(patientId)
      .first<{ clinicId: string }>();
    if (!patient) throw new Error('No se encontró el paciente.');
    const access = await requireClinicAccess(patient.clinicId, [
      'owner',
      'admin',
      'staff',
    ]);
    await env.DB.prepare(
      `UPDATE patients SET marketing_opt_in = ?, consent_at = ?, consent_source = ? WHERE id = ? AND clinic_id = ?`,
    )
      .bind(
        allowed ? 1 : 0,
        allowed ? new Date().toISOString() : null,
        allowed ? 'staff_confirmation' : 'revoked',
        patientId,
        patient.clinicId,
      )
      .run();
    await logAudit(
      patient.clinicId,
      access.user.email,
      allowed ? 'grant_marketing_consent' : 'revoke_marketing_consent',
      'patient',
      patientId,
      null,
    );
    revalidatePath('/app');
    return {
      ok: true,
      message: allowed
        ? 'Consentimiento registrado.'
        : 'Consentimiento revocado.',
    };
  });
}

export async function anonymizePatient(
  patientId: string,
): Promise<ActionResult> {
  return actionResult(async () => {
    const patient = await env.DB.prepare(
      `SELECT clinic_id AS clinicId FROM patients WHERE id = ?`,
    )
      .bind(patientId)
      .first<{ clinicId: string }>();
    if (!patient) throw new Error('No se encontró el paciente.');
    const access = await requireClinicAccess(patient.clinicId, [
      'owner',
      'admin',
    ]);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE messages SET body = '[Contenido eliminado por solicitud de privacidad]', last_error = NULL WHERE conversation_id IN (SELECT id FROM conversations WHERE patient_id = ? AND clinic_id = ?)`,
      ).bind(patientId, patient.clinicId),
      env.DB.prepare(
        `UPDATE scheduled_messages SET status = 'cancelled', recipient = '', body = '[Eliminado]', last_error = 'Datos anonimizados' WHERE patient_id = ? AND clinic_id = ? AND status = 'pending'`,
      ).bind(patientId, patient.clinicId),
      env.DB.prepare(
        `UPDATE patients SET full_name = 'Paciente anonimizado', phone = ?, email = NULL, notes = NULL, marketing_opt_in = 0, consent_at = NULL, consent_source = 'privacy_request' WHERE id = ? AND clinic_id = ?`,
      ).bind(`anon_${patientId}`, patientId, patient.clinicId),
      auditStatement(
        patient.clinicId,
        access.user.email,
        'anonymize',
        'patient',
        patientId,
        { at: now },
      ),
    ]);
    revalidatePath('/app');
    return {
      ok: true,
      message: 'Los datos identificables del paciente fueron anonimizados.',
    };
  });
}

async function logAudit(
  clinicId: string,
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  details: unknown,
): Promise<void> {
  await auditStatement(
    clinicId,
    actor,
    action,
    entityType,
    entityId,
    details,
  ).run();
}

async function assertLocationAssignment(
  access: {
    user: { userId: string };
    role: MembershipRole;
    isPlatformAdmin: boolean;
  },
  clinicId: string,
  locationId: string | null,
) {
  if (access.isPlatformAdmin || ['owner', 'admin'].includes(access.role)) return;
  if (!locationId)
    throw new Error('Esta información todavía no tiene una sucursal asignada.');
  const assignment = await env.DB.prepare(
    `SELECT ml.id FROM memberships m JOIN membership_locations ml ON ml.membership_id = m.id WHERE m.clinic_id = ? AND m.user_id = ? AND m.status = 'active' AND ml.location_id = ? LIMIT 1`,
  )
    .bind(clinicId, access.user.userId, locationId)
    .first();
  if (!assignment)
    throw new Error('No tienes acceso a la sucursal de este registro.');
}

function auditStatement(
  clinicId: string,
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  details: unknown,
) {
  return env.DB.prepare(
    'INSERT INTO audit_logs (id, clinic_id, actor, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    `audit_${crypto.randomUUID()}`,
    clinicId,
    actor,
    action,
    entityType,
    entityId,
    details ? JSON.stringify(details) : null,
    new Date().toISOString(),
  );
}

async function actionResult(
  operation: () => Promise<ActionResult>,
): Promise<ActionResult> {
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

function parseLocalDate(value: string, timeZone: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match[1].split('-').map(Number);
  const [hour, minute] = match[2].split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(desired));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const rendered = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
  );
  return new Date(desired + (desired - rendered));
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function membershipRoleLabel(role: MembershipRole) {
  return (
    {
      owner: 'Propietario',
      admin: 'Administrador',
      staff: 'Personal',
      viewer: 'Solo lectura',
    } satisfies Record<MembershipRole, string>
  )[role];
}
