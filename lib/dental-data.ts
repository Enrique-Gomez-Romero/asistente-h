import { env } from 'cloudflare:workers';

import { ensureDatabase } from '@/db/initialize';
import { googleSecretManagerConfigured } from '@/lib/google-secrets';
import type { SaasContext } from '@/lib/saas';

export type ClinicRecord = {
  id: string;
  name: string;
  timezone: string;
  phone: string | null;
  address: string | null;
  currency: string;
};

export type DoctorRecord = {
  id: string;
  name: string;
  email: string | null;
  specialty: string | null;
  color: string;
  active: number;
  locationIds: string[];
};

export type ServiceRecord = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  active: number;
};

export type PatientRecord = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  lastVisitAt: string | null;
  marketingOptIn: number;
  consentAt: string | null;
  createdAt: string;
  appointmentCount: number;
};

export type AppointmentRecord = {
  id: string;
  patientId: string | null;
  patientName: string;
  patientPhone: string | null;
  locationId: string | null;
  locationName: string | null;
  doctorId: string;
  doctorName: string;
  doctorColor: string;
  serviceId: string | null;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  source: string;
  notes: string | null;
};

export type MessageRecord = {
  id: string;
  conversationId: string;
  direction: string;
  authorType: string;
  body: string;
  deliveryStatus: string;
  lastError: string | null;
  createdAt: string;
};

export type ConversationRecord = {
  id: string;
  patientId: string | null;
  patientName: string;
  patientPhone: string | null;
  locationId: string | null;
  locationName: string | null;
  status: string;
  assignedTo: string | null;
  botPaused: number;
  unreadCount: number;
  lastMessageAt: string;
  lastMessage: string;
  messages: MessageRecord[];
};

export type FaqRecord = {
  id: string;
  question: string;
  answer: string;
  active: number;
};

export type AutomationRuleRecord = {
  id: string;
  kind: string;
  enabled: number;
  offsetMinutes: number;
  template: string;
};

export type WaitlistRecord = {
  id: string;
  patientName: string;
  patientPhone: string;
  serviceName: string | null;
  doctorName: string | null;
  preferredDateFrom: string | null;
  preferredDateTo: string | null;
  preferredTime: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
};

export type CampaignRecord = {
  id: string;
  name: string;
  audience: string;
  status: string;
  scheduledFor: string | null;
  createdAt: string;
  recipients: number;
  sent: number;
};

export type DepositRecord = {
  id: string;
  appointmentId: string;
  patientName: string;
  serviceName: string;
  startsAt: string;
  amountCents: number;
  currency: string;
  status: string;
  reference: string | null;
  requestedAt: string;
  paidAt: string | null;
};

export type PatientEventRecord = {
  id: string;
  patientId: string;
  kind: string;
  title: string;
  details: string | null;
  entityId: string | null;
  createdAt: string;
};

export type NotificationRecord = {
  id: string;
  kind: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type LocationRecord = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  active: number;
};

export type DashboardData = {
  clinic: ClinicRecord;
  doctors: DoctorRecord[];
  services: ServiceRecord[];
  patients: PatientRecord[];
  appointments: AppointmentRecord[];
  conversations: ConversationRecord[];
  faqs: FaqRecord[];
  integration: {
    aiConfigured: boolean;
    whatsappConfigured: boolean;
    googleCalendarConfigured: boolean;
    metaEmbeddedSignup: {
      appId: string | null;
      configId: string | null;
      ready: boolean;
      secretStorageReady: boolean;
    };
    invitationEmailReady: boolean;
    mode: 'demo' | 'production';
  };
  commercial: {
    automationRules: AutomationRuleRecord[];
    waitlist: WaitlistRecord[];
    campaigns: CampaignRecord[];
    deposits: DepositRecord[];
    patientEvents: PatientEventRecord[];
    notifications: NotificationRecord[];
    scheduledPending: number;
    surveysSent: number;
    surveysAnswered: number;
    averageScore: number | null;
  };
  locations: LocationRecord[];
  saas: SaasContext;
};

