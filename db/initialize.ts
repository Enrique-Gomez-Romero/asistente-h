import { env } from 'cloudflare:workers';

let initialization: Promise<void> | null = null;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS clinics (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'America/Mexico_City', phone TEXT, address TEXT, currency TEXT NOT NULL DEFAULT 'MXN', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS doctors (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), name TEXT NOT NULL, email TEXT, specialty TEXT, color TEXT NOT NULL DEFAULT '#2e9b7f', active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), name TEXT NOT NULL, category TEXT NOT NULL, description TEXT, duration_minutes INTEGER NOT NULL, price_cents INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), full_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, notes TEXT, last_visit_at TEXT, marketing_opt_in INTEGER NOT NULL DEFAULT 0, consent_at TEXT, consent_source TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT REFERENCES patients(id), doctor_id TEXT NOT NULL REFERENCES doctors(id), service_id TEXT REFERENCES services(id), starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual', notes TEXT, google_event_id TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT REFERENCES patients(id), channel TEXT NOT NULL DEFAULT 'whatsapp', status TEXT NOT NULL DEFAULT 'open', assigned_to TEXT, bot_paused INTEGER NOT NULL DEFAULT 0, unread_count INTEGER NOT NULL DEFAULT 0, pending_action TEXT, pending_payload TEXT, last_message_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY NOT NULL, conversation_id TEXT NOT NULL REFERENCES conversations(id), direction TEXT NOT NULL, author_type TEXT NOT NULL, body TEXT NOT NULL, external_id TEXT, delivery_status TEXT NOT NULL DEFAULT 'stored', last_error TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS faq_items (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), question TEXT NOT NULL, answer TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), actor TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS saas_users (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, full_name TEXT, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS auth_credentials (user_id TEXT PRIMARY KEY NOT NULL REFERENCES saas_users(id), password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, password_iterations INTEGER NOT NULL DEFAULT 210000, failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT, password_changed_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES saas_users(id), token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES saas_users(id), token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS memberships (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), user_id TEXT NOT NULL REFERENCES saas_users(id), role TEXT NOT NULL DEFAULT 'staff', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS platform_admins (user_id TEXT PRIMARY KEY NOT NULL REFERENCES saas_users(id), created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS organization_profiles (clinic_id TEXT PRIMARY KEY NOT NULL REFERENCES clinics(id), slug TEXT NOT NULL, business_type TEXT NOT NULL DEFAULT 'dental', vertical_template TEXT NOT NULL DEFAULT 'dental', brand_color TEXT NOT NULL DEFAULT '#2e9b7f', onboarding_status TEXT NOT NULL DEFAULT 'complete', updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS locations (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), name TEXT NOT NULL, address TEXT, timezone TEXT NOT NULL DEFAULT 'America/Mexico_City', phone TEXT, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS business_hours (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), location_id TEXT REFERENCES locations(id), day_of_week INTEGER NOT NULL, opens_at TEXT NOT NULL, closes_at TEXT NOT NULL, break_start TEXT, break_end TEXT, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS subscription_plans (id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, description TEXT, price_cents INTEGER, max_users INTEGER NOT NULL, max_locations INTEGER NOT NULL, max_conversations INTEGER NOT NULL, max_ai_requests INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), plan_id TEXT NOT NULL REFERENCES subscription_plans(id), status TEXT NOT NULL DEFAULT 'trialing', current_period_start TEXT NOT NULL, current_period_end TEXT NOT NULL, trial_ends_at TEXT, billing_provider TEXT, customer_reference TEXT, subscription_reference TEXT, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS integration_connections (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), provider TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', external_account_id TEXT, phone_number_id TEXT, secret_reference TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS usage_events (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), metric TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, source_id TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), email TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff', status TEXT NOT NULL DEFAULT 'pending', token_hash TEXT, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS organization_states (clinic_id TEXT PRIMARY KEY NOT NULL REFERENCES clinics(id), status TEXT NOT NULL DEFAULT 'active', suspended_at TEXT, suspension_reason TEXT, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS manual_payments (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'MXN', period_start TEXT NOT NULL, period_end TEXT NOT NULL, received_at TEXT NOT NULL, method TEXT NOT NULL DEFAULT 'bank_transfer', reference TEXT, invoice_folio TEXT, invoice_url TEXT, notes TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS subscription_events (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), action TEXT NOT NULL, previous_value TEXT, next_value TEXT, actor TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS doctor_locations (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), doctor_id TEXT NOT NULL REFERENCES doctors(id), location_id TEXT NOT NULL REFERENCES locations(id), active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS doctor_hours (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), doctor_id TEXT NOT NULL REFERENCES doctors(id), location_id TEXT REFERENCES locations(id), day_of_week INTEGER NOT NULL, opens_at TEXT NOT NULL, closes_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS waitlist_entries (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT NOT NULL REFERENCES patients(id), service_id TEXT REFERENCES services(id), doctor_id TEXT REFERENCES doctors(id), preferred_date_from TEXT, preferred_date_to TEXT, preferred_time TEXT, status TEXT NOT NULL DEFAULT 'waiting', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS automation_rules (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), kind TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, offset_minutes INTEGER NOT NULL DEFAULT 0, template TEXT NOT NULL, template_name TEXT, template_language TEXT NOT NULL DEFAULT 'es_MX', updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS scheduled_messages (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT REFERENCES patients(id), appointment_id TEXT REFERENCES appointments(id), campaign_id TEXT, kind TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'whatsapp', recipient TEXT NOT NULL, body TEXT NOT NULL, template_name TEXT, template_language TEXT NOT NULL DEFAULT 'es_MX', scheduled_for TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, processing_started_at TEXT, last_error TEXT, sent_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), name TEXT NOT NULL, audience TEXT NOT NULL DEFAULT 'inactive_patients', template TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', scheduled_for TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS campaign_recipients (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), campaign_id TEXT NOT NULL REFERENCES campaigns(id), patient_id TEXT NOT NULL REFERENCES patients(id), status TEXT NOT NULL DEFAULT 'queued', sent_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS surveys (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT NOT NULL REFERENCES patients(id), appointment_id TEXT REFERENCES appointments(id), score INTEGER, comment TEXT, status TEXT NOT NULL DEFAULT 'pending', sent_at TEXT, responded_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS staff_notifications (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), user_id TEXT REFERENCES saas_users(id), kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, entity_type TEXT, entity_id TEXT, read_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS deposit_requests (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), appointment_id TEXT NOT NULL REFERENCES appointments(id), amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'MXN', status TEXT NOT NULL DEFAULT 'requested', reference TEXT, requested_at TEXT NOT NULL, paid_at TEXT, verified_by TEXT)`,
  `CREATE TABLE IF NOT EXISTS patient_events (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT NOT NULL REFERENCES patients(id), kind TEXT NOT NULL, title TEXT NOT NULL, details TEXT, entity_id TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS support_sessions (id TEXT PRIMARY KEY NOT NULL, clinic_id TEXT NOT NULL REFERENCES clinics(id), platform_user_id TEXT NOT NULL REFERENCES saas_users(id), reason TEXT NOT NULL, started_at TEXT NOT NULL, expires_at TEXT NOT NULL, ended_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_doctors_clinic_id ON doctors(clinic_id)`,
  `CREATE INDEX IF NOT EXISTS idx_services_clinic_active ON services(clinic_id, active)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_clinic_phone ON patients(clinic_id, phone)`,
  `CREATE INDEX IF NOT EXISTS idx_patients_clinic_name ON patients(clinic_id, full_name)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_clinic_starts_at ON appointments(clinic_id, starts_at)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_doctor_starts_at ON appointments(doctor_id, starts_at)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_clinic_last_message ON conversations(clinic_id, last_message_at)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external_id ON messages(external_id)`,
  `CREATE INDEX IF NOT EXISTS idx_faq_clinic_active ON faq_items(clinic_id, active)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_clinic_created ON audit_logs(clinic_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_users_email ON saas_users(email)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_expires ON auth_sessions(user_id, expires_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_password_reset_user_expires ON password_reset_tokens(user_id, expires_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_clinic_user ON memberships(clinic_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_memberships_user_status ON memberships(user_id, status)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_profiles_slug ON organization_profiles(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_locations_clinic_active ON locations(clinic_id, active)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_business_hours_clinic_location_day ON business_hours(clinic_id, location_id, day_of_week)`,
  `CREATE INDEX IF NOT EXISTS idx_business_hours_clinic_day ON business_hours(clinic_id, day_of_week)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_clinic ON subscriptions(clinic_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_clinic_provider ON integration_connections(clinic_id, provider)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_phone_number_id ON integration_connections(phone_number_id)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_clinic_metric_created ON usage_events(clinic_id, metric, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_source ON usage_events(source_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invitations_clinic_status ON invitations(clinic_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_manual_payments_clinic_received ON manual_payments(clinic_id, received_at)`,
  `CREATE INDEX IF NOT EXISTS idx_subscription_events_clinic_created ON subscription_events(clinic_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_locations_unique ON doctor_locations(doctor_id, location_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_hours_doctor_location_day ON doctor_hours(doctor_id, location_id, day_of_week)`,
  `CREATE INDEX IF NOT EXISTS idx_doctor_hours_clinic_day ON doctor_hours(clinic_id, day_of_week)`,
  `CREATE INDEX IF NOT EXISTS idx_waitlist_clinic_status_created ON waitlist_entries(clinic_id, status, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_rules_clinic_kind ON automation_rules(clinic_id, kind)`,
  `CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status_time ON scheduled_messages(status, scheduled_for)`,
  `CREATE INDEX IF NOT EXISTS idx_campaigns_clinic_created ON campaigns(clinic_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_recipients_unique ON campaign_recipients(campaign_id, patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_surveys_clinic_status ON surveys(clinic_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_staff_notifications_clinic_created ON staff_notifications(clinic_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_requests_appointment ON deposit_requests(appointment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_patient_events_patient_created ON patient_events(patient_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_support_sessions_clinic_active ON support_sessions(clinic_id, ended_at)`,
];

