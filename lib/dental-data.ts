import { env } from 'cloudflare:workers';

import { ensureDatabase } from '@/db/initialize';

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
};

export async function getDashboardData(): Promise<DashboardData> {
  await ensureDatabase();
  const d1 = env.DB;

  const [clinic, doctors, services, patients, appointments, conversations, messages, faqs] = await Promise.all([
    d1.prepare(`SELECT id, name, timezone, phone, address, currency FROM clinics WHERE id = 'clinic_demo'`).first<ClinicRecord>(),
    d1.prepare(`SELECT id, name, email, specialty, color, active FROM doctors WHERE clinic_id = 'clinic_demo' ORDER BY name`).all<DoctorRecord>(),
    d1.prepare(`SELECT id, name, category, description, duration_minutes AS durationMinutes, price_cents AS priceCents, active FROM services WHERE clinic_id = 'clinic_demo' ORDER BY active DESC, name`).all<ServiceRecord>(),
    d1.prepare(`SELECT p.id, p.full_name AS fullName, p.phone, p.email, p.notes, p.last_visit_at AS lastVisitAt, p.created_at AS createdAt, COUNT(a.id) AS appointmentCount FROM patients p LEFT JOIN appointments a ON a.patient_id = p.id WHERE p.clinic_id = 'clinic_demo' GROUP BY p.id ORDER BY p.full_name`).all<PatientRecord>(),
    d1.prepare(`SELECT a.id, a.patient_id AS patientId, COALESCE(p.full_name, 'Horario bloqueado') AS patientName, p.phone AS patientPhone, a.doctor_id AS doctorId, d.name AS doctorName, d.color AS doctorColor, a.service_id AS serviceId, COALESCE(s.name, 'Bloqueo de agenda') AS serviceName, a.starts_at AS startsAt, a.ends_at AS endsAt, a.status, a.source, a.notes FROM appointments a JOIN doctors d ON d.id = a.doctor_id LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN services s ON s.id = a.service_id WHERE a.clinic_id = 'clinic_demo' ORDER BY a.starts_at`).all<AppointmentRecord>(),
    d1.prepare(`SELECT c.id, c.patient_id AS patientId, COALESCE(p.full_name, 'Paciente nuevo') AS patientName, p.phone AS patientPhone, c.status, c.assigned_to AS assignedTo, c.bot_paused AS botPaused, c.unread_count AS unreadCount, c.last_message_at AS lastMessageAt, COALESCE((SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1), '') AS lastMessage FROM conversations c LEFT JOIN patients p ON p.id = c.patient_id WHERE c.clinic_id = 'clinic_demo' ORDER BY c.last_message_at DESC`).all<Omit<ConversationRecord, 'messages'>>(),
    d1.prepare(`SELECT id, conversation_id AS conversationId, direction, author_type AS authorType, body, created_at AS createdAt FROM messages ORDER BY created_at`).all<MessageRecord>(),
    d1.prepare(`SELECT id, question, answer, active FROM faq_items WHERE clinic_id = 'clinic_demo' ORDER BY question`).all<FaqRecord>(),
  ]);

  if (!clinic) throw new Error('No fue posible inicializar la clínica de demostración.');

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
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
      whatsappConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      mode: process.env.OPENAI_API_KEY && process.env.WHATSAPP_ACCESS_TOKEN ? 'production' : 'demo',
    },
  };
}

export async function getActiveServices(): Promise<ServiceRecord[]> {
  await ensureDatabase();
  const result = await env.DB.prepare(`SELECT id, name, category, description, duration_minutes AS durationMinutes, price_cents AS priceCents, active FROM services WHERE clinic_id = 'clinic_demo' AND active = 1 ORDER BY name`).all<ServiceRecord>();
  return result.results;
}

export async function getAvailableSlots(date: string, doctorId?: string): Promise<string[]> {
  await ensureDatabase();
  const start = `${date}T06:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const query = doctorId
    ? env.DB.prepare(`SELECT starts_at AS startsAt, ends_at AS endsAt FROM appointments WHERE doctor_id = ? AND starts_at BETWEEN ? AND ? AND status NOT IN ('cancelled', 'no_show')`).bind(doctorId, start, end)
    : env.DB.prepare(`SELECT starts_at AS startsAt, ends_at AS endsAt FROM appointments WHERE clinic_id = 'clinic_demo' AND starts_at BETWEEN ? AND ? AND status NOT IN ('cancelled', 'no_show')`).bind(start, end);
  const busy = await query.all<{ startsAt: string; endsAt: string }>();
  const occupied = busy.results.map((item) => new Date(item.startsAt).getTime());
  const slots: string[] = [];
  const [year, month, day] = date.split('-').map(Number);
  for (const hour of [9, 10, 11, 12, 15, 16, 17, 18]) {
    for (const minute of [0, 30]) {
      const candidate = new Date(Date.UTC(year, month - 1, day, hour + 6, minute));
      if (!occupied.some((value) => Math.abs(value - candidate.getTime()) < 30 * 60 * 1000)) {
        slots.push(candidate.toISOString());
      }
    }
  }
  return slots.slice(0, 6);
}
