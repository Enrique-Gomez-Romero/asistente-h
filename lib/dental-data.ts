import { env } from 'cloudflare:workers';

import { ensureDatabase } from '@/db/initialize';
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
  createdAt: string;
  appointmentCount: number;
};

export type AppointmentRecord = {
  id: string;
  patientId: string | null;
  patientName: string;
  patientPhone: string | null;
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
  createdAt: string;
};

export type ConversationRecord = {
  id: string;
  patientId: string | null;
  patientName: string;
  patientPhone: string | null;
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

export type DashboardData = {
  clinic: ClinicRecord;
  doctors: DoctorRecord[];
  services: ServiceRecord[];
  patients: PatientRecord[];
  appointments: AppointmentRecord[];
  conversations: ConversationRecord[];
  faqs: FaqRecord[];
  integration: {
    openAiConfigured: boolean;
    whatsappConfigured: boolean;
    mode: 'demo' | 'production';
  };
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
  ] = await Promise.all([
    d1
      .prepare(
        'SELECT id, name, timezone, phone, address, currency FROM clinics WHERE id = ?',
      )
      .bind(clinicId)
      .first<ClinicRecord>(),
    d1
      .prepare(
        'SELECT id, name, email, specialty, color, active FROM doctors WHERE clinic_id = ? ORDER BY name',
      )
      .bind(clinicId)
      .all<DoctorRecord>(),
    d1
      .prepare(
        'SELECT id, name, category, description, duration_minutes AS durationMinutes, price_cents AS priceCents, active FROM services WHERE clinic_id = ? ORDER BY active DESC, name',
      )
      .bind(clinicId)
      .all<ServiceRecord>(),
    d1
      .prepare(
        'SELECT p.id, p.full_name AS fullName, p.phone, p.email, p.notes, p.last_visit_at AS lastVisitAt, p.created_at AS createdAt, COUNT(a.id) AS appointmentCount FROM patients p LEFT JOIN appointments a ON a.patient_id = p.id WHERE p.clinic_id = ? GROUP BY p.id ORDER BY p.full_name',
      )
      .bind(clinicId)
      .all<PatientRecord>(),
    d1
      .prepare(
        `SELECT a.id, a.patient_id AS patientId, COALESCE(p.full_name, 'Horario bloqueado') AS patientName, p.phone AS patientPhone, a.doctor_id AS doctorId, d.name AS doctorName, d.color AS doctorColor, a.service_id AS serviceId, COALESCE(s.name, 'Bloqueo de agenda') AS serviceName, a.starts_at AS startsAt, a.ends_at AS endsAt, a.status, a.source, a.notes FROM appointments a JOIN doctors d ON d.id = a.doctor_id LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN services s ON s.id = a.service_id WHERE a.clinic_id = ? ORDER BY a.starts_at`,
      )
      .bind(clinicId)
      .all<AppointmentRecord>(),
    d1
      .prepare(
        `SELECT c.id, c.patient_id AS patientId, COALESCE(p.full_name, 'Paciente nuevo') AS patientName, p.phone AS patientPhone, c.status, c.assigned_to AS assignedTo, c.bot_paused AS botPaused, c.unread_count AS unreadCount, c.last_message_at AS lastMessageAt, COALESCE((SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1), '') AS lastMessage FROM conversations c LEFT JOIN patients p ON p.id = c.patient_id WHERE c.clinic_id = ? ORDER BY c.last_message_at DESC`,
      )
      .bind(clinicId)
      .all<Omit<ConversationRecord, 'messages'>>(),
    d1
      .prepare(
        `SELECT m.id, m.conversation_id AS conversationId, m.direction, m.author_type AS authorType, m.body, m.created_at AS createdAt FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.clinic_id = ? ORDER BY m.created_at`,
      )
      .bind(clinicId)
      .all<MessageRecord>(),
    d1
      .prepare(
        'SELECT id, question, answer, active FROM faq_items WHERE clinic_id = ? ORDER BY question',
      )
      .bind(clinicId)
      .all<FaqRecord>(),
  ]);

  if (!clinic)
    throw new Error('No fue posible cargar la organización seleccionada.');

  const messagesByConversation = new Map<string, MessageRecord[]>();
  for (const message of messages.results) {
    const current = messagesByConversation.get(message.conversationId) ?? [];
    current.push(message);
    messagesByConversation.set(message.conversationId, current);
  }

  return {
    clinic,
    doctors: doctors.results,
    services: services.results,
    patients: patients.results,
    appointments: appointments.results,
    conversations: conversations.results.map((conversation) => ({
      ...conversation,
      messages: messagesByConversation.get(conversation.id) ?? [],
    })),
    faqs: faqs.results,
    integration: {
      openAiConfigured: saas.integrations.some(
        (item) => item.provider === 'openai' && item.status === 'connected',
      ),
      whatsappConfigured: saas.integrations.some(
        (item) => item.provider === 'whatsapp' && item.status === 'connected',
      ),
      mode:
        process.env.OPENAI_API_KEY && process.env.WHATSAPP_ACCESS_TOKEN
          ? 'production'
          : 'demo',
    },
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
): Promise<string[]> {
  await ensureDatabase();
  const clinic = await env.DB.prepare(
    'SELECT timezone FROM clinics WHERE id = ?',
  )
    .bind(clinicId)
    .first<{ timezone: string }>();
  if (!clinic || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const hours = await env.DB.prepare(
    'SELECT opens_at AS opensAt, closes_at AS closesAt, break_start AS breakStart, break_end AS breakEnd, active FROM business_hours WHERE clinic_id = ? AND day_of_week = ? AND active = 1 ORDER BY opens_at LIMIT 1',
  )
    .bind(clinicId, dayOfWeek)
    .first<{
      opensAt: string;
      closesAt: string;
      breakStart: string | null;
      breakEnd: string | null;
      active: number;
    }>();
  if (!hours) return [];
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
  const query = doctorId
    ? env.DB.prepare(
        `SELECT starts_at AS startsAt, ends_at AS endsAt FROM appointments WHERE clinic_id = ? AND doctor_id = ? AND starts_at >= ? AND starts_at < ? AND status NOT IN ('cancelled', 'no_show')`,
      ).bind(clinicId, doctorId, dayStart, dayEnd)
    : env.DB.prepare(
        `SELECT starts_at AS startsAt, ends_at AS endsAt FROM appointments WHERE clinic_id = ? AND starts_at >= ? AND starts_at < ? AND status NOT IN ('cancelled', 'no_show')`,
      ).bind(clinicId, dayStart, dayEnd);
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
    value + 30 * 60_000 <= closing;
    value += 30 * 60_000
  ) {
    const slotEnd = value + 30 * 60_000;
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