export function ensureDatabase(): Promise<void> {
  initialization ??= initializeDatabase();
  return initialization;
}

async function initializeDatabase(): Promise<void> {
  const d1 = env.DB;
  await d1.batch(schemaStatements.map((statement) => d1.prepare(statement)));
  await ensureCompatibilityColumns(d1);
  const existing = await d1
    .prepare('SELECT id FROM clinics LIMIT 1')
    .first<{ id: string }>();
  if (!existing) {
    const inserts = [
      d1
        .prepare(
          'INSERT INTO clinics (id, name, timezone, phone, address, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'clinic_demo',
          'Clínica Sonrisa',
          'America/Mexico_City',
          '+52 55 1234 5678',
          'Av. Reforma 120, Ciudad de México',
          'MXN',
          '2026-08-01T15:00:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO doctors (id, clinic_id, name, email, specialty, color, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'doctor_renata',
          'clinic_demo',
          'Dra. Renata Díaz',
          'renata@clinicasonrisa.mx',
          'Odontología general',
          '#2e9b7f',
          1,
        ),
      d1
        .prepare(
          'INSERT INTO doctors (id, clinic_id, name, email, specialty, color, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'doctor_mateo',
          'clinic_demo',
          'Dr. Mateo Silva',
          'mateo@clinicasonrisa.mx',
          'Ortodoncia',
          '#6474c6',
          1,
        ),
      d1
        .prepare(
          'INSERT INTO services (id, clinic_id, name, category, description, duration_minutes, price_cents, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'service_cleaning',
          'clinic_demo',
          'Limpieza dental',
          'Prevención',
          'Profilaxis y eliminación de sarro superficial.',
          45,
          85000,
          1,
        ),
      d1
        .prepare(
          'INSERT INTO services (id, clinic_id, name, category, description, duration_minutes, price_cents, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'service_checkup',
          'clinic_demo',
          'Revisión general',
          'Diagnóstico',
          'Valoración inicial y plan de tratamiento.',
          30,
          50000,
          1,
        ),
      d1
        .prepare(
          'INSERT INTO services (id, clinic_id, name, category, description, duration_minutes, price_cents, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'service_ortho',
          'clinic_demo',
          'Valoración de ortodoncia',
          'Ortodoncia',
          'Evaluación de alineación, mordida y opciones de tratamiento.',
          60,
          70000,
          1,
        ),
      d1
        .prepare(
          'INSERT INTO services (id, clinic_id, name, category, description, duration_minutes, price_cents, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'service_whitening',
          'clinic_demo',
          'Blanqueamiento',
          'Estética',
          'Sesión de blanqueamiento dental en consultorio.',
          90,
          280000,
          1,
        ),
      d1
        .prepare(
          'INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'patient_mariana',
          'clinic_demo',
          'Mariana López',
          '+52 55 1001 1001',
          'mariana@example.com',
          null,
          '2026-02-15T17:00:00.000Z',
          '2026-02-01T17:00:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'patient_carlos',
          'clinic_demo',
          'Carlos Méndez',
          '+52 55 1002 1002',
          'carlos@example.com',
          'Interesado en alineadores.',
          null,
          '2026-08-30T16:00:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'patient_ana',
          'clinic_demo',
          'Ana Torres',
          '+52 55 1003 1003',
          'ana@example.com',
          null,
          '2025-12-10T18:00:00.000Z',
          '2025-11-25T18:00:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'patient_luis',
          'clinic_demo',
          'Luis Hernández',
          '+52 55 1004 1004',
          null,
          'Prefiere horarios por la tarde.',
          '2026-07-20T22:00:00.000Z',
          '2026-06-08T18:00:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, starts_at, ends_at, status, source, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'appt_1',
          'clinic_demo',
          'patient_mariana',
          'doctor_renata',
          'service_cleaning',
          '2026-08-31T15:00:00.000Z',
          '2026-08-31T15:45:00.000Z',
          'confirmed',
          'whatsapp',
          null,
          '2026-08-29T18:00:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, starts_at, ends_at, status, source, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'appt_2',
          'clinic_demo',
          'patient_carlos',
          'doctor_mateo',
          'service_ortho',
          '2026-08-31T16:30:00.000Z',
          '2026-08-31T17:30:00.000Z',
          'pending',
          'whatsapp',
          'Primera valoración.',
          '2026-08-30T17:00:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, starts_at, ends_at, status, source, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'appt_3',
          'clinic_demo',
          'patient_ana',
          'doctor_renata',
          'service_checkup',
          '2026-08-31T18:00:00.000Z',
          '2026-08-31T18:30:00.000Z',
          'confirmed',
          'manual',
          null,
          '2026-08-28T19:00:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, starts_at, ends_at, status, source, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'appt_4',
          'clinic_demo',
          'patient_luis',
          'doctor_renata',
          'service_whitening',
          '2026-08-31T21:00:00.000Z',
          '2026-08-31T22:30:00.000Z',
          'confirmed',
          'whatsapp',
          null,
          '2026-08-30T20:00:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO conversations (id, clinic_id, patient_id, channel, status, assigned_to, bot_paused, unread_count, last_message_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'conv_mariana',
          'clinic_demo',
          'patient_mariana',
          'whatsapp',
          'open',
          null,
          0,
          0,
          '2026-08-31T14:40:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO conversations (id, clinic_id, patient_id, channel, status, assigned_to, bot_paused, unread_count, last_message_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'conv_carlos',
          'clinic_demo',
          'patient_carlos',
          'whatsapp',
          'open',
          null,
          0,
          2,
          '2026-08-31T14:52:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO conversations (id, clinic_id, patient_id, channel, status, assigned_to, bot_paused, unread_count, last_message_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'conv_ana',
          'clinic_demo',
          'patient_ana',
          'whatsapp',
          'open',
          'Dra. Renata',
          1,
          1,
          '2026-08-31T14:45:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'msg_1',
          'conv_mariana',
          'inbound',
          'patient',
          'Hola, ¿cuánto cuesta una limpieza y tienen horario mañana?',
          null,
          '2026-08-31T14:38:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'msg_2',
          'conv_mariana',
          'outbound',
          'assistant',
          'La limpieza tiene un costo de $850. Mañana tenemos disponibilidad a las 10:30 y 12:00. ¿Cuál horario prefieres?',
          null,
          '2026-08-31T14:38:05.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'msg_3',
          'conv_mariana',
          'inbound',
          'patient',
          'A las 10:30, por favor.',
          null,
          '2026-08-31T14:39:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'msg_4',
          'conv_mariana',
          'outbound',
          'assistant',
          'Perfecto, Mariana. Tu cita quedó confirmada. Te enviaremos un recordatorio un día antes.',
          null,
          '2026-08-31T14:40:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'msg_5',
          'conv_carlos',
          'inbound',
          'patient',
          '¿La valoración de ortodoncia incluye radiografías?',
          null,
          '2026-08-31T14:52:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          'msg_6',
          'conv_ana',
          'inbound',
          'patient',
          'Necesito cambiar mi cita, ¿me puede ayudar alguien?',
          null,
          '2026-08-31T14:45:00.000Z',
        ),
      d1
        .prepare(
          'INSERT INTO faq_items (id, clinic_id, question, answer, active) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(
          'faq_1',
          'clinic_demo',
          '¿Aceptan tarjeta?',
          'Sí, aceptamos tarjetas de crédito, débito y transferencias.',
          1,
        ),
      d1
        .prepare(
          'INSERT INTO faq_items (id, clinic_id, question, answer, active) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(
          'faq_2',
          'clinic_demo',
          '¿Dónde están ubicados?',
          'Estamos en Av. Reforma 120, Ciudad de México.',
          1,
        ),
      d1
        .prepare(
          'INSERT INTO faq_items (id, clinic_id, question, answer, active) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(
          'faq_3',
          'clinic_demo',
          '¿Atienden urgencias?',
          'Evaluamos urgencias dentales durante el horario de atención. Si existe sangrado severo, dificultad para respirar o un traumatismo importante, busca atención de emergencia inmediata.',
          1,
        ),
    ];
    await d1.batch(inserts);
  }

  await seedSaasData(d1);
  await d1.prepare('PRAGMA optimize').run();
}

