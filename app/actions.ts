'use server';

import { env } from 'cloudflare:workers';
import { revalidatePath } from 'next/cache';

import { ensureDatabase } from '@/db/initialize';
import {
  ensureSaasUser,
  getRequestUser,
  requireClinicAccess,
  type BusinessHour,
  type MembershipRole,
} from '@/lib/saas';

export type ActionResult = {
  ok: boolean;
  message: string;
  organizationId?: string;
};

type AppointmentInput = {
  clinicId: string;
  patientName: string;
  phone: string;
  email?: string;
  serviceId: string;
  doctorId: string;
  startsAtLocal: string;
  notes?: string;
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
    const phone = input.phone.trim();
    if (patientName.length < 2 || phone.replace(/\D/g, '').length < 8)
      throw new Error('Escribe el nombre y un teléfono válido.');
    const [service, doctor, clinic] = await Promise.all([
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
    ]);
    if (!service || !doctor || !clinic)
      throw new Error(
        'El servicio o profesional seleccionado ya no está disponible.',
      );
    const startsAt = parseLocalDate(input.startsAtLocal, clinic.timezone);
    if (!startsAt || Number.isNaN(startsAt.getTime()))
      throw new Error('Selecciona una fecha y hora válidas.');
    const endsAt = new Date(
      startsAt.getTime() + service.durationMinutes * 60_000,
    );
    const conflict = await env.DB.prepare(
      `SELECT id FROM appointments WHERE clinic_id = ? AND doctor_id = ? AND status NOT IN ('cancelled', 'no_show') AND starts_at < ? AND ends_at > ? LIMIT 1`,
    )
      .bind(
        input.clinicId,
        input.doctorId,
        endsAt.toISOString(),
        startsAt.toISOString(),
      )
      .first<{ id: string }>();
    if (conflict)
      throw new Error('Ese horario acaba de ocuparse. Elige otro horario.');
    const patient = await env.DB.prepare(
      'SELECT id FROM patients WHERE clinic_id = ? AND phone = ?',
    )
      .bind(input.clinicId, phone)
      .first<{ id: string }>();
    const now = new Date().toISOString();
    const patientId = patient?.id ?? `pat_${crypto.randomUUID()}`;
    const appointmentId = `appt_${crypto.randomUUID()}`;
    const statements = [];
    if (!patient) {
      statements.push(
        env.DB.prepare(
          'INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)',
        ).bind(
          patientId,
          input.clinicId,
          patientName,
          phone,
          input.email?.trim() || null,
          now,
        ),
      );
    } else {
      statements.push(
        env.DB.prepare(
          'UPDATE patients SET full_name = ?, email = COALESCE(?, email) WHERE id = ? AND clinic_id = ?',
        ).bind(
          patientName,
          input.email?.trim() || null,
          patientId,
          input.clinicId,
        ),
      );
    }
    statements.push(
      env.DB.prepare(
        `INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, starts_at, ends_at, status, source, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'manual', ?, ?)`,
      ).bind(
        appointmentId,
        input.clinicId,
        patientId,
        input.doctorId,
        input.serviceId,
        startsAt.toISOString(),
        endsAt.toISOString(),
        input.notes?.trim() || null,
        now,
      ),
      auditStatement(
        input.clinicId,
        access.user.email,
        'create',
        'appointment',
        appointmentId,
        { patientName, startsAt: startsAt.toISOString() },
      ),
    );
    await env.DB.batch(statements);
    revalidatePath('/');
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
      'SELECT clinic_id AS clinicId FROM appointments WHERE id = ?',
    )
      .bind(id)
      .first<{ clinicId: string }>();
    if (!entity) throw new Error('No se encontró la cita.');
    const access = await requireClinicAccess(entity.clinicId, [
      'owner',
      'admin',
      'staff',
    ]);
    const result = await env.DB.prepare(
      'UPDATE appointments SET status = ? WHERE id = ? AND clinic_id = ?',
    )
      .bind(status, id, entity.clinicId)
      .run();
    if (!result.meta.changes) throw new Error('No se encontró la cita.');
    await logAudit(
      entity.clinicId,
      access.user.email,
      'update_status',
      'appointment',
      id,
      { status },
    );
    revalidatePath('/');
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
    revalidatePath('/');
    return { ok: true, message: 'Servicio agregado al catálogo.' };
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
    revalidatePath('/');
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
      'SELECT clinic_id AS clinicId FROM conversations WHERE id = ?',
    )
      .bind(conversationId)
      .first<{ clinicId: string }>();
    if (!entity) throw new Error('No se encontró la conversación.');
    const access = await requireClinicAccess(entity.clinicId, [
      'owner',
      'admin',
      'staff',
    ]);
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
    revalidatePath('/');
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
    'SELECT clinic_id AS clinicId FROM conversations WHERE id = ?',
  )
    .bind(conversationId)
    .first<{ clinicId: string }>();
  if (!entity) return;
  await requireClinicAccess(entity.clinicId);
  await env.DB.prepare(
    'UPDATE conversations SET unread_count = 0 WHERE id = ? AND clinic_id = ?',
  )
    .bind(conversationId, entity.clinicId)
    .run();
  revalidatePath('/');
}

