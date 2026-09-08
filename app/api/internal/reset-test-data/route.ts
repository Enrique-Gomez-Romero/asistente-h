import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { ensureDatabase } from '@/db/initialize';
import { secureEqual } from '@/lib/auth';

const BUSINESS_TABLES_IN_DELETE_ORDER = [
  'messages',
  'campaign_recipients',
  'invitation_locations',
  'membership_locations',
  'deposit_requests',
  'surveys',
  'patient_events',
  'scheduled_messages',
  'doctor_hours',
  'doctor_locations',
  'appointments',
  'conversations',
  'waitlist_entries',
  'campaigns',
  'business_hours',
  'integration_connections',
  'invitations',
  'memberships',
  'staff_notifications',
  'support_sessions',
  'automation_rules',
  'faq_items',
  'usage_events',
  'manual_payments',
  'subscription_events',
  'organization_states',
  'subscriptions',
  'audit_logs',
  'patients',
  'doctors',
  'services',
  'locations',
  'organization_profiles',
  'clinics',
] as const;

export async function POST(request: Request) {
  const expectedToken = process.env.ADMIN_DATA_RESET_TOKEN;
  const providedToken = request.headers.get('x-admin-reset-token');
  if (
    !expectedToken ||
    !providedToken ||
    !secureEqual(providedToken, expectedToken)
  )
    return new Response('Not found', { status: 404 });

  await ensureDatabase();
  const before = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM clinics',
  ).first<{ count: number }>();
  await env.DB.batch(
    BUSINESS_TABLES_IN_DELETE_ORDER.map((table) =>
      env.DB.prepare(`DELETE FROM ${table}`),
    ),
  );
  const after = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM clinics',
  ).first<{ count: number }>();

  return NextResponse.json({
    ok: true,
    deletedOrganizations: before?.count ?? 0,
    remainingOrganizations: after?.count ?? 0,
  });
}
