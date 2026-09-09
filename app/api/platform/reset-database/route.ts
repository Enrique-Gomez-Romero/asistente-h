import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

const CONFIRMATION = 'DELETE_ALL_EXCEPT_PLATFORM_ADMIN';

export async function POST(request: Request) {
  const secret = process.env.DB_RESET_TOKEN;
  const authorization = request.headers.get('authorization');
  const confirmation = request.headers.get('x-reset-confirmation');

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (confirmation !== CONFIRMATION) {
    return NextResponse.json(
      { ok: false, error: 'Missing reset confirmation' },
      { status: 400 },
    );
  }

  const admins = await env.DB.prepare(
    'SELECT user_id AS userId FROM platform_admins ORDER BY created_at',
  ).all<{ userId: string }>();

  if (admins.results.length !== 1) {
    return NextResponse.json(
      { ok: false, error: 'Expected exactly one platform administrator' },
      { status: 409 },
    );
  }

  const adminUserId = admins.results[0].userId;
  const [organizationsBefore, usersBefore] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS total FROM clinics').first<{ total: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS total FROM saas_users').first<{ total: number }>(),
  ]);

  const statements = [
    'DELETE FROM messages',
    'DELETE FROM campaign_recipients',
    'DELETE FROM invitation_locations',
    'DELETE FROM membership_locations',
    'DELETE FROM scheduled_messages',
    'DELETE FROM surveys',
    'DELETE FROM deposit_requests',
    'DELETE FROM patient_events',
    'DELETE FROM waitlist_entries',
    'DELETE FROM doctor_hours',
    'DELETE FROM doctor_locations',
    'DELETE FROM business_hours',
    'DELETE FROM integration_connections',
    'DELETE FROM staff_notifications',
    'DELETE FROM support_sessions',
    'DELETE FROM usage_events',
    'DELETE FROM audit_logs',
    'DELETE FROM faq_items',
    'DELETE FROM manual_payments',
    'DELETE FROM subscription_events',
    'DELETE FROM automation_rules',
    'DELETE FROM appointments',
    'DELETE FROM conversations',
    'DELETE FROM campaigns',
    'DELETE FROM invitations',
    'DELETE FROM memberships',
    'DELETE FROM subscriptions',
    'DELETE FROM organization_profiles',
    'DELETE FROM organization_states',
    'DELETE FROM doctors',
    'DELETE FROM services',
    'DELETE FROM patients',
    'DELETE FROM locations',
    'DELETE FROM clinics',
    'DELETE FROM password_reset_tokens',
  ].map((sql) => env.DB.prepare(sql));

  statements.push(
    env.DB.prepare('DELETE FROM auth_sessions WHERE user_id <> ?').bind(adminUserId),
    env.DB.prepare('DELETE FROM auth_credentials WHERE user_id <> ?').bind(adminUserId),
    env.DB.prepare('DELETE FROM platform_admins WHERE user_id <> ?').bind(adminUserId),
    env.DB.prepare('DELETE FROM saas_users WHERE id <> ?').bind(adminUserId),
  );

  await env.DB.batch(statements);

  return NextResponse.json(
    {
      ok: true,
      organizationsRemoved: Number(organizationsBefore?.total ?? 0),
      usersRemoved: Math.max(0, Number(usersBefore?.total ?? 0) - 1),
      adminPreserved: true,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
