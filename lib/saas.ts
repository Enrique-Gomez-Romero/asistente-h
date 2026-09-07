import { env } from 'cloudflare:workers';

import { getAuthenticatedUser, type AppUser } from '@/lib/auth';
import { ensureDatabase } from '@/db/initialize';
import { googleSecretManagerConfigured } from '@/lib/google-secrets';

export type MembershipRole = 'owner' | 'admin' | 'staff' | 'viewer';

export type SaasOrganization = {
  id: string;
  name: string;
  timezone: string;
  phone: string | null;
  address: string | null;
  currency: string;
  slug: string;
  businessType: string;
  verticalTemplate: string;
  brandColor: string;
  role: MembershipRole;
};

export type BusinessHour = {
  id: string;
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  breakStart: string | null;
  breakEnd: string | null;
  active: number;
};

export type SaasContext = {
  user: AppUser;
  isPlatformAdmin: boolean;
  organizations: SaasOrganization[];
  activeOrganization: SaasOrganization | null;
  accountStatus: string;
  subscription: null | {
    id: string;
    status: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    plan: {
      id: string;
      slug: string;
      name: string;
      description: string | null;
      priceCents: number | null;
      maxUsers: number;
      maxLocations: number;
      maxConversations: number;
      maxAiRequests: number;
    };
  };
  usage: { aiRequests: number; conversations: number };
  members: Array<{
    id: string;
    email: string;
    fullName: string | null;
    role: MembershipRole;
    status: string;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: MembershipRole;
    status: string;
    expiresAt: string;
  }>;
  hours: BusinessHour[];
  integrations: Array<{
    provider: string;
    status: string;
    externalAccountId: string | null;
    phoneNumberId: string | null;
  }>;
  paymentHistory: Array<{
    id: string;
    amountCents: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    receivedAt: string;
    reference: string | null;
    invoiceFolio: string | null;
    invoiceUrl: string | null;
  }>;
  platformStats: null | {
    organizations: number;
    users: number;
    activeSubscriptions: number;
    aiRequests: number;
  };
};

export async function getRequestUser(): Promise<AppUser | null> {
  return getAuthenticatedUser();
}

export async function ensureSaasUser(user: AppUser): Promise<void> {
  await ensureDatabase();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO saas_users (id, email, full_name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, full_name = excluded.full_name, last_seen_at = excluded.last_seen_at`,
  )
    .bind(
      user.userId,
      user.email.toLocaleLowerCase('es-MX'),
      user.fullName,
      now,
      now,
    )
    .run();

  const platformAdminEmails = new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLocaleLowerCase('es-MX'))
      .filter(Boolean),
  );
  if (process.env.NODE_ENV === 'development')
    platformAdminEmails.add(user.email.toLocaleLowerCase('es-MX'));
  const shouldBePlatformAdmin = platformAdminEmails.has(
    user.email.toLocaleLowerCase('es-MX'),
  );
  if (shouldBePlatformAdmin) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO platform_admins (user_id, created_at) VALUES (?, ?)',
    )
      .bind(user.userId, now)
      .run();
  }

  const membership = await env.DB.prepare(
    `SELECT id FROM memberships WHERE user_id = ? AND status = 'active' LIMIT 1`,
  )
    .bind(user.userId)
    .first<{ id: string }>();
  if (membership) return;

  const demoOwner = await env.DB.prepare(
    `SELECT id FROM memberships WHERE clinic_id = 'clinic_demo' AND role = 'owner' AND status = 'active' LIMIT 1`,
  ).first<{ id: string }>();
  if (!demoOwner && shouldBePlatformAdmin) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO memberships (id, clinic_id, user_id, role, status, created_at) VALUES (?, 'clinic_demo', ?, 'owner', 'active', ?)`,
    )
      .bind(`membership_${crypto.randomUUID()}`, user.userId, now)
      .run();
  }
}

