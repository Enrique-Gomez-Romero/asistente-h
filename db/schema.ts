import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const clinics = sqliteTable('clinics', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('America/Mexico_City'),
  phone: text('phone'),
  address: text('address'),
  currency: text('currency').notNull().default('MXN'),
  createdAt: text('created_at').notNull(),
});

export const doctors = sqliteTable('doctors', {
  id: text('id').primaryKey(),
  clinicId: text('clinic_id').notNull().references(() => clinics.id),
  name: text('name').notNull(),
  email: text('email'),
  specialty: text('specialty'),
  color: text('color').notNull().default('#2e9b7f'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
}, (table) => [index('idx_doctors_clinic_id').on(table.clinicId)]);

export const services = sqliteTable('services', {
  id: text('id').primaryKey(),
  clinicId: text('clinic_id').notNull().references(() => clinics.id),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  durationMinutes: integer('duration_minutes').notNull(),
  priceCents: integer('price_cents').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
}, (table) => [index('idx_services_clinic_active').on(table.clinicId, table.active)]);

export const patients = sqliteTable('patients', {
  id: text('id').primaryKey(),
  clinicId: text('clinic_id').notNull().references(() => clinics.id),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  notes: text('notes'),
  lastVisitAt: text('last_visit_at'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_patients_clinic_phone').on(table.clinicId, table.phone),
  index('idx_patients_clinic_name').on(table.clinicId, table.fullName),
]);

export const appointments = sqliteTable('appointments', {
  id: text('id').primaryKey(),
  clinicId: text('clinic_id').notNull().references(() => clinics.id),
  patientId: text('patient_id').references(() => patients.id),
  doctorId: text('doctor_id').notNull().references(() => doctors.id),
  serviceId: text('service_id').references(() => services.id),
  startsAt: text('starts_at').notNull(),
  endsAt: text('ends_at').notNull(),
  status: text('status').notNull(),
  source: text('source').notNull().default('manual'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_appointments_clinic_starts_at').on(table.clinicId, table.startsAt),
  index('idx_appointments_doctor_starts_at').on(table.doctorId, table.startsAt),
  index('idx_appointments_patient_id').on(table.patientId),
]);

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  clinicId: text('clinic_id').notNull().references(() => clinics.id),
  patientId: text('patient_id').references(() => patients.id),
  channel: text('channel').notNull().default('whatsapp'),
  status: text('status').notNull().default('open'),
  assignedTo: text('assigned_to'),
  botPaused: integer('bot_paused', { mode: 'boolean' }).notNull().default(false),
  unreadCount: integer('unread_count').notNull().default(0),
  lastMessageAt: text('last_message_at').notNull(),
}, (table) => [index('idx_conversations_clinic_last_message').on(table.clinicId, table.lastMessageAt)]);

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  direction: text('direction').notNull(),
  authorType: text('author_type').notNull(),
  body: text('body').notNull(),
  externalId: text('external_id'),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_messages_conversation_created').on(table.conversationId, table.createdAt)]);

export const faqItems = sqliteTable('faq_items', {
  id: text('id').primaryKey(),
  clinicId: text('clinic_id').notNull().references(() => clinics.id),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
}, (table) => [index('idx_faq_clinic_active').on(table.clinicId, table.active)]);

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  clinicId: text('clinic_id').notNull().references(() => clinics.id),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  details: text('details'),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_audit_clinic_created').on(table.clinicId, table.createdAt)]);
