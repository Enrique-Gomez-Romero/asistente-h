import { env } from 'cloudflare:workers';

import type { AppUser } from '@/lib/auth';
import { ensureDatabase } from '@/db/initialize';
import { ensureSaasUser, type MembershipRole } from '@/lib/saas';

export function createInvitationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64Url(bytes);
}

export async function hashInvitationToken(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function getInvitationDetails(token: string): Promise<
  | {
      ok: true;
      email: string;
      organizationName: string;
      role: MembershipRole;
      hasCredential: boolean;
    }
  | { ok: false; message: string }
> {
  await ensureDatabase();
  if (token.length < 30)
    return { ok: false, message: 'El enlace de invitación no es válido.' };
  const invitation = await env.DB.prepare(
    `SELECT i.email, i.role, i.status, i.expires_at AS expiresAt,
            c.name AS organizationName,
            CASE WHEN ac.user_id IS NULL THEN 0 ELSE 1 END AS hasCredential
     FROM invitations i
     JOIN clinics c ON c.id = i.clinic_id
     LEFT JOIN saas_users u ON u.email = i.email
     LEFT JOIN auth_credentials ac ON ac.user_id = u.id
     WHERE i.token_hash = ? LIMIT 1`,
  )
    .bind(await hashInvitationToken(token))
    .first<{
      email: string;
      role: MembershipRole;
      status: string;
      expiresAt: string;
      organizationName: string;
      hasCredential: number;
    }>();
  if (!invitation)
    return { ok: false, message: 'La invitación no existe o fue reemplazada.' };
  if (invitation.status !== 'pending')
    return { ok: false, message: 'Esta invitación ya no está activa.' };
  if (Date.parse(invitation.expiresAt) <= Date.now())
    return { ok: false, message: 'La invitación venció. Solicita una nueva.' };
  return {
    ok: true,
    email: invitation.email,
    organizationName: invitation.organizationName,
    role: invitation.role,
    hasCredential: Boolean(invitation.hasCredential),
  };
}

export async function acceptInvitationToken(
  token: string,
  user: AppUser,
): Promise<
  | { ok: true; organizationId: string; organizationName: string }
  | { ok: false; message: string }
> {
  await ensureDatabase();
  if (token.length < 30)
    return { ok: false, message: 'El enlace de invitación no es válido.' };
  await ensureSaasUser(user);
  const tokenHash = await hashInvitationToken(token);
  const invitation = await env.DB.prepare(
    `SELECT i.id, i.clinic_id AS clinicId, i.email, i.role, i.status, i.expires_at AS expiresAt, c.name AS clinicName FROM invitations i JOIN clinics c ON c.id = i.clinic_id WHERE i.token_hash = ? LIMIT 1`,
  )
    .bind(tokenHash)
    .first<{
      id: string;
      clinicId: string;
      email: string;
      role: MembershipRole;
      status: string;
      expiresAt: string;
      clinicName: string;
    }>();
  if (!invitation)
    return { ok: false, message: 'La invitación no existe o fue reemplazada.' };
  if (invitation.email !== user.email.trim().toLocaleLowerCase('es-MX'))
    return {
      ok: false,
      message:
        'Inicia sesión con el mismo correo electrónico que recibió la invitación.',
    };
  if (invitation.status === 'accepted')
    return {
      ok: true,
      organizationId: invitation.clinicId,
      organizationName: invitation.clinicName,
    };
  if (invitation.status !== 'pending')
    return { ok: false, message: 'Esta invitación ya no está activa.' };
  if (new Date(invitation.expiresAt).getTime() <= Date.now())
    return { ok: false, message: 'La invitación venció. Solicita una nueva.' };
  const plan = await env.DB.prepare(
    `SELECT p.max_users AS maxUsers, (SELECT COUNT(*) FROM memberships m WHERE m.clinic_id = s.clinic_id AND m.status = 'active') AS currentUsers FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id WHERE s.clinic_id = ?`,
  )
    .bind(invitation.clinicId)
    .first<{ maxUsers: number; currentUsers: number }>();
  if (plan && plan.currentUsers >= plan.maxUsers)
    return {
      ok: false,
      message: 'El negocio alcanzó el límite de usuarios de su plan.',
    };
  const now = new Date().toISOString();
  const proposedMembershipId = `membership_${crypto.randomUUID()}`;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO memberships (id, clinic_id, user_id, role, status, created_at) VALUES (?, ?, ?, ?, 'active', ?) ON CONFLICT(clinic_id, user_id) DO UPDATE SET role = excluded.role, status = 'active'`,
    ).bind(
      proposedMembershipId,
      invitation.clinicId,
      user.userId,
      invitation.role,
      now,
    ),
    env.DB.prepare(
      `UPDATE invitations SET status = 'accepted' WHERE id = ? AND token_hash = ? AND status = 'pending'`,
    ).bind(invitation.id, tokenHash),
    env.DB.prepare(
      `INSERT INTO audit_logs (id, clinic_id, actor, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, 'accept_invitation', 'membership', ?, ?, ?)`,
    ).bind(
      `audit_${crypto.randomUUID()}`,
      invitation.clinicId,
      user.email,
      user.userId,
      JSON.stringify({ role: invitation.role }),
      now,
    ),
  ]);
  const membership = await env.DB.prepare(
    `SELECT id FROM memberships WHERE clinic_id = ? AND user_id = ? AND status = 'active'`,
  )
    .bind(invitation.clinicId, user.userId)
    .first<{ id: string }>();
  const assignedLocations = await env.DB.prepare(
    `SELECT location_id AS locationId FROM invitation_locations WHERE invitation_id = ?`,
  )
    .bind(invitation.id)
    .all<{ locationId: string }>();
  if (membership && assignedLocations.results.length) {
    await env.DB.batch(
      assignedLocations.results.map(({ locationId }) =>
        env.DB.prepare(
          `INSERT OR IGNORE INTO membership_locations (id, clinic_id, membership_id, location_id, created_at) VALUES (?, ?, ?, ?, ?)`,
        ).bind(
          `membership_location_${crypto.randomUUID()}`,
          invitation.clinicId,
          membership.id,
          locationId,
          now,
        ),
      ),
    );
  }
  return {
    ok: true,
    organizationId: invitation.clinicId,
    organizationName: invitation.clinicName,
  };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '');
}