export async function getSaasContext(
  user: AppUser,
  requestedClinicId?: string,
): Promise<SaasContext> {
  await ensureSaasUser(user);
  const isPlatformAdmin = Boolean(
    await env.DB.prepare(
      'SELECT user_id FROM platform_admins WHERE user_id = ?',
    )
      .bind(user.userId)
      .first(),
  );
  const organizationQuery = isPlatformAdmin
    ? env.DB.prepare(
        `SELECT c.id, c.name, c.timezone, c.phone, c.address, c.currency, COALESCE(op.slug, c.id) AS slug, COALESCE(op.business_type, 'dental') AS businessType, COALESCE(op.vertical_template, 'dental') AS verticalTemplate, COALESCE(op.brand_color, '#2e9b7f') AS brandColor, COALESCE(m.role, 'owner') AS role FROM clinics c LEFT JOIN organization_profiles op ON op.clinic_id = c.id LEFT JOIN memberships m ON m.clinic_id = c.id AND m.user_id = ? AND m.status = 'active' ORDER BY c.name`,
      ).bind(user.userId)
    : env.DB.prepare(
        `SELECT c.id, c.name, c.timezone, c.phone, c.address, c.currency, COALESCE(op.slug, c.id) AS slug, COALESCE(op.business_type, 'dental') AS businessType, COALESCE(op.vertical_template, 'dental') AS verticalTemplate, COALESCE(op.brand_color, '#2e9b7f') AS brandColor, m.role FROM memberships m JOIN clinics c ON c.id = m.clinic_id LEFT JOIN organization_profiles op ON op.clinic_id = c.id WHERE m.user_id = ? AND m.status = 'active' ORDER BY c.name`,
      ).bind(user.userId);
  const organizations = await organizationQuery.all<SaasOrganization>();
  const organizationList = organizations.results;
  const activeOrganization =
    organizationList.find((item) => item.id === requestedClinicId) ??
    organizationList[0] ??
    null;

  if (!activeOrganization) {
    return {
      user,
      isPlatformAdmin,
      organizations: [],
      activeOrganization: null,
      accountStatus: 'inactive',
      subscription: null,
      usage: { aiRequests: 0, conversations: 0 },
      members: [],
      invitations: [],
      hours: [],
      integrations: [],
      paymentHistory: [],
      platformStats: isPlatformAdmin ? await getPlatformStats() : null,
    };
  }

  const clinicId = activeOrganization.id;
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const [
    subscriptionRow,
    usageRows,
    members,
    invitations,
    hours,
    integrations,
    accountState,
    paymentHistory,
    platformStats,
  ] = await Promise.all([
    env.DB.prepare(
      `SELECT s.id, s.status, s.current_period_end AS currentPeriodEnd, s.trial_ends_at AS trialEndsAt, p.id AS planId, p.slug AS planSlug, p.name AS planName, p.description AS planDescription, p.price_cents AS planPriceCents, p.max_users AS maxUsers, p.max_locations AS maxLocations, p.max_conversations AS maxConversations, p.max_ai_requests AS maxAiRequests FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id WHERE s.clinic_id = ?`,
    )
      .bind(clinicId)
      .first<SubscriptionRow>(),
    env.DB.prepare(
      `SELECT metric, COALESCE(SUM(quantity), 0) AS total FROM usage_events WHERE clinic_id = ? AND created_at >= ? GROUP BY metric`,
    )
      .bind(clinicId, periodStart.toISOString())
      .all<{ metric: string; total: number }>(),
    env.DB.prepare(
      `SELECT u.id, u.email, u.full_name AS fullName, m.role, m.status FROM memberships m JOIN saas_users u ON u.id = m.user_id WHERE m.clinic_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.full_name`,
    )
      .bind(clinicId)
      .all<{
        id: string;
        email: string;
        fullName: string | null;
        role: MembershipRole;
        status: string;
      }>(),
    env.DB.prepare(
      `SELECT id, email, role, status, expires_at AS expiresAt FROM invitations WHERE clinic_id = ? ORDER BY created_at DESC LIMIT 20`,
    )
      .bind(clinicId)
      .all<{
        id: string;
        email: string;
        role: MembershipRole;
        status: string;
        expiresAt: string;
      }>(),
    env.DB.prepare(
      `SELECT id, day_of_week AS dayOfWeek, opens_at AS opensAt, closes_at AS closesAt, break_start AS breakStart, break_end AS breakEnd, active FROM business_hours WHERE clinic_id = ? ORDER BY day_of_week`,
    )
      .bind(clinicId)
      .all<BusinessHour>(),
    env.DB.prepare(
      `SELECT provider, status, external_account_id AS externalAccountId, phone_number_id AS phoneNumberId FROM integration_connections WHERE clinic_id = ? ORDER BY provider`,
    )
      .bind(clinicId)
      .all<{
        provider: string;
        status: string;
        externalAccountId: string | null;
        phoneNumberId: string | null;
      }>(),
    env.DB.prepare(`SELECT status FROM organization_states WHERE clinic_id = ?`)
      .bind(clinicId)
      .first<{ status: string }>(),
    env.DB.prepare(
      `SELECT id, amount_cents AS amountCents, currency, period_start AS periodStart, period_end AS periodEnd, received_at AS receivedAt, reference, invoice_folio AS invoiceFolio, invoice_url AS invoiceUrl FROM manual_payments WHERE clinic_id = ? ORDER BY received_at DESC LIMIT 24`,
    )
      .bind(clinicId)
      .all<{
        id: string;
        amountCents: number;
        currency: string;
        periodStart: string;
        periodEnd: string;
        receivedAt: string;
        reference: string | null;
        invoiceFolio: string | null;
        invoiceUrl: string | null;
      }>(),
    isPlatformAdmin ? getPlatformStats() : Promise.resolve(null),
  ]);
  const usage = Object.fromEntries(
    usageRows.results.map((row) => [row.metric, Number(row.total)]),
  );
  const integrationList = integrations.results.map((connection) => ({
    ...connection,
    status:
      connection.provider === 'whatsapp' &&
      process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID
        ? 'connected'
        : connection.status,
  }));

  return {
    user,
    isPlatformAdmin,
    organizations: organizationList,
    activeOrganization,
    accountStatus: accountState?.status ?? 'active',
    subscription: subscriptionRow
      ? {
          id: subscriptionRow.id,
          status: subscriptionRow.status,
          currentPeriodEnd: subscriptionRow.currentPeriodEnd,
          trialEndsAt: subscriptionRow.trialEndsAt,
          plan: {
            id: subscriptionRow.planId,
            slug: subscriptionRow.planSlug,
            name: subscriptionRow.planName,
            description: subscriptionRow.planDescription,
            priceCents: subscriptionRow.planPriceCents,
            maxUsers: subscriptionRow.maxUsers,
            maxLocations: subscriptionRow.maxLocations,
            maxConversations: subscriptionRow.maxConversations,
            maxAiRequests: subscriptionRow.maxAiRequests,
          },
        }
      : null,
    usage: {
      aiRequests: Number(usage.ai_request ?? 0),
      conversations: Number(usage.conversation ?? 0),
    },
    members: members.results,
    invitations: invitations.results,
    hours: hours.results,
    integrations: integrationList,
    paymentHistory: paymentHistory.results,
    platformStats,
  };
}

