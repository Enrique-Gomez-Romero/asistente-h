import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const clinics = sqliteTable('clinics', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('America/Mexico_City'),
  phone: text('phone'),
  address: text('address'),
  currency: text('currency').notNull().default('MXN'),
  createdAt: text('created_at').notNull(),
});

export const doctors = sqliteTable(
  'doctors',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    name: text('name').notNull(),
    email: text('email'),
    specialty: text('specialty'),
    color: text('color').notNull().default('#2e9b7f'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [index('idx_doctors_clinic_id').on(table.clinicId)],
);

export const services = sqliteTable(
  'services',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    name: text('name').notNull(),
    category: text('category').notNull(),
    description: text('description'),
    durationMinutes: integer('duration_minutes').notNull(),
    priceCents: integer('price_cents').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    index('idx_services_clinic_active').on(table.clinicId, table.active),
  ],
);

export const patients = sqliteTable(
  'patients',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    notes: text('notes'),
    lastVisitAt: text('last_visit_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_patients_clinic_phone').on(table.clinicId, table.phone),
    index('idx_patients_clinic_name').on(table.clinicId, table.fullName),
  ],
);

export const appointments = sqliteTable(
  'appointments',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: text('patient_id').references(() => patients.id),
    doctorId: text('doctor_id')
      .notNull()
      .references(() => doctors.id),
    serviceId: text('service_id').references(() => services.id),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    status: text('status').notNull(),
    source: text('source').notNull().default('manual'),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_appointments_clinic_starts_at').on(
      table.clinicId,
      table.startsAt,
    ),
    index('idx_appointments_doctor_starts_at').on(
      table.doctorId,
      table.startsAt,
    ),
    index('idx_appointments_patient_id').on(table.patientId),
  ],
);

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: text('patient_id').references(() => patients.id),
    channel: text('channel').notNull().default('whatsapp'),
    status: text('status').notNull().default('open'),
    assignedTo: text('assigned_to'),
    botPaused: integer('bot_paused', { mode: 'boolean' })
      .notNull()
      .default(false),
    unreadCount: integer('unread_count').notNull().default(0),
    lastMessageAt: text('last_message_at').notNull(),
  },
  (table) => [
    index('idx_conversations_clinic_last_message').on(
      table.clinicId,
      table.lastMessageAt,
    ),
  ],
);

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id),
    direction: text('direction').notNull(),
    authorType: text('author_type').notNull(),
    body: text('body').notNull(),
    externalId: text('external_id'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_messages_conversation_created').on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const faqItems = sqliteTable(
  'faq_items',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [index('idx_faq_clinic_active').on(table.clinicId, table.active)],
);

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    details: text('details'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_audit_clinic_created').on(table.clinicId, table.createdAt),
  ],
);

export const saasUsers = sqliteTable(
  'saas_users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    fullName: text('full_name'),
    createdAt: text('created_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
  },
  (table) => [uniqueIndex('idx_saas_users_email').on(table.email)],
);

export const memberships = sqliteTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    userId: text('user_id')
      .notNull()
      .references(() => saasUsers.id),
    role: text('role').notNull().default('staff'),
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_memberships_clinic_user').on(table.clinicId, table.userId),
    index('idx_memberships_user_status').on(table.userId, table.status),
  ],
);

export const platformAdmins = sqliteTable('platform_admins', {
  userId: text('user_id')
    .primaryKey()
    .references(() => saasUsers.id),
  createdAt: text('created_at').notNull(),
});

export const organizationProfiles = sqliteTable(
  'organization_profiles',
  {
    clinicId: text('clinic_id')
      .primaryKey()
      .references(() => clinics.id),
    slug: text('slug').notNull(),
    businessType: text('business_type').notNull().default('dental'),
    verticalTemplate: text('vertical_template').notNull().default('dental'),
    brandColor: text('brand_color').notNull().default('#2e9b7f'),
    onboardingStatus: text('onboarding_status').notNull().default('complete'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_organization_profiles_slug').on(table.slug)],
);

export const locations = sqliteTable(
  'locations',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    name: text('name').notNull(),
    address: text('address'),
    timezone: text('timezone').notNull().default('America/Mexico_City'),
    phone: text('phone'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    index('idx_locations_clinic_active').on(table.clinicId, table.active),
  ],
);

export const businessHours = sqliteTable(
  'business_hours',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    locationId: text('location_id').references(() => locations.id),
    dayOfWeek: integer('day_of_week').notNull(),
    opensAt: text('opens_at').notNull(),
    closesAt: text('closes_at').notNull(),
    breakStart: text('break_start'),
    breakEnd: text('break_end'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    uniqueIndex('idx_business_hours_clinic_location_day').on(
      table.clinicId,
      table.locationId,
      table.dayOfWeek,
    ),
    index('idx_business_hours_clinic_day').on(table.clinicId, table.dayOfWeek),
  ],
);

export const subscriptionPlans = sqliteTable(
  'subscription_plans',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    priceCents: integer('price_cents'),
    maxUsers: integer('max_users').notNull(),
    maxLocations: integer('max_locations').notNull(),
    maxConversations: integer('max_conversations').notNull(),
    maxAiRequests: integer('max_ai_requests').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [uniqueIndex('idx_subscription_plans_slug').on(table.slug)],
);

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    planId: text('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id),
    status: text('status').notNull().default('trialing'),
    currentPeriodStart: text('current_period_start').notNull(),
    currentPeriodEnd: text('current_period_end').notNull(),
    trialEndsAt: text('trial_ends_at'),
    billingProvider: text('billing_provider'),
    customerReference: text('customer_reference'),
    subscriptionReference: text('subscription_reference'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_subscriptions_clinic').on(table.clinicId)],
);

export const integrationConnections = sqliteTable(
  'integration_connections',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    provider: text('provider').notNull(),
    status: text('status').notNull().default('pending'),
    externalAccountId: text('external_account_id'),
    phoneNumberId: text('phone_number_id'),
    secretReference: text('secret_reference'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_integrations_clinic_provider').on(
      table.clinicId,
      table.provider,
    ),
    uniqueIndex('idx_integrations_phone_number_id').on(table.phoneNumberId),
  ],
);

export const usageEvents = sqliteTable(
  'usage_events',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    metric: text('metric').notNull(),
    quantity: integer('quantity').notNull().default(1),
    sourceId: text('source_id'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_usage_clinic_metric_created').on(
      table.clinicId,
      table.metric,
      table.createdAt,
    ),
    uniqueIndex('idx_usage_source').on(table.sourceId),
  ],
);

export const invitations = sqliteTable(
  'invitations',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    email: text('email').notNull(),
    role: text('role').notNull().default('staff'),
    status: text('status').notNull().default('pending'),
    tokenHash: text('token_hash'),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_invitations_clinic_status').on(table.clinicId, table.status),
  ],
);
