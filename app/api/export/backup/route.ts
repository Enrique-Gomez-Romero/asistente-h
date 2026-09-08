import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { ensureDatabase } from '@/db/initialize';
import { requireClinicAccess } from '@/lib/saas';

type BackupQuery = { name: string; sql: string };

const backupQueries: BackupQuery[] = [
  { name: 'clinic', sql: 'SELECT * FROM clinics WHERE id = ?' },
  { name: 'organizationProfile', sql: 'SELECT * FROM organization_profiles WHERE clinic_id = ?' },
  { name: 'organizationState', sql: 'SELECT * FROM organization_states WHERE clinic_id = ?' },
  { name: 'locations', sql: 'SELECT * FROM locations WHERE clinic_id = ?' },
  { name: 'businessHours', sql: 'SELECT * FROM business_hours WHERE clinic_id = ?' },
  { name: 'doctors', sql: 'SELECT * FROM doctors WHERE clinic_id = ?' },
  { name: 'doctorLocations', sql: 'SELECT * FROM doctor_locations WHERE clinic_id = ?' },
  { name: 'doctorHours', sql: 'SELECT * FROM doctor_hours WHERE clinic_id = ?' },
  { name: 'services', sql: 'SELECT * FROM services WHERE clinic_id = ?' },
  { name: 'patients', sql: 'SELECT * FROM patients WHERE clinic_id = ?' },
  { name: 'appointments', sql: 'SELECT * FROM appointments WHERE clinic_id = ?' },
  { name: 'conversations', sql: 'SELECT * FROM conversations WHERE clinic_id = ?' },
  {
    name: 'messages',
    sql: 'SELECT m.* FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.clinic_id = ?',
  },
  { name: 'faqs', sql: 'SELECT * FROM faq_items WHERE clinic_id = ?' },
  { name: 'memberships', sql: 'SELECT * FROM memberships WHERE clinic_id = ?' },
  {
    name: 'users',
    sql: 'SELECT u.* FROM saas_users u JOIN memberships m ON m.user_id = u.id WHERE m.clinic_id = ?',
  },
  {
    name: 'invitations',
    sql: 'SELECT id, clinic_id, email, role, status, expires_at, created_at FROM invitations WHERE clinic_id = ?',
  },
  { name: 'subscriptions', sql: 'SELECT * FROM subscriptions WHERE clinic_id = ?' },
  { name: 'manualPayments', sql: 'SELECT * FROM manual_payments WHERE clinic_id = ?' },
  { name: 'subscriptionEvents', sql: 'SELECT * FROM subscription_events WHERE clinic_id = ?' },
  {
    name: 'integrations',
    sql: 'SELECT id, clinic_id, provider, status, external_account_id, phone_number_id, created_at, updated_at FROM integration_connections WHERE clinic_id = ?',
  },
  { name: 'usageEvents', sql: 'SELECT * FROM usage_events WHERE clinic_id = ?' },
  { name: 'waitlist', sql: 'SELECT * FROM waitlist_entries WHERE clinic_id = ?' },
  { name: 'automationRules', sql: 'SELECT * FROM automation_rules WHERE clinic_id = ?' },
  { name: 'scheduledMessages', sql: 'SELECT * FROM scheduled_messages WHERE clinic_id = ?' },
  { name: 'campaigns', sql: 'SELECT * FROM campaigns WHERE clinic_id = ?' },
  { name: 'campaignRecipients', sql: 'SELECT * FROM campaign_recipients WHERE clinic_id = ?' },
  { name: 'surveys', sql: 'SELECT * FROM surveys WHERE clinic_id = ?' },
  { name: 'notifications', sql: 'SELECT * FROM staff_notifications WHERE clinic_id = ?' },
  { name: 'depositRequests', sql: 'SELECT * FROM deposit_requests WHERE clinic_id = ?' },
  { name: 'patientEvents', sql: 'SELECT * FROM patient_events WHERE clinic_id = ?' },
  { name: 'auditLogs', sql: 'SELECT * FROM audit_logs WHERE clinic_id = ?' },
];

export async function GET(request: Request) {
  await ensureDatabase();
  const clinicId = new URL(request.url).searchParams.get('clinicId')?.trim();
  if (!clinicId)
    return NextResponse.json(
      { error: 'clinicId es obligatorio.' },
      { status: 400 },
    );
  await requireClinicAccess(clinicId, ['owner', 'admin']);
  const entries = await Promise.all(
    backupQueries.map(async ({ name, sql }) => {
      const result = await env.DB.prepare(sql)
        .bind(clinicId)
        .all<Record<string, unknown>>();
      return [name, result.results] as const;
    }),
  );
  const clinicRows = entries.find(([name]) => name === 'clinic')?.[1] ?? [];
  if (!clinicRows.length)
    return NextResponse.json(
      { error: 'Negocio no encontrado.' },
      { status: 404 },
    );
  const exportedAt = new Date().toISOString();
  const payload = {
    format: 'asistente-h-backup',
    version: 1,
    exportedAt,
    clinicId,
    securityNotice:
      'No incluye tokens, secretos de integraciones ni tokens de invitación.',
    data: Object.fromEntries(entries),
  };
  const clinicName =
    typeof clinicRows[0].name === 'string' ? clinicRows[0].name : 'negocio';
  const date = exportedAt.slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slugify(clinicName)}-respaldo-${date}.json"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function slugify(value: string) {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'asistente-h'
  );
}
