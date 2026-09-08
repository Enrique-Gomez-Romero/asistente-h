import { env } from 'cloudflare:workers';

import { ensureDatabase } from '@/db/initialize';
import {
  accessOrganizationSecret,
  integrationCredentialEncryptionConfigured,
  storeOrganizationSecret,
} from '@/lib/integration-secrets';
import { logOperationalEvent } from '@/lib/observability';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const accessTokenCache = new Map<string, { token: string; expiresAt: number }>();

type OAuthState = {
  clinicId: string;
  connectionId: string;
  locationId: string | null;
  label: string;
  userId: string;
  calendarId: string;
  expiresAt: number;
  nonce: string;
};

type StoredGoogleCredential = {
  refreshToken: string;
  scope?: string;
  tokenType?: string;
};

export function googleCalendarConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_STATE_SECRET &&
      process.env.PUBLIC_APP_URL &&
      integrationCredentialEncryptionConfigured(),
  );
}

export async function buildGoogleCalendarAuthorizationUrl(input: {
  clinicId: string;
  userId: string;
  calendarId?: string | null;
  locationId?: string | null;
  label?: string | null;
}) {
  if (!googleCalendarConfigured())
    throw new Error('Google Calendar todavía no está configurado en el servidor.');
  const state = await signOAuthState({
    clinicId: input.clinicId,
    connectionId: `integration_${crypto.randomUUID()}`,
    locationId: input.locationId?.trim() || null,
    label: input.label?.trim() || 'Google Calendar',
    userId: input.userId,
    calendarId: input.calendarId?.trim() || 'primary',
    expiresAt: Date.now() + 10 * 60_000,
    nonce: crypto.randomUUID(),
  });
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: required('GOOGLE_CLIENT_ID'),
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: CALENDAR_SCOPE,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  }).toString();
  return url.toString();
}

export async function completeGoogleCalendarAuthorization(input: {
  code: string;
  state: string;
  currentUserId: string;
}) {
  const state = await verifyOAuthState(input.state);
  if (state.userId !== input.currentUserId)
    throw new Error('La conexión de Google no pertenece a esta sesión.');
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code,
      client_id: required('GOOGLE_CLIENT_ID'),
      client_secret: required('GOOGLE_CLIENT_SECRET'),
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    refresh_token?: string;
    scope?: string;
    token_type?: string;
    error_description?: string;
  };
  if (!response.ok || !result.refresh_token)
    throw new Error(
      result.error_description ||
        'Google no entregó permiso permanente. Intenta conectar nuevamente.',
    );
  const secretReference = await storeOrganizationSecret(
    state.clinicId,
    'google_calendar',
    JSON.stringify({
      refreshToken: result.refresh_token,
      scope: result.scope,
      tokenType: result.token_type,
    } satisfies StoredGoogleCredential),
  );
  const now = new Date().toISOString();
  await ensureDatabase();
  await env.DB.prepare(
    `INSERT INTO integration_connections (id, clinic_id, location_id, provider, label, status, external_account_id, secret_reference, created_at, updated_at)
     VALUES (?, ?, ?, 'google_calendar', ?, 'connected', ?, ?, ?, ?)`,
  )
    .bind(
      state.connectionId,
      state.clinicId,
      state.locationId,
      state.label,
      state.calendarId,
      secretReference,
      now,
      now,
    )
    .run();
  logOperationalEvent('info', 'google_calendar.connected', {
    clinicId: state.clinicId,
    calendarId: state.calendarId,
  });
  return { clinicId: state.clinicId };
}

