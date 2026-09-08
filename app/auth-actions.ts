'use server';

import { env } from 'cloudflare:workers';
import { redirect } from 'next/navigation';

import { ensureDatabase } from '@/db/initialize';
import {
  authenticateWithPassword,
  createPasswordCredential,
  createSession,
  normalizeEmail,
  randomToken,
  safeRelativePath,
  secureEqual,
  sha256,
  validatePassword,
  type AppUser,
} from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';
import { acceptInvitationToken, getInvitationDetails } from '@/lib/invitations';

export type AuthActionState = {
  ok: boolean;
  message: string;
};

export const initialAuthState: AuthActionState = { ok: false, message: '' };

export async function loginAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = formText(formData, 'email');
  const password = formText(formData, 'password');
  const next = safeRelativePath(formText(formData, 'next') || '/app');
  const result = await authenticateWithPassword(email, password);
  if (!result.ok) return result;
  await createSession(result.user.userId);
  const platformAdmin = await isPlatformAdmin(result.user.userId);
  redirect(next === '/app' && platformAdmin ? '/platform' : next);
}

export async function bootstrapAdminAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  await ensureDatabase();
  const setupToken = formText(formData, 'setupToken');
  const expectedToken = process.env.AUTH_SETUP_TOKEN ?? '';
  if (expectedToken.length < 32 || !secureEqual(setupToken, expectedToken))
    return { ok: false, message: 'El enlace de configuración no es válido.' };
  const existingAdminCredential = await env.DB.prepare(
    `SELECT c.user_id FROM auth_credentials c
     JOIN platform_admins p ON p.user_id = c.user_id LIMIT 1`,
  ).first();
  if (existingAdminCredential)
    return {
      ok: false,
      message: 'La cuenta administrativa inicial ya fue configurada.',
    };

  const email = normalizeEmail(formText(formData, 'email'));
  const fullName = formText(formData, 'fullName').trim();
  const password = formText(formData, 'password');
  const confirmation = formText(formData, 'passwordConfirmation');
  if (!/^\S+@\S+\.\S+$/.test(email) || fullName.length < 2)
    return { ok: false, message: 'Revisa tu nombre y correo electrónico.' };
  if (password !== confirmation)
    return { ok: false, message: 'Las contraseñas no coinciden.' };
  try {
    validatePassword(password);
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }

  const now = new Date().toISOString();
  const existingUser = await env.DB.prepare(
    'SELECT id FROM saas_users WHERE email = ? LIMIT 1',
  )
    .bind(email)
    .first<{ id: string }>();
  const userId = existingUser?.id ?? `user_${crypto.randomUUID()}`;
  const statements = existingUser
    ? [
        env.DB.prepare(
          'UPDATE saas_users SET full_name = ?, last_seen_at = ? WHERE id = ?',
        ).bind(fullName, now, userId),
      ]
    : [
        env.DB.prepare(
          `INSERT INTO saas_users (id, email, full_name, created_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?)`,
        ).bind(userId, email, fullName, now, now),
      ];
  statements.push(
    env.DB.prepare(
      'INSERT OR IGNORE INTO platform_admins (user_id, created_at) VALUES (?, ?)',
    ).bind(userId, now),
  );
  await env.DB.batch(statements);
  await createPasswordCredential(userId, password);
  await createSession(userId);
  redirect('/platform');
}