async function ensureCompatibilityColumns(d1: typeof env.DB): Promise<void> {
  const additions: Record<string, Array<{ name: string; sql: string }>> = {
    appointments: [
      {
        name: 'google_event_id',
        sql: 'ALTER TABLE appointments ADD COLUMN google_event_id TEXT',
      },
    ],
    patients: [
      {
        name: 'marketing_opt_in',
        sql: 'ALTER TABLE patients ADD COLUMN marketing_opt_in INTEGER NOT NULL DEFAULT 0',
      },
      {
        name: 'consent_at',
        sql: 'ALTER TABLE patients ADD COLUMN consent_at TEXT',
      },
      {
        name: 'consent_source',
        sql: 'ALTER TABLE patients ADD COLUMN consent_source TEXT',
      },
    ],
    conversations: [
      {
        name: 'pending_action',
        sql: 'ALTER TABLE conversations ADD COLUMN pending_action TEXT',
      },
      {
        name: 'pending_payload',
        sql: 'ALTER TABLE conversations ADD COLUMN pending_payload TEXT',
      },
    ],
    messages: [
      {
        name: 'delivery_status',
        sql: "ALTER TABLE messages ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'stored'",
      },
      {
        name: 'last_error',
        sql: 'ALTER TABLE messages ADD COLUMN last_error TEXT',
      },
    ],
    automation_rules: [
      {
        name: 'template_name',
        sql: 'ALTER TABLE automation_rules ADD COLUMN template_name TEXT',
      },
      {
        name: 'template_language',
        sql: "ALTER TABLE automation_rules ADD COLUMN template_language TEXT NOT NULL DEFAULT 'es_MX'",
      },
    ],
    scheduled_messages: [
      {
        name: 'template_name',
        sql: 'ALTER TABLE scheduled_messages ADD COLUMN template_name TEXT',
      },
      {
        name: 'template_language',
        sql: "ALTER TABLE scheduled_messages ADD COLUMN template_language TEXT NOT NULL DEFAULT 'es_MX'",
      },
      {
        name: 'processing_started_at',
        sql: 'ALTER TABLE scheduled_messages ADD COLUMN processing_started_at TEXT',
      },
    ],
  };

  for (const [table, columns] of Object.entries(additions)) {
    const info = await d1
      .prepare(`PRAGMA table_info(${table})`)
      .all<{ name: string }>();
    const existing = new Set(info.results.map((column) => column.name));
    const missing = columns.filter((column) => !existing.has(column.name));
    if (missing.length)
      await d1.batch(missing.map((column) => d1.prepare(column.sql)));
  }
}