export async function syncAppointmentToGoogleCalendar(
  clinicId: string,
  appointmentId: string,
): Promise<{ synced: boolean; error?: string }> {
  try {
    await ensureDatabase();
    const [connection, appointment] = await Promise.all([
      env.DB.prepare(
        `SELECT ic.external_account_id AS calendarId, ic.secret_reference AS secretReference FROM integration_connections ic LEFT JOIN appointments a ON a.id = ? WHERE ic.clinic_id = ? AND ic.provider = 'google_calendar' AND ic.status = 'connected' AND (ic.location_id = a.location_id OR ic.location_id IS NULL) ORDER BY CASE WHEN ic.location_id = a.location_id THEN 0 ELSE 1 END, ic.created_at LIMIT 1`,
      )
        .bind(appointmentId, clinicId)
        .first<{ calendarId: string | null; secretReference: string | null }>(),
      env.DB.prepare(
        `SELECT a.id, a.starts_at AS startsAt, a.ends_at AS endsAt, a.status, a.notes, a.google_event_id AS googleEventId,
                c.name AS clinicName, c.timezone, p.full_name AS patientName, p.phone AS patientPhone,
                d.name AS doctorName, COALESCE(s.name, 'Cita') AS serviceName
         FROM appointments a
         JOIN clinics c ON c.id = a.clinic_id
         JOIN doctors d ON d.id = a.doctor_id
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN services s ON s.id = a.service_id
         WHERE a.id = ? AND a.clinic_id = ?`,
      )
        .bind(appointmentId, clinicId)
        .first<{
          id: string;
          startsAt: string;
          endsAt: string;
          status: string;
          notes: string | null;
          googleEventId: string | null;
          clinicName: string;
          timezone: string;
          patientName: string | null;
          patientPhone: string | null;
          doctorName: string;
          serviceName: string;
        }>(),
    ]);
    if (!connection?.secretReference || !appointment) return { synced: false };
    const accessToken = await refreshGoogleAccessToken(
      connection.secretReference,
      clinicId,
    );
    const calendarId = encodeURIComponent(connection.calendarId || 'primary');
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

    if (appointment.status === 'cancelled') {
      if (!appointment.googleEventId) return { synced: true };
      const response = await fetch(
        `${baseUrl}/${encodeURIComponent(appointment.googleEventId)}`,
        { method: 'DELETE', headers: googleApiHeaders(accessToken) },
      );
      if (!response.ok && response.status !== 404 && response.status !== 410)
        throw new Error(`Google Calendar rechazó la cancelación (${response.status}).`);
      await env.DB.prepare(
        'UPDATE appointments SET google_event_id = NULL WHERE id = ? AND clinic_id = ?',
      )
        .bind(appointmentId, clinicId)
        .run();
      return { synced: true };
    }

    const payload = {
      summary: `${appointment.serviceName} · ${appointment.patientName ?? 'Paciente'}`,
      description: [
        `Profesional: ${appointment.doctorName}`,
        appointment.patientPhone ? `Teléfono: ${appointment.patientPhone}` : null,
        appointment.notes ? `Notas: ${appointment.notes}` : null,
        `Origen: Asistente H (${appointment.id})`,
      ]
        .filter(Boolean)
        .join('\n'),
      start: { dateTime: appointment.startsAt, timeZone: appointment.timezone },
      end: { dateTime: appointment.endsAt, timeZone: appointment.timezone },
      extendedProperties: {
        private: { asistenteHAppointmentId: appointment.id },
      },
    };
    let response: Response;
    if (appointment.googleEventId) {
      response = await fetch(
        `${baseUrl}/${encodeURIComponent(appointment.googleEventId)}`,
        {
          method: 'PATCH',
          headers: googleApiHeaders(accessToken),
          body: JSON.stringify(payload),
        },
      );
      if (response.status === 404 || response.status === 410)
        response = await insertGoogleEvent(baseUrl, accessToken, payload);
    } else {
      response = await insertGoogleEvent(baseUrl, accessToken, payload);
    }
    if (!response.ok)
      throw new Error(`Google Calendar rechazó la sincronización (${response.status}).`);
    const result = (await response.json()) as { id?: string };
    if (!result.id) throw new Error('Google Calendar no devolvió el evento creado.');
    await env.DB.prepare(
      'UPDATE appointments SET google_event_id = ? WHERE id = ? AND clinic_id = ?',
    )
      .bind(result.id, appointmentId, clinicId)
      .run();
    return { synced: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    logOperationalEvent('error', 'google_calendar.sync_failed', {
      clinicId,
      appointmentId,
      error: message,
    });
    return { synced: false, error: message };
  }
}

export async function syncUpcomingAppointmentsToGoogleCalendar(
  clinicId: string,
  limit = 100,
) {
  await ensureDatabase();
  const appointments = await env.DB.prepare(
    `SELECT id FROM appointments WHERE clinic_id = ? AND starts_at >= ? AND status IN ('pending', 'confirmed') ORDER BY starts_at LIMIT ?`,
  )
    .bind(clinicId, new Date().toISOString(), Math.min(Math.max(limit, 1), 100))
    .all<{ id: string }>();
  let synced = 0;
  let failed = 0;
  for (const appointment of appointments.results) {
    const result = await syncAppointmentToGoogleCalendar(
      clinicId,
      appointment.id,
    );
    if (result.synced) synced += 1;
    else if (result.error) failed += 1;
  }
  return { processed: appointments.results.length, synced, failed };
}

export async function signOAuthState(payload: OAuthState) {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmac(encoded, required('GOOGLE_OAUTH_STATE_SECRET'));
  return `${encoded}.${signature}`;
}

export async function verifyOAuthState(value: string): Promise<OAuthState> {
  const [encoded, signature, extra] = value.split('.');
  if (!encoded || !signature || extra)
    throw new Error('El estado de autorización de Google no es válido.');
  const expected = await hmac(encoded, required('GOOGLE_OAUTH_STATE_SECRET'));
  if (!constantTimeEqual(signature, expected))
    throw new Error('El estado de autorización de Google fue alterado.');
  let payload: OAuthState;
  try {
    payload = JSON.parse(base64UrlDecode(encoded)) as OAuthState;
  } catch {
    throw new Error('El estado de autorización de Google no se puede leer.');
  }
  if (
    !payload.clinicId ||
    !payload.connectionId ||
    typeof payload.label !== 'string' ||
    !payload.userId ||
    !payload.calendarId ||
    !payload.nonce ||
    payload.expiresAt < Date.now()
  )
    throw new Error('La autorización de Google expiró. Inicia nuevamente.');
  return payload;
}

async function refreshGoogleAccessToken(
  secretReference: string,
  clinicId: string,
) {
  const cached = accessTokenCache.get(secretReference);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const credential = JSON.parse(
    await accessOrganizationSecret(
      secretReference,
      clinicId,
      'google_calendar',
    ),
  ) as StoredGoogleCredential;
  if (!credential.refreshToken)
    throw new Error('La credencial de Google Calendar está incompleta.');
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: required('GOOGLE_CLIENT_ID'),
      client_secret: required('GOOGLE_CLIENT_SECRET'),
      refresh_token: credential.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !result.access_token)
    throw new Error(
      result.error_description || 'Google no pudo renovar la autorización.',
    );
  accessTokenCache.set(secretReference, {
    token: result.access_token,
    expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  });
  return result.access_token;
}

function insertGoogleEvent(
  baseUrl: string,
  accessToken: string,
  payload: Record<string, unknown>,
) {
  return fetch(baseUrl, {
    method: 'POST',
    headers: googleApiHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

function googleApiHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function googleRedirectUri() {
  return `${required('PUBLIC_APP_URL').replace(/\/$/, '')}/api/google-calendar/callback`;
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const result = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(result));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function base64UrlEncode(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlDecode(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '');
}

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Falta configurar ${key}.`);
  return value;
}