export async function registerInvitedUserAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  await ensureDatabase();
  const token = formText(formData, 'token');
  const invitation = await getInvitationDetails(token);
  if (!invitation.ok) return invitation;
  if (invitation.hasCredential)
    return {
      ok: false,
      message:
        'Ya existe una cuenta con este correo. Inicia sesión para aceptar la invitación.',
    };
  const fullName = formText(formData, 'fullName').trim();
  const password = formText(formData, 'password');
  const confirmation = formText(formData, 'passwordConfirmation');
  if (fullName.length < 2)
    return { ok: false, message: 'Escribe tu nombre completo.' };
  if (password !== confirmation)
    return { ok: false, message: 'Las contraseñas no coinciden.' };
  try {
    validatePassword(password);
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }

  const email = normalizeEmail(invitation.email);
  const now = new Date().toISOString();
  const existingUser = await env.DB.prepare(
    'SELECT id FROM saas_users WHERE email = ? LIMIT 1',
  )
    .bind(email)
    .first<{ id: string }>();
  const userId = existingUser?.id ?? `user_${crypto.randomUUID()}`;
  if (existingUser)
    await env.DB.prepare(
      'UPDATE saas_users SET full_name = ?, last_seen_at = ? WHERE id = ?',
    )
      .bind(fullName, now, userId)
      .run();
  else
    await env.DB.prepare(
      `INSERT INTO saas_users (id, email, full_name, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(userId, email, fullName, now, now)
      .run();
  await createPasswordCredential(userId, password);
  const user: AppUser = {
    userId,
    email,
    fullName,
    displayName: fullName,
  };
  const result = await acceptInvitationToken(token, user);
  if (!result.ok) return result;
  await createSession(userId);
  redirect(
    `/app?organization=${encodeURIComponent(result.organizationId)}&joined=1`,
  );
}

export async function requestPasswordResetAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  await ensureDatabase();
  const email = normalizeEmail(formText(formData, 'email'));
  const credential = await env.DB.prepare(
    `SELECT u.id AS userId, u.email
     FROM saas_users u JOIN auth_credentials c ON c.user_id = u.id
     WHERE u.email = ? LIMIT 1`,
  )
    .bind(email)
    .first<{ userId: string; email: string }>();
  if (credential) {
    const token = randomToken();
    const tokenHash = await sha256(token);
    const resetId = `reset_${crypto.randomUUID()}`;
    const now = new Date();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE password_reset_tokens SET used_at = ?
         WHERE user_id = ? AND used_at IS NULL`,
      ).bind(now.toISOString(), credential.userId),
      env.DB.prepare(
        `INSERT INTO password_reset_tokens
         (id, user_id, token_hash, expires_at, used_at, created_at)
         VALUES (?, ?, ?, ?, NULL, ?)`,
      ).bind(
        resetId,
        credential.userId,
        tokenHash,
        new Date(now.getTime() + 30 * 60_000).toISOString(),
        now.toISOString(),
      ),
    ]);
    await sendPasswordResetEmail({
      resetId,
      recipient: credential.email,
      token,
    });
  }
  return {
    ok: true,
    message:
      'Si existe una cuenta con ese correo, recibirás un enlace que vence en 30 minutos.',
  };
}

export async function resetPasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  await ensureDatabase();
  const token = formText(formData, 'token');
  const password = formText(formData, 'password');
  const confirmation = formText(formData, 'passwordConfirmation');
  if (password !== confirmation)
    return { ok: false, message: 'Las contraseñas no coinciden.' };
  try {
    validatePassword(password);
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
  const tokenHash = await sha256(token);
  const reset = await env.DB.prepare(
    `SELECT id, user_id AS userId FROM password_reset_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? LIMIT 1`,
  )
    .bind(tokenHash, new Date().toISOString())
    .first<{ id: string; userId: string }>();
  if (!reset)
    return {
      ok: false,
      message: 'El enlace no es válido o ya venció. Solicita uno nuevo.',
    };
  await createPasswordCredential(reset.userId, password);
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE password_reset_tokens SET used_at = ? WHERE id = ?',
    ).bind(new Date().toISOString(), reset.id),
    env.DB.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(
      reset.userId,
    ),
  ]);
  await createSession(reset.userId);
  redirect('/app');
}

async function isPlatformAdmin(userId: string) {
  await ensureDatabase();
  return Boolean(
    await env.DB.prepare(
      'SELECT user_id FROM platform_admins WHERE user_id = ?',
    )
      .bind(userId)
      .first(),
  );
}

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'No se pudo completar la solicitud.';
}
