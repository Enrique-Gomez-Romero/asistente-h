import { env } from 'cloudflare:workers';

let initialization: Promise<void> | null = null;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS clinics (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'America/Mexico_City', phone TEXT, address TEXT, currency TEXT NOT NULL DEFAULT 'MXN', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS doctors (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), name TEXT NOT NULL, email TEXT, specialty TEXT, color TEXT NOT NULL DEFAULT '#2e9b7f', active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), name TEXT NOT NULL, category TEXT NOT NULL, description TEXT, duration_minutes INTEGER NOT NULL, price_cents INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), full_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, notes TEXT, last_visit_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT REFERENCES patients(id), doctor_id TEXT NOT NULL REFERENCES doctors(id), service_id TEXT REFERENCES services(id), starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual', notes TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT REFERENCES patients(id), channel TEXT NOT NULL DEFAULT 'whatsapp', status TEXT NOT NULL DEFAULT 'open', assigned_to TEXT, bot_paused INTEGER NOT NULL DEFAULT 0, unread_count INTEGER NOT NULL DEFAULT 0, last_message_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY NOT NULL, conversation_id TEXT NOT NULL REFERENCES conversations(id), direction TEXT NOT NULL, author_type TEXT NOT NULL, body TEXT NOT NULL, external_id TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS faq_items (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), question TEXT NOT NULL, answer TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), actor TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_doctors_clinic_id ON doctors(clinic_id)`,
  `CREATE INDEX IF NOT EXISTS idx_services_clinic_active ON services(clinic_id, active)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_clinic_phone ON patients(clinic_id, phone)`,
  `CREATE INDEX IF NOT EXISTS idx_patients_clinic_name ON patients(clinic_id, full_name)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_clinic_starts_at ON appointments(clinic_id, starts_at)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_doctor_starts_at ON appointments(doctor_id, starts_at)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_clinic_last_message ON conversations(clinic_id, last_message_at)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_faq_clinic_active ON faq_items(clinic_id, active)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_clinic_created ON audit_logs(clinic_id, created_at)`,
];

export function ensureDatabase(): Promise<void> {
  initialization ??= initializeDatabase();
  return initialization;
}