export async function requireClinicAccess(
  clinicId: string,
  allowedRoles: MembershipRole[] = ['owner', 'admin', 'staff', 'viewer'],
): Promise<{
  user: AppUser;
  role: MembershipRole;
  isPlatformAdmin: boolean;
}> {
  if (!clinicId) throw new Error('Falta seleccionar una organización.');
  const user = await getRequestUser();
  if (!user) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  await ensureSaasUser(user);
  const isPlatformAdmin = Boolean(
    await env.DB.prepare(
      'SELECT user_id FROM platform_admins WHERE user_id = ?',
    )
      .bind(user.userId)
      .first(),
  );
  if (isPlatformAdmin) return { user, role: 'owner', isPlatformAdmin: true };
  const membership = await env.DB.prepare(
    `SELECT role FROM memberships WHERE clinic_id = ? AND user_id = ? AND status = 'active'`,
  )
    .bind(clinicId, user.userId)
    .first<{ role: MembershipRole }>();
  if (!membership || !allowedRoles.includes(membership.role))
    throw new Error('No tienes permisos para realizar esta acción.');
  const [accountState, subscription] = await Promise.all([
    env.DB.prepare(`SELECT status FROM organization_states WHERE clinic_id = ?`)
      .bind(clinicId)
      .first<{ status: string }>(),
    env.DB.prepare(
      `SELECT status, current_period_end AS periodEnd FROM subscriptions WHERE clinic_id = ?`,
    )
      .bind(clinicId)
      .first<{ status: string; periodEnd: string }>(),
  ]);
  if (accountState?.status === 'suspended')
    throw new Error(
      'La organización está suspendida. Contacta al administrador de la plataforma.',
    );
  if (
    !subscription ||
    !['trialing', 'active'].includes(subscription.status) ||
    new Date(subscription.periodEnd).getTime() < Date.now()
  )
    throw new Error(
      'La suscripción no está vigente. Contacta al administrador de la plataforma.',
    );
  return { user, role: membership.role, isPlatformAdmin: false };
}

