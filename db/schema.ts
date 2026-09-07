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
    marketingOptIn: integer('marketing_opt_in', { mode: 'boolean' })
      .notNull()
      .default(false),
    consentAt: text('consent_at'),
    consentSource: text('consent_source'),
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
    googleEventId: text('google_event_id'),
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
    pendingAction: text('pending_action'),
    pendingPayload: text('pending_payload'),
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
    deliveryStatus: text('delivery_status').notNull().default('stored'),
    lastError: text('last_error'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_messages_conversation_created').on(
      table.conversationId,
      table.createdAt,
    ),
    uniqueIndex('idx_messages_external_id').on(table.externalId),
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

export const authCredentials = sqliteTable('auth_credentials', {
  userId: text('user_id')
    .primaryKey()
    .references(() => saasUsers.id),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  passwordIterations: integer('password_iterations').notNull().default(210000),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: text('locked_until'),
  passwordChangedAt: text('password_changed_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const authSessions = sqliteTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => saasUsers.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_auth_sessions_token_hash').on(table.tokenHash),
    index('idx_auth_sessions_user_expires').on(table.userId, table.expiresAt),
  ],
);

export const passwordResetTokens = sqliteTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => saasUsers.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_password_reset_token_hash').on(table.tokenHash),
    index('idx_password_reset_user_expires').on(table.userId, table.expiresAt),
  ],
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

export const organizationStates = sqliteTable('organization_states', {
  clinicId: text('clinic_id')
    .primaryKey()
    .references(() => clinics.id),
  status: text('status').notNull().default('active'),
  suspendedAt: text('suspended_at'),
  suspensionReason: text('suspension_reason'),
  updatedAt: text('updated_at').notNull(),
});

export const manualPayments = sqliteTable(
  'manual_payments',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('MXN'),
    periodStart: text('period_start').notNull(),
    periodEnd: text('period_end').notNull(),
    receivedAt: text('received_at').notNull(),
    method: text('method').notNull().default('bank_transfer'),
    reference: text('reference'),
    invoiceFolio: text('invoice_folio'),
    invoiceUrl: text('invoice_url'),
    notes: text('notes'),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_manual_payments_clinic_received').on(
      table.clinicId,
      table.receivedAt,
    ),
  ],
);

export const subscriptionEvents = sqliteTable(
  'subscription_events',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    action: text('action').notNull(),
    previousValue: text('previous_value'),
    nextValue: text('next_value'),
    actor: text('actor').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_subscription_events_clinic_created').on(
      table.clinicId,
      table.createdAt,
    ),
  ],
);

export const doctorLocations = sqliteTable(
  'doctor_locations',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    doctorId: text('doctor_id')
      .notNull()
      .references(() => doctors.id),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    uniqueIndex('idx_doctor_locations_unique').on(
      table.doctorId,
      table.locationId,
    ),
  ],
);

export const doctorHours = sqliteTable(
  'doctor_hours',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    doctorId: text('doctor_id')
      .notNull()
      .references(() => doctors.id),
    locationId: text('location_id').references(() => locations.id),
    dayOfWeek: integer('day_of_week').notNull(),
    opensAt: text('opens_at').notNull(),
    closesAt: text('closes_at').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    uniqueIndex('idx_doctor_hours_doctor_location_day').on(
      table.doctorId,
      table.locationId,
      table.dayOfWeek,
    ),
    index('idx_doctor_hours_clinic_day').on(table.clinicId, table.dayOfWeek),
  ],
);

export const waitlistEntries = sqliteTable(
  'waitlist_entries',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    serviceId: text('service_id').references(() => services.id),
    doctorId: text('doctor_id').references(() => doctors.id),
    preferredDateFrom: text('preferred_date_from'),
    preferredDateTo: text('preferred_date_to'),
    preferredTime: text('preferred_time'),
    status: text('status').notNull().default('waiting'),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_waitlist_clinic_status_created').on(
      table.clinicId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const automationRules = sqliteTable(
  'automation_rules',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    kind: text('kind').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    offsetMinutes: integer('offset_minutes').notNull().default(0),
    template: text('template').notNull(),
    templateName: text('template_name'),
    templateLanguage: text('template_language').notNull().default('es_MX'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_automation_rules_clinic_kind').on(
      table.clinicId,
      table.kind,
    ),
  ],
);

export const scheduledMessages = sqliteTable(
  'scheduled_messages',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: text('patient_id').references(() => patients.id),
    appointmentId: text('appointment_id').references(() => appointments.id),
    campaignId: text('campaign_id'),
    kind: text('kind').notNull(),
    channel: text('channel').notNull().default('whatsapp'),
    recipient: text('recipient').notNull(),
    body: text('body').notNull(),
    templateName: text('template_name'),
    templateLanguage: text('template_language').notNull().default('es_MX'),
    scheduledFor: text('scheduled_for').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    processingStartedAt: text('processing_started_at'),
    lastError: text('last_error'),
    sentAt: text('sent_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_scheduled_messages_status_time').on(
      table.status,
      table.scheduledFor,
    ),
  ],
);

export const campaigns = sqliteTable(
  'campaigns',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    name: text('name').notNull(),
    audience: text('audience').notNull().default('inactive_patients'),
    template: text('template').notNull(),
    status: text('status').notNull().default('draft'),
    scheduledFor: text('scheduled_for'),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_campaigns_clinic_created').on(table.clinicId, table.createdAt),
  ],
);

export const campaignRecipients = sqliteTable(
  'campaign_recipients',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    status: text('status').notNull().default('queued'),
    sentAt: text('sent_at'),
  },
  (table) => [
    uniqueIndex('idx_campaign_recipients_unique').on(
      table.campaignId,
      table.patientId,
    ),
  ],
);

export const surveys = sqliteTable(
  'surveys',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    appointmentId: text('appointment_id').references(() => appointments.id),
    score: integer('score'),
    comment: text('comment'),
    status: text('status').notNull().default('pending'),
    sentAt: text('sent_at'),
    respondedAt: text('responded_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_surveys_clinic_status').on(table.clinicId, table.status),
  ],
);

export const staffNotifications = sqliteTable(
  'staff_notifications',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    userId: text('user_id').references(() => saasUsers.id),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    readAt: text('read_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_staff_notifications_clinic_created').on(
      table.clinicId,
      table.createdAt,
    ),
  ],
);

export const depositRequests = sqliteTable(
  'deposit_requests',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    appointmentId: text('appointment_id')
      .notNull()
      .references(() => appointments.id),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('MXN'),
    status: text('status').notNull().default('requested'),
    reference: text('reference'),
    requestedAt: text('requested_at').notNull(),
    paidAt: text('paid_at'),
    verifiedBy: text('verified_by'),
  },
  (table) => [
    uniqueIndex('idx_deposit_requests_appointment').on(table.appointmentId),
  ],
);

export const patientEvents = sqliteTable(
  'patient_events',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    details: text('details'),
    entityId: text('entity_id'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_patient_events_patient_created').on(
      table.patientId,
      table.createdAt,
    ),
  ],
);

export const supportSessions = sqliteTable(
  'support_sessions',
  {
    id: text('id').primaryKey(),
    clinicId: text('clinic_id')
      .notNull()
      .references(() => clinics.id),
    platformUserId: text('platform_user_id')
      .notNull()
      .references(() => saasUsers.id),
    reason: text('reason').notNull(),
    startedAt: text('started_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    endedAt: text('ended_at'),
  },
  (table) => [
    index('idx_support_sessions_clinic_active').on(
      table.clinicId,
      table.endedAt,
    ),
  ],
);