async function initializeDatabase(): Promise<void> {
  const d1 = env.DB;
  await d1.batch(schemaStatements.map((statement) => d1.prepare(statement)));
  const existing = await d1.prepare('SELECT id FROM clinics LIMIT 1').first<{ id: string }>();
  if (existing) return;

  const inserts = [
    d1.prepare('INSERT INTO clinics (id, name, timezone, phone, address, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('clinic_demo', 'Clínica Sonrisa', 'America/Mexico_City', '+52 55 1234 5678', 'Av. Reforma 120, Ciudad de México', 'MXN', '2026-08-01T15:00:00.000Z'),
    d1.prepare('INSERT INTO doctors (id, clinic_id, name, email, specialty, color, active) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('doctor_renata', 'clinic_demo', 'Dra. Renata Díaz', 'renata@clinicasonrisa.mx', 'Odontología general', '#2e9b7f', 1),
    d1.prepare('INSERT INTO doctors (id, clinic_id, name, email, specialty, color, active) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('doctor_mateo', 'clinic_demo', 'Dr. Mateo Silva', 'mateo@clinicasonrisa.mx', 'Ortodoncia', '#6474c6', 1),
    d1.prepare('INSERT INTO services (id, clinic_id, name, category, description, duration_minutes, price_cents, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind('service_cleaning', 'clinic_demo', 'Limpieza dental', 'Prevención', 'Profilaxis y eliminación de sarro superficial.', 45, 85000, 1),
    d1.prepare('INSERT INTO services (id, clinic_id, name, category, description, duration_minutes, price_cents, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind('service_checkup', 'clinic_demo', 'Revisión general', 'Diagnóstico', 'Valoración inicial y plan de tratamiento.', 30, 50000, 1),
    d1.prepare('INSERT INTO services (id, clinic_id, name, category, description, duration_minutes, price_cents, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind('service_ortho', 'clinic_demo', 'Valoración de ortodoncia', 'Ortodoncia', 'Evaluación de alineación, mordida y opciones de tratamiento.', 60, 70000, 1),
    d1.prepare('INSERT INTO services (id, clinic_id, name, category, description, duration_minutes, price_cents, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind('service_whitening', 'clinic_demo', 'Blanqueamiento', 'Estética', 'Sesión de blanqueamiento dental en consultorio.', 90, 280000, 1),
    d1.prepare('INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind('patient_mariana', 'clinic_demo', 'Mariana López', '+52 55 1001 1001', 'mariana@example.com', null, '2026-02-15T17:00:00.000Z', '2026-02-01T17:00:00.000Z'),
    d1.prepare('INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind('patient_carlos', 'clinic_demo', 'Carlos Méndez', '+52 55 1002 1002', 'carlos@example.com', 'Interesado en alineadores.', null, '2026-08-30T16:00:00.000Z'),
    d1.prepare('INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind('patient_ana', 'clinic_demo', 'Ana Torres', '+52 55 1003 1003', 'ana@example.com', null, '2025-12-10T18:00:00.000Z', '2025-11-25T18:00:00.000Z'),
    d1.prepare('INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind('patient_luis', 'clinic_demo', 'Luis Hernández', '+52 55 1004 1004', null, 'Prefiere horarios por la tarde.', '2026-07-20T22:00:00.000Z', '2026-06-08T18:00:00.000Z'),
    d1.prepare('INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, starts_at, ends_at, status, source, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('appt_1', 'clinic_demo', 'patient_mariana', 'doctor_renata', 'service_cleaning', '2026-08-31T15:00:00.000Z', '2026-08-31T15:45:00.000Z', 'confirmed', 'whatsapp', null, '2026-08-29T18:00:00.000Z'),
    d1.prepare('INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, starts_at, ends_at, status, source, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('appt_2', 'clinic_demo', 'patient_carlos', 'doctor_mateo', 'service_ortho', '2026-08-31T16:30:00.000Z', '2026-08-31T17:30:00.000Z', 'pending', 'whatsapp', 'Primera valoración.', '2026-08-30T17:00:00.000Z'),
    d1.prepare('INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, starts_at, ends_at, status, source, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('appt_3', 'clinic_demo', 'patient_ana', 'doctor_renata', 'service_checkup', '2026-08-31T18:00:00.000Z', '2026-08-31T18:30:00.000Z', 'confirmed', 'manual', null, '2026-08-28T19:00:00.000Z'),
    d1.prepare('INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, starts_at, ends_at, status, source, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('appt_4', 'clinic_demo', 'patient_luis', 'doctor_renata', 'service_whitening', '2026-08-31T21:00:00.000Z', '2026-08-31T22:30:00.000Z', 'confirmed', 'whatsapp', null, '2026-08-30T20:00:00.000Z'),
    d1.prepare('INSERT INTO conversations (id, clinic_id, patient_id, channel, status, assigned_to, bot_paused, unread_count, last_message_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('conv_mariana', 'clinic_demo', 'patient_mariana', 'whatsapp', 'open', null, 0, 0, '2026-08-31T14:40:00.000Z'),
    d1.prepare('INSERT INTO conversations (id, clinic_id, patient_id, channel, status, assigned_to, bot_paused, unread_count, last_message_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('conv_carlos', 'clinic_demo', 'patient_carlos', 'whatsapp', 'open', null, 0, 2, '2026-08-31T14:52:00.000Z'),
    d1.prepare('INSERT INTO conversations (id, clinic_id, patient_id, channel, status, assigned_to, bot_paused, unread_count, last_message_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('conv_ana', 'clinic_demo', 'patient_ana', 'whatsapp', 'open', 'Dra. Renata', 1, 1, '2026-08-31T14:45:00.000Z'),
    d1.prepare('INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('msg_1', 'conv_mariana', 'inbound', 'patient', 'Hola, ¿cuánto cuesta una limpieza y tienen horario mañana?', null, '2026-08-31T14:38:00.000Z'),
    d1.prepare('INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('msg_2', 'conv_mariana', 'outbound', 'assistant', 'La limpieza tiene un costo de $850. Mañana tenemos disponibilidad a las 10:30 y 12:00. ¿Cuál horario prefieres?', null, '2026-08-31T14:38:05.000Z'),
    d1.prepare('INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('msg_3', 'conv_mariana', 'inbound', 'patient', 'A las 10:30, por favor.', null, '2026-08-31T14:39:00.000Z'),
    d1.prepare('INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('msg_4', 'conv_mariana', 'outbound', 'assistant', 'Perfecto, Mariana. Tu cita quedó confirmada. Te enviaremos un recordatorio un día antes.', null, '2026-08-31T14:40:00.000Z'),
    d1.prepare('INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('msg_5', 'conv_carlos', 'inbound', 'patient', '¿La valoración de ortodoncia incluye radiografías?', null, '2026-08-31T14:52:00.000Z'),
    d1.prepare('INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('msg_6', 'conv_ana', 'inbound', 'patient', 'Necesito cambiar mi cita, ¿me puede ayudar alguien?', null, '2026-08-31T14:45:00.000Z'),
    d1.prepare('INSERT INTO faq_items (id, clinic_id, question, answer, active) VALUES (?, ?, ?, ?, ?)').bind('faq_1', 'clinic_demo', '¿Aceptan tarjeta?', 'Sí, aceptamos tarjetas de crédito, débito y transferencias.', 1),
    d1.prepare('INSERT INTO faq_items (id, clinic_id, question, answer, active) VALUES (?, ?, ?, ?, ?)').bind('faq_2', 'clinic_demo', '¿Dónde están ubicados?', 'Estamos en Av. Reforma 120, Ciudad de México.', 1),
    d1.prepare('INSERT INTO faq_items (id, clinic_id, question, answer, active) VALUES (?, ?, ?, ?, ?)').bind('faq_3', 'clinic_demo', '¿Atienden urgencias?', 'Evaluamos urgencias dentales durante el horario de atención. Si existe sangrado severo, dificultad para respirar o un traumatismo importante, busca atención de emergencia inmediata.', 1),
  ];

  await d1.batch(inserts);
  await d1.prepare('PRAGMA optimize').run();
}