export type PlatformAdminData = {
  user: AppUser;
  infrastructure: {
    gemini: boolean;
    invitationEmail: boolean;
    metaEmbeddedSignup: boolean;
    googleSecretManager: boolean;
    automationRunner: boolean;
  };
  stats: {
    organizations: number;
    users: number;
    activeSubscriptions: number;
    aiRequests: number;
  };
  plans: Array<{
    id: string;
    name: string;
    slug: string;
    maxUsers: number;
    maxLocations: number;
    maxConversations: number;
    maxAiRequests: number;
  }>;
  organizations: Array<{
    id: string;
    name: string;
    businessType: string;
    accountStatus: string;
    subscriptionStatus: string;
    planId: string;
    planName: string;
    periodEnd: string;
    users: number;
    conversations: number;
    aiRequests: number;
    whatsappStatus: string;
    createdAt: string;
  }>;
  recentPayments: Array<{
    id: string;
    clinicId: string;
    clinicName: string;
    amountCents: number;
    currency: string;
    receivedAt: string;
    reference: string | null;
    invoiceFolio: string | null;
  }>;
};

export async function getPlatformAdminData(
  user: AppUser,
): Promise<PlatformAdminData> {
  await ensureSaasUser(user);
  const isAdmin = Boolean(
    await env.DB.prepare(
      'SELECT user_id FROM platform_admins WHERE user_id = ?',
    )
      .bind(user.userId)
      .first(),
  );
  if (!isAdmin)
    throw new Error('No tienes acceso a la administración de la plataforma.');
  const [stats, plans, organizations, payments] = await Promise.all([
    getPlatformStats(),
    env.DB.prepare(
      `SELECT id, name, slug, max_users AS maxUsers, max_locations AS maxLocations, max_conversations AS maxConversations, max_ai_requests AS maxAiRequests FROM subscription_plans WHERE active = 1 ORDER BY max_users`,
    ).all<PlatformAdminData['plans'][number]>(),
    env.DB.prepare(
      `SELECT c.id, c.name, COALESCE(op.business_type, 'general') AS businessType, COALESCE(os.status, 'active') AS accountStatus, COALESCE(s.status, 'inactive') AS subscriptionStatus, COALESCE(p.id, '') AS planId, COALESCE(p.name, 'Sin plan') AS planName, COALESCE(s.current_period_end, '') AS periodEnd, (SELECT COUNT(*) FROM memberships m WHERE m.clinic_id = c.id AND m.status = 'active') AS users, (SELECT COUNT(*) FROM conversations cv WHERE cv.clinic_id = c.id) AS conversations, COALESCE((SELECT SUM(quantity) FROM usage_events u WHERE u.clinic_id = c.id AND u.metric = 'ai_request'), 0) AS aiRequests, COALESCE((SELECT status FROM integration_connections ic WHERE ic.clinic_id = c.id AND ic.provider = 'whatsapp'), 'pending') AS whatsappStatus, c.created_at AS createdAt FROM clinics c LEFT JOIN organization_profiles op ON op.clinic_id = c.id LEFT JOIN organization_states os ON os.clinic_id = c.id LEFT JOIN subscriptions s ON s.clinic_id = c.id LEFT JOIN subscription_plans p ON p.id = s.plan_id ORDER BY c.created_at DESC`,
    ).all<PlatformAdminData['organizations'][number]>(),
    env.DB.prepare(
      `SELECT mp.id, mp.clinic_id AS clinicId, c.name AS clinicName, mp.amount_cents AS amountCents, mp.currency, mp.received_at AS receivedAt, mp.reference, mp.invoice_folio AS invoiceFolio FROM manual_payments mp JOIN clinics c ON c.id = mp.clinic_id ORDER BY mp.received_at DESC LIMIT 30`,
    ).all<PlatformAdminData['recentPayments'][number]>(),
  ]);
  return {
    user,
    infrastructure: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      invitationEmail: Boolean(
        process.env.RESEND_API_KEY && process.env.EMAIL_FROM,
      ),
      metaEmbeddedSignup: Boolean(
        process.env.META_APP_ID &&
        process.env.META_CONFIG_ID &&
        process.env.META_APP_SECRET,
      ),
      googleSecretManager: googleSecretManagerConfigured(),
      automationRunner: Boolean(process.env.AUTOMATION_SECRET),
    },
    stats,
    plans: plans.results,
    organizations: organizations.results,
    recentPayments: payments.results,
  };
}