export async function getDashboardData(
  clinicId: string,
  saas: SaasContext,
): Promise<DashboardData> {
  await ensureDatabase();
  const d1 = env.DB;

  const [
    clinic,
    doctors,
    services,
    patients,
    appointments,
    conversations,
    messages,
    faqs,
    automationRules,
    waitlist,
    campaigns,
    deposits,
    patientEvents,
    notifications,
    scheduledSummary,
    surveySummary,
    locations,
  ] = await Promise.all([
    d1
      .prepare(
        'SELECT id, name, timezone, phone, address, currency FROM clinics WHERE id = ?',
      )
      .bind(clinicId)
      .first<ClinicRecord>(),
    d1
      .prepare(
        `SELECT d.id, d.name, d.email, d.specialty, d.color, d.active, COALESCE(GROUP_CONCAT(dl.location_id), '') AS locationIdsCsv FROM doctors d LEFT JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.active = 1 WHERE d.clinic_id = ? GROUP BY d.id ORDER BY d.name`,
      )
      .bind(clinicId)
      .all<DoctorRecord & { locationIdsCsv: string }>(),
    d1
      .prepare(
        'SELECT id, name, category, description, duration_minutes AS durationMinutes, price_cents AS priceCents, active FROM services WHERE clinic_id = ? ORDER BY active DESC, name',
      )
      .bind(clinicId)
      .all<ServiceRecord>(),
    d1
      .prepare(
        'SELECT p.id, p.full_name AS fullName, p.phone, p.email, p.notes, p.last_visit_at AS lastVisitAt, p.marketing_opt_in AS marketingOptIn, p.consent_at AS consentAt, p.created_at AS createdAt, COUNT(a.id) AS appointmentCount FROM patients p LEFT JOIN appointments a ON a.patient_id = p.id WHERE p.clinic_id = ? GROUP BY p.id ORDER BY p.full_name',
      )
      .bind(clinicId)
      .all<PatientRecord>(),
    d1
      .prepare(
        `SELECT a.id, a.patient_id AS patientId, COALESCE(p.full_name, 'Horario bloqueado') AS patientName, p.phone AS patientPhone, a.location_id AS locationId, l.name AS locationName, a.doctor_id AS doctorId, d.name AS doctorName, d.color AS doctorColor, a.service_id AS serviceId, COALESCE(s.name, 'Bloqueo de agenda') AS serviceName, a.starts_at AS startsAt, a.ends_at AS endsAt, a.status, a.source, a.notes FROM appointments a JOIN doctors d ON d.id = a.doctor_id LEFT JOIN locations l ON l.id = a.location_id LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN services s ON s.id = a.service_id WHERE a.clinic_id = ? ORDER BY a.starts_at`,
      )
      .bind(clinicId)
      .all<AppointmentRecord>(),
    d1
      .prepare(
        `SELECT c.id, c.patient_id AS patientId, COALESCE(p.full_name, 'Paciente nuevo') AS patientName, p.phone AS patientPhone, c.location_id AS locationId, l.name AS locationName, c.status, c.assigned_to AS assignedTo, c.bot_paused AS botPaused, c.unread_count AS unreadCount, c.last_message_at AS lastMessageAt, COALESCE((SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1), '') AS lastMessage FROM conversations c LEFT JOIN locations l ON l.id = c.location_id LEFT JOIN patients p ON p.id = c.patient_id WHERE c.clinic_id = ? ORDER BY c.last_message_at DESC`,
      )
      .bind(clinicId)
      .all<Omit<ConversationRecord, 'messages'>>(),
    d1
      .prepare(
        `SELECT m.id, m.conversation_id AS conversationId, m.direction, m.author_type AS authorType, m.body, m.delivery_status AS deliveryStatus, m.last_error AS lastError, m.created_at AS createdAt FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.clinic_id = ? ORDER BY m.created_at`,
      )
      .bind(clinicId)
      .all<MessageRecord>(),
    d1
      .prepare(
        'SELECT id, question, answer, active FROM faq_items WHERE clinic_id = ? ORDER BY question',
      )
      .bind(clinicId)
      .all<FaqRecord>(),
    d1
      .prepare(
        'SELECT id, kind, enabled, offset_minutes AS offsetMinutes, template FROM automation_rules WHERE clinic_id = ? ORDER BY offset_minutes',
      )
      .bind(clinicId)
      .all<AutomationRuleRecord>(),
    d1
      .prepare(
        `SELECT w.id, p.full_name AS patientName, p.phone AS patientPhone, s.name AS serviceName, d.name AS doctorName, w.preferred_date_from AS preferredDateFrom, w.preferred_date_to AS preferredDateTo, w.preferred_time AS preferredTime, w.status, w.notes, w.created_at AS createdAt FROM waitlist_entries w JOIN patients p ON p.id = w.patient_id LEFT JOIN services s ON s.id = w.service_id LEFT JOIN doctors d ON d.id = w.doctor_id WHERE w.clinic_id = ? ORDER BY CASE w.status WHEN 'waiting' THEN 0 WHEN 'contacted' THEN 1 ELSE 2 END, w.created_at DESC`,
      )
      .bind(clinicId)
      .all<WaitlistRecord>(),
    d1
      .prepare(
        `SELECT c.id, c.name, c.audience, c.status, c.scheduled_for AS scheduledFor, c.created_at AS createdAt, COUNT(r.id) AS recipients, SUM(CASE WHEN r.status = 'sent' THEN 1 ELSE 0 END) AS sent FROM campaigns c LEFT JOIN campaign_recipients r ON r.campaign_id = c.id AND r.clinic_id = c.clinic_id WHERE c.clinic_id = ? GROUP BY c.id ORDER BY c.created_at DESC LIMIT 24`,
      )
      .bind(clinicId)
      .all<CampaignRecord>(),
    d1
      .prepare(
        `SELECT dr.id, dr.appointment_id AS appointmentId, p.full_name AS patientName, COALESCE(s.name, 'Servicio') AS serviceName, a.starts_at AS startsAt, dr.amount_cents AS amountCents, dr.currency, dr.status, dr.reference, dr.requested_at AS requestedAt, dr.paid_at AS paidAt FROM deposit_requests dr JOIN appointments a ON a.id = dr.appointment_id AND a.clinic_id = dr.clinic_id LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN services s ON s.id = a.service_id WHERE dr.clinic_id = ? ORDER BY dr.requested_at DESC LIMIT 50`,
      )
      .bind(clinicId)
      .all<DepositRecord>(),
    d1
      .prepare(
        `SELECT id, patient_id AS patientId, kind, title, details, entity_id AS entityId, created_at AS createdAt FROM patient_events WHERE clinic_id = ? ORDER BY created_at DESC LIMIT 250`,
      )
      .bind(clinicId)
      .all<PatientEventRecord>(),
    d1
      .prepare(
        `SELECT id, kind, title, body, read_at AS readAt, created_at AS createdAt FROM staff_notifications WHERE clinic_id = ? ORDER BY created_at DESC LIMIT 30`,
      )
      .bind(clinicId)
      .all<NotificationRecord>(),
    d1
      .prepare(
        `SELECT COUNT(*) AS pending FROM scheduled_messages WHERE clinic_id = ? AND status = 'pending'`,
      )
      .bind(clinicId)
      .first<{ pending: number }>(),
    d1
      .prepare(
        `SELECT COUNT(*) AS sent, SUM(CASE WHEN status = 'responded' THEN 1 ELSE 0 END) AS answered, AVG(CASE WHEN score IS NOT NULL THEN score END) AS averageScore FROM surveys WHERE clinic_id = ?`,
      )
      .bind(clinicId)
      .first<{
        sent: number;
        answered: number;
        averageScore: number | null;
      }>(),
    d1
      .prepare(
        `SELECT id, name, address, phone, active FROM locations WHERE clinic_id = ? ORDER BY active DESC, name`,
      )
      .bind(clinicId)
      .all<LocationRecord>(),
  ]);

  if (!clinic)
    throw new Error('No fue posible cargar la organización seleccionada.');

  const messagesByConversation = new Map<string, MessageRecord[]>();
  for (const message of messages.results) {
    const current = messagesByConversation.get(message.conversationId) ?? [];
    current.push(message);
    messagesByConversation.set(message.conversationId, current);
  }
  const currentMember = saas.members.find(
    (member) => member.userId === saas.user.userId,
  );
  const restrictLocations =
    !saas.isPlatformAdmin &&
    !['owner', 'admin'].includes(saas.activeOrganization?.role ?? '');
  const allowedLocationIds = new Set(currentMember?.locationIds ?? []);
  const visibleLocations = restrictLocations
    ? locations.results.filter((location) => allowedLocationIds.has(location.id))
    : locations.results;
  const visibleAppointments = restrictLocations
    ? appointments.results.filter(
        (appointment) =>
          appointment.locationId && allowedLocationIds.has(appointment.locationId),
      )
    : appointments.results;
  const visibleConversations = restrictLocations
    ? conversations.results.filter(
        (conversation) =>
          conversation.locationId && allowedLocationIds.has(conversation.locationId),
      )
    : conversations.results;

  return {
    clinic,
    doctors: doctors.results
      .map(({ locationIdsCsv, ...doctor }) => ({
        ...doctor,
        locationIds: locationIdsCsv ? locationIdsCsv.split(',') : [],
      }))
      .filter(
        (doctor) =>
          !restrictLocations ||
          doctor.locationIds.some((locationId) => allowedLocationIds.has(locationId)),
      ),
    services: services.results,
    patients: patients.results,
    appointments: visibleAppointments,
    conversations: visibleConversations.map((conversation) => ({
      ...conversation,
      messages: messagesByConversation.get(conversation.id) ?? [],
    })),
    faqs: faqs.results,
    integration: {
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      whatsappConfigured: saas.integrations.some(
        (item) => item.provider === 'whatsapp' && item.status === 'connected',
      ),
      googleCalendarConfigured: saas.integrations.some(
        (item) =>
          item.provider === 'google_calendar' && item.status === 'connected',
      ),
      metaEmbeddedSignup: {
        appId: process.env.META_APP_ID ?? null,
        configId: process.env.META_CONFIG_ID ?? null,
        ready: Boolean(
          process.env.META_APP_ID &&
          process.env.META_CONFIG_ID &&
          process.env.META_APP_SECRET &&
          googleSecretManagerConfigured(),
        ),
        secretStorageReady: googleSecretManagerConfigured(),
      },
      invitationEmailReady: Boolean(
        process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.PUBLIC_APP_URL,
      ),
      mode: process.env.GEMINI_API_KEY ? 'production' : 'demo',
    },
    commercial: {
      automationRules: automationRules.results,
      waitlist: waitlist.results,
      campaigns: campaigns.results,
      deposits: deposits.results,
      patientEvents: patientEvents.results,
      notifications: notifications.results,
      scheduledPending: scheduledSummary?.pending ?? 0,
      surveysSent: surveySummary?.sent ?? 0,
      surveysAnswered: surveySummary?.answered ?? 0,
      averageScore: surveySummary?.averageScore ?? null,
    },
    locations: visibleLocations,
    saas,
  };
}

