import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ensureDatabase } from '@/db/initialize';

export type AppUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

type CredentialRow = {
  userId: string;
  email: string;
  fullName: string | null;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  failedAttempts: number;
  lockedUntil: string | null;
};

export const SESSION_COOKIE = 'asistente_h_session';
const SESSION_DAYS = 14;
// Cloudflare Workers currently caps Web Crypto PBKDF2 at 100,000 iterations.
const PASSWORD_ITERATIONS = 100_000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function getAuthenticatedUser(): Promise<AppUser | null> {
  await ensureDatabase();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = await sha256(token);
  const session = await env.DB.prepare(
    `SELECT u.id AS userId, u.email, u.full_name AS fullName
     FROM auth_sessions s
     JOIN saas_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?
     LIMIT 1`,
  )
    .bind(tokenHash, new Date().toISOString())
    .first<{ userId: string; email: string; fullName: string | null }>();
  return session ? toAppUser(session) : null;
}

export async function requireAuthenticatedUser(
  returnTo: string,
): Promise<AppUser> {
  const user = await getAuthenticatedUser();
  if (user) return user;
  redirect(loginPath(returnTo));
}

export function loginPath(returnTo = '/app') {
  return `/login?next=${encodeURIComponent(safeRelativePath(returnTo))}`;
}

export async function authenticateWithPassword(
  emailInput: string,
  password: string,
): Promise<{ ok: true; user: AppUser } | { ok: false; message: string }> {
  await ensureDatabase();
  const email = normalizeEmail(emailInput);
  const credential = await env.DB.prepare(
    `SELECT u.id AS userId, u.email, u.full_name AS fullName,
            c.password_hash AS passwordHash, c.password_salt AS passwordSalt,
            c.password_iterations AS passwordIterations,
            c.failed_attempts AS failedAttempts, c.locked_until AS lockedUntil
     FROM auth_credentials c
     JOIN saas_users u ON u.id = c.user_id
     WHERE u.email = ? LIMIT 1`,
  )
    .bind(email)
    .first<CredentialRow>();

  if (credential?.lockedUntil && Date.parse(credential.lockedUntil) > Date.now())
    return {
      ok: false,
      message: 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.',
    };

  const valid = credential
    ? await verifyPassword(password, credential)
    : await verifyMissingCredential(password);
  if (!credential || !valid) {
    if (credential) await registerFailedAttempt(credential);
    return { ok: false, message: 'El correo o la contraseña no son correctos.' };
  }

  await env.DB.prepare(
    `UPDATE auth_credentials SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE user_id = ?`,
  )
    .bind(new Date().toISOString(), credential.userId)
    .run();
  return { ok: true, user: toAppUser(credential) };
}

export async function createPasswordCredential(
  userId: string,
  password: string,
): Promise<void> {
  validatePassword(password);
  const now = new Date().toISOString();
  const { hash, salt } = await hashPassword(password);
  await env.DB.prepare(
    `INSERT INTO auth_credentials
       (user_id, password_hash, password_salt, password_iterations, failed_attempts, locked_until, password_changed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       password_hash = excluded.password_hash,
       password_salt = excluded.password_salt,
       password_iterations = excluded.password_iterations,
       failed_attempts = 0,
       locked_until = NULL,
       password_changed_at = excluded.password_changed_at,
       updated_at = excluded.updated_at`,
  )
    .bind(userId, hash, salt, PASSWORD_ITERATIONS, now, now, now)
    .run();
}

export async function createSession(userId: string): Promise<void> {
  const { token, expiresAt } = await issueSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function issueSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  await ensureDatabase();
  const token = randomToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_DAYS * 24 * 60 * 60_000,
  );
  await env.DB.batch([
    env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(
      now.toISOString(),
    ),
    env.DB.prepare(
      `INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      `session_${crypto.randomUUID()}`,
      userId,
      await sha256(token),
      expiresAt.toISOString(),
      now.toISOString(),
      now.toISOString(),
    ),
  ]);
  return { token, expiresAt };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  } as const;
}

export async function destroySession(): Promise<void> {
  await ensureDatabase();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token)
    await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
      .bind(await sha256(token))
      .run();
  cookieStore.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function validatePassword(password: string): void {
  if (password.length < 12)
    throw new Error('La contraseña debe tener al menos 12 caracteres.');
  if (password.length > 128)
    throw new Error('La contraseña no puede exceder 128 caracteres.');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase('es-MX');
}

export function safeRelativePath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/app';
  try {
    const parsed = new URL(value, 'https://app.local');
    if (parsed.origin !== 'https://app.local') return '/app';
    if (parsed.pathname === '/login' || parsed.pathname === '/logout')
      return '/app';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/app';
  }
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64Url(bytes);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

export function secureEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const size = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < size; index += 1)
    difference |=
      (leftBytes[index % leftBytes.length] ?? 0) ^
      (rightBytes[index % rightBytes.length] ?? 0);
  return difference === 0;
}

async function hashPassword(password: string) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  return {
    hash: await derivePassword(password, saltBytes, PASSWORD_ITERATIONS),
    salt: bytesToBase64Url(saltBytes),
  };
}

async function verifyPassword(password: string, credential: CredentialRow) {
  const candidate = await derivePassword(
    password,
    base64UrlToBytes(credential.passwordSalt),
    credential.passwordIterations,
  );
  return secureEqual(candidate, credential.passwordHash);
}

async function verifyMissingCredential(password: string) {
  const salt = base64UrlToBytes('ZGVudG8tYWktZHVtbXktc2FsdA');
  const candidate = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return secureEqual(candidate, 'invalid-password-hash');
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
) {
  const saltBuffer = salt.buffer.slice(
    salt.byteOffset,
    salt.byteOffset + salt.byteLength,
  ) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations },
    key,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

async function registerFailedAttempt(credential: CredentialRow) {
  const failedAttempts = credential.failedAttempts + 1;
  const lockedUntil =
    failedAttempts >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
      : null;
  await env.DB.prepare(
    `UPDATE auth_credentials SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE user_id = ?`,
  )
    .bind(
      failedAttempts >= MAX_FAILED_ATTEMPTS ? 0 : failedAttempts,
      lockedUntil,
      new Date().toISOString(),
      credential.userId,
    )
    .run();
}

function toAppUser(row: {
  userId: string;
  email: string;
  fullName: string | null;
}): AppUser {
  return {
    userId: row.userId,
    email: row.email,
    fullName: row.fullName,
    displayName: row.fullName || row.email,
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

function base64UrlToBytes(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