export async function recordUsage(
  clinicId: string,
  metric: 'ai_request' | 'conversation' | 'whatsapp_message',
  quantity = 1,
  sourceId?: string,
): Promise<void> {
  await ensureDatabase();
  await env.DB.prepare(
    'INSERT OR IGNORE INTO usage_events (id, clinic_id, metric, quantity, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(
      `usage_${crypto.randomUUID()}`,
      clinicId,
      metric,
      quantity,
      sourceId ?? null,
      new Date().toISOString(),
    )
    .run();
}

export async function resolveClinicByWhatsAppNumber(
  phoneNumberId?: string,
): Promise<string | null> {
  await ensureDatabase();
  if (phoneNumberId) {
    const connection = await env.DB.prepare(
      `SELECT clinic_id AS clinicId FROM integration_connections WHERE provider = 'whatsapp' AND phone_number_id = ? AND status = 'connected'`,
    )
      .bind(phoneNumberId)
      .first<{ clinicId: string }>();
    if (connection) return connection.clinicId;
  }
  if (phoneNumberId && phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID)
    return 'clinic_demo';
  return null;
}

async function getPlatformStats(): Promise<{
  organizations: number;
  users: number;
  activeSubscriptions: number;
  aiRequests: number;
}> {
  const [organizations, users, activeSubscriptions, aiRequests] =
    await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS total FROM clinics').first<{
        total: number;
      }>(),
      env.DB.prepare('SELECT COUNT(*) AS total FROM saas_users').first<{
        total: number;
      }>(),
      env.DB.prepare(
        `SELECT COUNT(*) AS total FROM subscriptions WHERE status IN ('trialing', 'active')`,
      ).first<{ total: number }>(),
      env.DB.prepare(
        `SELECT COALESCE(SUM(quantity), 0) AS total FROM usage_events WHERE metric = 'ai_request'`,
      ).first<{ total: number }>(),
    ]);
  return {
    organizations: Number(organizations?.total ?? 0),
    users: Number(users?.total ?? 0),
    activeSubscriptions: Number(activeSubscriptions?.total ?? 0),
    aiRequests: Number(aiRequests?.total ?? 0),
  };
}

type SubscriptionRow = {
  id: string;
  status: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  planId: string;
  planSlug: string;
  planName: string;
  planDescription: string | null;
  planPriceCents: number | null;
  maxUsers: number;
  maxLocations: number;
  maxConversations: number;
  maxAiRequests: number;
};