export async function sendConversationMessage(
  conversationId: string,
  body: string,
): Promise<ActionResult> {
  return actionResult(async () => {
    const message = body.trim();
    if (!message) throw new Error('Escribe un mensaje.');
    const conversation = await env.DB.prepare(
      'SELECT id, clinic_id AS clinicId FROM conversations WHERE id = ?',
    )
      .bind(conversationId)
      .first<{ id: string; clinicId: string }>();
    if (!conversation) throw new Error('No se encontró la conversación.');
    const access = await requireClinicAccess(conversation.clinicId, [
      'owner',
      'admin',
      'staff',
    ]);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, 'outbound', 'staff', ?, NULL, ?)`,
      ).bind(`msg_${crypto.randomUUID()}`, conversationId, message, now),
      env.DB.prepare(
        'UPDATE conversations SET last_message_at = ?, unread_count = 0 WHERE id = ? AND clinic_id = ?',
      ).bind(now, conversationId, conversation.clinicId),
    ]);
    await sendWhatsAppText(conversation.clinicId, conversationId, message);
    await logAudit(
      conversation.clinicId,
      access.user.email,
      'send_message',
      'conversation',
      conversationId,
      null,
    );
    revalidatePath('/');
    return { ok: true, message: 'Mensaje enviado.' };
  });
}

export async function createOrganization(input: {
  name: string;
  businessType: string;
  phone?: string;
  address?: string;
  timezone?: string;
}): Promise<ActionResult> {
  return actionResult(async () => {
    await ensureDatabase();
    const user = await getRequestUser();
    if (!user) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    await ensureSaasUser(user);
    const name = input.name.trim();
    if (name.length < 3) throw new Error('Escribe el nombre del negocio.');
    const businessType = input.businessType.trim() || 'dental';
    const timezone = input.timezone?.trim() || 'America/Mexico_City';
    const id = `org_${crypto.randomUUID()}`;
    const locationId = `location_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();
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
        `INSERT INTO subscriptions (id, clinic_id, plan_id, status, current_period_start, current_period_end, trial_ends_at, billing_provider, customer_reference, subscription_reference, updated_at) VALUES (?, ?, 'plan_trial', 'trialing', ?, ?, ?, NULL, NULL, NULL, ?)`,
      ).bind(
        `subscription_${crypto.randomUUID()}`,
        id,
        now,
        trialEnd,
        trialEnd,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO memberships (id, clinic_id, user_id, role, status, created_at) VALUES (?, ?, ?, 'owner', 'active', ?)`,
      ).bind(`membership_${crypto.randomUUID()}`, id, user.userId, now),
      env.DB.prepare(
        `INSERT INTO integration_connections (id, clinic_id, provider, status, created_at, updated_at) VALUES (?, ?, 'openai', 'pending', ?, ?)`,
      ).bind(`integration_${crypto.randomUUID()}`, id, now, now),
      env.DB.prepare(
        `INSERT INTO integration_connections (id, clinic_id, provider, status, created_at, updated_at) VALUES (?, ?, 'whatsapp', 'pending', ?, ?)`,
      ).bind(`integration_${crypto.randomUUID()}`, id, now, now),
      env.DB.prepare(
        `INSERT INTO doctors (id, clinic_id, name, email, specialty, color, active) VALUES (?, ?, ?, ?, ?, '#2e9b7f', 1)`,
      ).bind(
        `professional_${crypto.randomUUID()}`,
        id,
        user.fullName || user.displayName,
        user.email,
        businessType === 'dental' ? 'Odontología general' : 'Profesional',
        1,
      ),
    ];
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
    await env.DB.batch(statements);
    revalidatePath('/');
    return {
      ok: true,
      message:
        'Negocio creado. Ya puedes configurar servicios, horarios e integraciones.',
      organizationId: id,
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
    revalidatePath('/');
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
    revalidatePath('/');
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
}): Promise<ActionResult> {
  return actionResult(async () => {
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
    ]);
    const email = input.email.trim().toLocaleLowerCase('es-MX');
    if (
      !/^\S+@\S+\.\S+$/.test(email) ||
      !['admin', 'staff', 'viewer'].includes(input.role)
    )
      throw new Error('Revisa el correo y el rol.');
    const plan = await env.DB.prepare(
      `SELECT p.max_users AS maxUsers, (SELECT COUNT(*) FROM memberships m WHERE m.clinic_id = s.clinic_id AND m.status = 'active') AS currentUsers FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id WHERE s.clinic_id = ?`,
    )
      .bind(input.clinicId)
      .first<{ maxUsers: number; currentUsers: number }>();
    if (plan && plan.currentUsers >= plan.maxUsers)
      throw new Error('Alcanzaste el límite de usuarios de tu plan.');
    const existingUser = await env.DB.prepare(
      'SELECT id FROM saas_users WHERE email = ?',
    )
      .bind(email)
      .first<{ id: string }>();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
    if (existingUser) {
      await env.DB.prepare(
        `INSERT INTO memberships (id, clinic_id, user_id, role, status, created_at) VALUES (?, ?, ?, ?, 'active', ?) ON CONFLICT(clinic_id, user_id) DO UPDATE SET role = excluded.role, status = 'active'`,
      )
        .bind(
          `membership_${crypto.randomUUID()}`,
          input.clinicId,
          existingUser.id,
          input.role,
          now,
        )
        .run();
    }
    await env.DB.prepare(
      `INSERT INTO invitations (id, clinic_id, email, role, status, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
    )
      .bind(
        `invitation_${crypto.randomUUID()}`,
        input.clinicId,
        email,
        input.role,
        existingUser ? 'accepted' : 'pending',
        expiresAt,
        now,
      )
      .run();
    await logAudit(
      input.clinicId,
      access.user.email,
      'invite',
      'membership',
      email,
      { role: input.role },
    );
    revalidatePath('/');
    return {
      ok: true,
      message: existingUser
        ? 'Usuario agregado al equipo.'
        : 'Invitación preparada. Falta habilitar el envío de correo y compartirle acceso al sitio privado.',
    };
  });
}