async function seedSaasData(d1: typeof env.DB): Promise<void> {
  const now = new Date().toISOString();
  const periodEnd = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const demoClinic = await d1
    .prepare(
      "SELECT id, name, timezone, phone, address FROM clinics WHERE id = 'clinic_demo'",
    )
    .first<{
      id: string;
      name: string;
      timezone: string;
      phone: string | null;
      address: string | null;
    }>();

  const statements = [
    d1.prepare(
      `INSERT OR IGNORE INTO subscription_plans (id, slug, name, description, price_cents, max_users, max_locations, max_conversations, max_ai_requests, active) VALUES ('plan_trial', 'trial', 'Prueba', 'Plan de evaluación para validar la operación.', 0, 3, 1, 300, 500, 1)`,
    ),
    d1.prepare(
      `INSERT OR IGNORE INTO subscription_plans (id, slug, name, description, price_cents, max_users, max_locations, max_conversations, max_ai_requests, active) VALUES ('plan_professional', 'professional', 'Profesional', 'Para negocios con un equipo y automatización continua.', NULL, 10, 3, 3000, 5000, 1)`,
    ),
    d1.prepare(
      `INSERT OR IGNORE INTO subscription_plans (id, slug, name, description, price_cents, max_users, max_locations, max_conversations, max_ai_requests, active) VALUES ('plan_scale', 'scale', 'Escala', 'Para varias sedes, equipos y mayor volumen.', NULL, 50, 20, 25000, 50000, 1)`,
    ),
  ];

  if (demoClinic) {
    statements.push(
      d1
        .prepare(
          `INSERT OR IGNORE INTO organization_profiles (clinic_id, slug, business_type, vertical_template, brand_color, onboarding_status, updated_at) VALUES ('clinic_demo', 'clinica-sonrisa', 'dental', 'dental', '#2e9b7f', 'complete', ?)`,
        )
        .bind(now),
      d1
        .prepare(
          `INSERT OR IGNORE INTO locations (id, clinic_id, name, address, timezone, phone, active) VALUES ('location_demo', 'clinic_demo', 'Consultorio principal', ?, ?, ?, 1)`,
        )
        .bind(demoClinic.address, demoClinic.timezone, demoClinic.phone),
      d1
        .prepare(
          `INSERT OR IGNORE INTO subscriptions (id, clinic_id, plan_id, status, current_period_start, current_period_end, trial_ends_at, billing_provider, customer_reference, subscription_reference, updated_at) VALUES ('subscription_demo', 'clinic_demo', 'plan_trial', 'trialing', ?, ?, ?, NULL, NULL, NULL, ?)`,
        )
        .bind(now, periodEnd, periodEnd, now),
      d1
        .prepare(
          `INSERT OR IGNORE INTO integration_connections (id, clinic_id, provider, status, external_account_id, phone_number_id, secret_reference, created_at, updated_at) VALUES ('integration_demo_whatsapp', 'clinic_demo', 'whatsapp', 'pending', NULL, NULL, NULL, ?, ?)`,
        )
        .bind(now, now),
      d1
        .prepare(
          `INSERT OR IGNORE INTO organization_states (clinic_id, status, suspended_at, suspension_reason, updated_at) VALUES ('clinic_demo', 'active', NULL, NULL, ?)`,
        )
        .bind(now),
      d1
        .prepare(
          `INSERT OR IGNORE INTO integration_connections (id, clinic_id, provider, status, external_account_id, phone_number_id, secret_reference, created_at, updated_at) VALUES ('integration_demo_google_calendar', 'clinic_demo', 'google_calendar', 'pending', NULL, NULL, NULL, ?, ?)`,
        )
        .bind(now, now),
      d1.prepare(
        `INSERT OR IGNORE INTO doctor_locations (id, clinic_id, doctor_id, location_id, active) VALUES ('doctor_location_renata', 'clinic_demo', 'doctor_renata', 'location_demo', 1)`,
      ),
      d1.prepare(
        `INSERT OR IGNORE INTO doctor_locations (id, clinic_id, doctor_id, location_id, active) VALUES ('doctor_location_mateo', 'clinic_demo', 'doctor_mateo', 'location_demo', 1)`,
      ),
      d1
        .prepare(
          `INSERT OR IGNORE INTO automation_rules (id, clinic_id, kind, enabled, offset_minutes, template, updated_at) VALUES ('automation_demo_reminder_24h', 'clinic_demo', 'reminder_24h', 1, -1440, 'Hola {{patient_name}}, te recordamos tu cita en {{business_name}} el {{appointment_date}}. Responde CONFIRMAR, CANCELAR o REPROGRAMAR.', ?)`,
        )
        .bind(now),
      d1
        .prepare(
          `INSERT OR IGNORE INTO automation_rules (id, clinic_id, kind, enabled, offset_minutes, template, updated_at) VALUES ('automation_demo_reminder_2h', 'clinic_demo', 'reminder_2h', 1, -120, 'Tu cita en {{business_name}} comienza en aproximadamente 2 horas. Si necesitas ayuda, responde a este mensaje.', ?)`,
        )
        .bind(now),
      d1
        .prepare(
          `INSERT OR IGNORE INTO automation_rules (id, clinic_id, kind, enabled, offset_minutes, template, updated_at) VALUES ('automation_demo_follow_up', 'clinic_demo', 'follow_up', 1, 1440, 'Hola {{patient_name}}, esperamos que tu atención en {{business_name}} haya salido muy bien. ¿Hay algo en lo que podamos ayudarte?', ?)`,
        )
        .bind(now),
      d1
        .prepare(
          `INSERT OR IGNORE INTO automation_rules (id, clinic_id, kind, enabled, offset_minutes, template, updated_at) VALUES ('automation_demo_survey', 'clinic_demo', 'survey', 1, 120, '¿Cómo calificarías tu experiencia en {{business_name}} del 1 al 5? Responde solo con un número.', ?)`,
        )
        .bind(now),
    );
    for (let day = 0; day <= 6; day += 1) {
      const saturday = day === 6;
      const sunday = day === 0;
      statements.push(
        d1
          .prepare(
            `INSERT OR IGNORE INTO business_hours (id, clinic_id, location_id, day_of_week, opens_at, closes_at, break_start, break_end, active) VALUES (?, 'clinic_demo', 'location_demo', ?, '09:00', ?, NULL, NULL, ?)`,
          )
          .bind(
            `hours_demo_${day}`,
            day,
            saturday ? '14:00' : '19:00',
            sunday ? 0 : 1,
          ),
      );
    }
  }

  await d1.batch(statements);
}