export async function getActiveServices(
  clinicId: string,
): Promise<ServiceRecord[]> {
  await ensureDatabase();
  const result = await env.DB.prepare(
    'SELECT id, name, category, description, duration_minutes AS durationMinutes, price_cents AS priceCents, active FROM services WHERE clinic_id = ? AND active = 1 ORDER BY name',
  )
    .bind(clinicId)
    .all<ServiceRecord>();
  return result.results;
}

export async function getAvailableSlots(
  clinicId: string,
  date: string,
  doctorId?: string,
  serviceId?: string,
): Promise<string[]> {
  await ensureDatabase();
  const clinic = await env.DB.prepare(
    'SELECT timezone FROM clinics WHERE id = ?',
  )
    .bind(clinicId)
    .first<{ timezone: string }>();
  if (!clinic || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const doctor = doctorId
    ? await env.DB.prepare(
        `SELECT id FROM doctors WHERE id = ? AND clinic_id = ? AND active = 1`,
      )
        .bind(doctorId, clinicId)
        .first<{ id: string }>()
    : await env.DB.prepare(
        `SELECT id FROM doctors WHERE clinic_id = ? AND active = 1 ORDER BY name LIMIT 1`,
      )
        .bind(clinicId)
        .first<{ id: string }>();
  if (!doctor) return [];
  const doctorHours = await env.DB.prepare(
    `SELECT opens_at AS opensAt, closes_at AS closesAt, NULL AS breakStart, NULL AS breakEnd, active FROM doctor_hours WHERE clinic_id = ? AND doctor_id = ? AND day_of_week = ? AND active = 1 ORDER BY opens_at LIMIT 1`,
  )
    .bind(clinicId, doctor.id, dayOfWeek)
    .first<{
      opensAt: string;
      closesAt: string;
      breakStart: string | null;
      breakEnd: string | null;
      active: number;
    }>();
  const hours =
    doctorHours ??
    (await env.DB.prepare(
      'SELECT opens_at AS opensAt, closes_at AS closesAt, break_start AS breakStart, break_end AS breakEnd, active FROM business_hours WHERE clinic_id = ? AND day_of_week = ? AND active = 1 ORDER BY opens_at LIMIT 1',
    )
      .bind(clinicId, dayOfWeek)
      .first<{
        opensAt: string;
        closesAt: string;
        breakStart: string | null;
        breakEnd: string | null;
        active: number;
      }>());
  if (!hours) return [];
  const service = serviceId
    ? await env.DB.prepare(
        `SELECT duration_minutes AS durationMinutes FROM services WHERE id = ? AND clinic_id = ? AND active = 1`,
      )
        .bind(serviceId, clinicId)
        .first<{ durationMinutes: number }>()
    : null;
  const durationMinutes = Math.max(service?.durationMinutes ?? 30, 10);
  const dayStart = zonedLocalToUtc(
    date,
    '00:00',
    clinic.timezone,
  ).toISOString();
  const nextDate = new Date(`${date}T12:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const dayEnd = zonedLocalToUtc(
    nextDate.toISOString().slice(0, 10),
    '00:00',
    clinic.timezone,
  ).toISOString();
  const query = env.DB.prepare(
    `SELECT starts_at AS startsAt, ends_at AS endsAt FROM appointments WHERE clinic_id = ? AND doctor_id = ? AND starts_at >= ? AND starts_at < ? AND status NOT IN ('cancelled', 'no_show')`,
  ).bind(clinicId, doctor.id, dayStart, dayEnd);
  const busy = await query.all<{ startsAt: string; endsAt: string }>();
  const slots: string[] = [];
  const opening = zonedLocalToUtc(
    date,
    hours.opensAt,
    clinic.timezone,
  ).getTime();
  const closing = zonedLocalToUtc(
    date,
    hours.closesAt,
    clinic.timezone,
  ).getTime();
  const breakStart = hours.breakStart
    ? zonedLocalToUtc(date, hours.breakStart, clinic.timezone).getTime()
    : null;
  const breakEnd = hours.breakEnd
    ? zonedLocalToUtc(date, hours.breakEnd, clinic.timezone).getTime()
    : null;
  for (
    let value = opening;
    value + durationMinutes * 60_000 <= closing;
    value += 30 * 60_000
  ) {
    const slotEnd = value + durationMinutes * 60_000;
    const insideBreak =
      breakStart !== null &&
      breakEnd !== null &&
      value < breakEnd &&
      slotEnd > breakStart;
    const occupied = busy.results.some(
      (item) =>
        value < new Date(item.endsAt).getTime() &&
        slotEnd > new Date(item.startsAt).getTime(),
    );
    if (!insideBreak && !occupied) {
      slots.push(new Date(value).toISOString());
    }
  }
  return slots.slice(0, 6);
}

function zonedLocalToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
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