export async function saveIntegrationMetadata(input: {
  clinicId: string;
  provider: 'whatsapp' | 'openai' | 'gemini';
  externalAccountId?: string;
  phoneNumberId?: string;
}): Promise<ActionResult> {
  return actionResult(async () => {
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
    ]);
    const now = new Date().toISOString();
    const configured =
      input.provider === 'whatsapp'
        ? Boolean(input.phoneNumberId?.trim())
        : Boolean(input.externalAccountId?.trim());
    await env.DB.prepare(
      `INSERT INTO integration_connections (id, clinic_id, provider, status, external_account_id, phone_number_id, secret_reference, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?) ON CONFLICT(clinic_id, provider) DO UPDATE SET status = excluded.status, external_account_id = excluded.external_account_id, phone_number_id = excluded.phone_number_id, updated_at = excluded.updated_at`,
    )
      .bind(
        `integration_${crypto.randomUUID()}`,
        input.clinicId,
        input.provider,
        configured ? 'metadata_ready' : 'pending',
        input.externalAccountId?.trim() || null,
        input.phoneNumberId?.trim() || null,
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
    revalidatePath('/');
    return {
      ok: true,
      message:
        'Datos de integración guardados. Las llaves secretas se conectan desde el servidor.',
    };
  });
}

async function sendWhatsAppText(
  clinicId: string,
  conversationId: string,
  body: string,
): Promise<void> {
  if (
    !process.env.WHATSAPP_ACCESS_TOKEN ||
    !process.env.WHATSAPP_PHONE_NUMBER_ID
  )
    return;
  const patient = await env.DB.prepare(
    `SELECT p.phone FROM conversations c JOIN patients p ON p.id = c.patient_id WHERE c.id = ? AND c.clinic_id = ?`,
  )
    .bind(conversationId, clinicId)
    .first<{ phone: string }>();
  const integration = await env.DB.prepare(
    `SELECT phone_number_id AS phoneNumberId FROM integration_connections WHERE clinic_id = ? AND provider = 'whatsapp'`,
  )
    .bind(clinicId)
    .first<{ phoneNumberId: string | null }>();
  if (
    !patient ||
    (integration?.phoneNumberId &&
      integration.phoneNumberId !== process.env.WHATSAPP_PHONE_NUMBER_ID)
  )
    return;
  const response = await fetch(
    `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: patient.phone.replace(/\D/g, ''),
        type: 'text',
        text: { body },
      }),
    },
  );
  if (!response.ok) console.error('WhatsApp send failed', response.status);
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
