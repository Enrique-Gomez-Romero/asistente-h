'use server';

import { env } from 'cloudflare:workers';
import { revalidatePath } from 'next/cache';

import { ensureDatabase } from '@/db/initialize';
import {
  integrationCredentialEncryptionConfigured,
  storeOrganizationSecret,
} from '@/lib/integration-secrets';
import { requireClinicAccess } from '@/lib/saas';
import {
  readStoredWhatsAppCredentials,
  serializeWhatsAppCredentialBundle,
  whatsappCredentialScope,
} from '@/lib/whatsapp-credentials';

export type MetaActionResult = {
  ok: boolean;
  message: string;
  displayPhoneNumber?: string;
  setup?: {
    callbackUrl: string;
    verifyToken: string;
    appId: string;
  };
};

export async function connectCustomerMetaApp(input: {
  clinicId: string;
  locationId: string | null;
  label?: string;
  appId: string;
  appSecret: string;
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
}): Promise<MetaActionResult> {
  return metaAction(async () => {
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
    ]);
    const appId = numericId(input.appId, 'App ID');
    const wabaId = numericId(input.wabaId, 'WABA ID');
    const phoneNumberId = numericId(input.phoneNumberId, 'Phone Number ID');
    const appSecret = input.appSecret.trim();
    const accessToken = input.accessToken.trim();
    if (appSecret.length < 16)
      throw new Error('El App Secret de Meta no parece completo.');
    if (accessToken.length < 40)
      throw new Error('El token de acceso de WhatsApp no parece completo.');
    await validateLocation(input.clinicId, input.locationId);
    if (!integrationCredentialEncryptionConfigured())
      throw new Error(
        'Falta configurar la clave de cifrado del servidor antes de guardar credenciales.',
      );

    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0';
    const appAccessToken = `${appId}|${appSecret}`;
    const app = await graphRequest<{ id?: string; name?: string }>(
      graphVersion,
      `${appId}?fields=id,name`,
      appAccessToken,
      'No pudimos validar el App ID y el App Secret',
    );
    if (app.id !== appId)
      throw new Error('El App Secret no corresponde al App ID indicado.');

    const debugUrl = new URL(
      `https://graph.facebook.com/${graphVersion}/debug_token`,
    );
    debugUrl.searchParams.set('input_token', accessToken);
    const debugResponse = await fetch(debugUrl, {
      headers: { Authorization: `Bearer ${appAccessToken}` },
    });
    if (!debugResponse.ok)
      throw new Error(
        `Meta no pudo validar el token de WhatsApp (${debugResponse.status}).`,
      );
    const debug = (await debugResponse.json()) as {
      data?: { app_id?: string; is_valid?: boolean; expires_at?: number };
    };
    if (!debug.data?.is_valid)
      throw new Error('El token de acceso de WhatsApp no es válido.');
    if (debug.data.app_id !== appId)
      throw new Error(
        'El token de WhatsApp pertenece a otra aplicación de Meta.',
      );

    const [waba, phoneNumbers] = await Promise.all([
      graphRequest<{ id?: string; name?: string }>(
        graphVersion,
        `${wabaId}?fields=id,name`,
        accessToken,
        'No pudimos validar la cuenta de WhatsApp Business',
      ),
      graphRequest<{
        data?: Array<{
          id?: string;
          display_phone_number?: string;
          verified_name?: string;
        }>;
      }>(
        graphVersion,
        `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100`,
        accessToken,
        'No pudimos consultar los números de WhatsApp Business',
      ),
    ]);
    if (waba.id !== wabaId)
      throw new Error('El WABA ID no coincide con la cuenta autorizada.');
    const phone = phoneNumbers.data?.find((item) => item.id === phoneNumberId);
    if (!phone)
      throw new Error('El Phone Number ID no pertenece al WABA indicado.');

    const existing = await env.DB.prepare(
      `SELECT id, clinic_id AS clinicId FROM integration_connections WHERE provider = 'whatsapp' AND phone_number_id = ? LIMIT 1`,
    )
      .bind(phoneNumberId)
      .first<{ id: string; clinicId: string }>();
    if (existing && existing.clinicId !== input.clinicId)
      throw new Error(
        'Este número ya está conectado a otro negocio. Desconéctalo allí antes de moverlo.',
      );
    const connectionId = existing?.id ?? `integration_${crypto.randomUUID()}`;
    const verifyToken = `asistente_h_${crypto.randomUUID().replaceAll('-', '')}`;
    const setup = webhookSetup(connectionId, verifyToken, appId);
    const secretReference = await storeOrganizationSecret(
      input.clinicId,
      whatsappCredentialScope(connectionId),
      serializeWhatsAppCredentialBundle({
        version: 1,
        mode: 'customer_app',
        accessToken,
        appId,
        appSecret,
        verifyToken,
        graphVersion,
      }),
    );
    const subscriptionResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!subscriptionResponse.ok)
      throw new Error(
        `Meta no pudo suscribir la aplicación al WABA (${subscriptionResponse.status}).`,
      );
    const now = new Date().toISOString();
    const locationCondition = input.locationId
      ? 'location_id = ?'
      : 'location_id IS NULL';
    const disconnectBindings = input.locationId
      ? [now, input.clinicId, connectionId, input.locationId]
      : [now, input.clinicId, connectionId];
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE integration_connections SET status = 'disconnected', secret_reference = NULL, updated_at = ? WHERE clinic_id = ? AND provider = 'whatsapp' AND id <> ? AND ${locationCondition}`,
      ).bind(...disconnectBindings),
      env.DB.prepare(
        `INSERT INTO integration_connections (id, clinic_id, location_id, provider, label, status, external_account_id, phone_number_id, secret_reference, created_at, updated_at) VALUES (?, ?, ?, 'whatsapp', ?, 'connected', ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET clinic_id = excluded.clinic_id, location_id = excluded.location_id, label = excluded.label, status = 'connected', external_account_id = excluded.external_account_id, phone_number_id = excluded.phone_number_id, secret_reference = excluded.secret_reference, updated_at = excluded.updated_at`,
      ).bind(
        connectionId,
        input.clinicId,
        input.locationId,
        input.label?.trim() || phone.verified_name || app.name || 'WhatsApp',
        wabaId,
        phoneNumberId,
        secretReference,
        now,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO audit_logs (id, clinic_id, actor, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, 'connect_customer_app', 'integration', ?, ?, ?)`,
      ).bind(
        `audit_${crypto.randomUUID()}`,
        input.clinicId,
        access.user.email,
        connectionId,
        JSON.stringify({
          appId,
          wabaId,
          phoneNumberId,
          displayPhoneNumber: phone.display_phone_number ?? null,
          scope: input.locationId ? 'location' : 'organization',
          locationId: input.locationId,
          tokenExpiresAt: debug.data.expires_at || null,
        }),
        now,
      ),
    ]);
    const expirationWarning = debug.data.expires_at
      ? ' El token tiene vencimiento; cámbialo después por uno permanente de usuario del sistema.'
      : '';
    revalidatePath('/app');
    return {
      ok: true,
      message: `Las credenciales se validaron y guardaron cifradas.${expirationWarning}`,
      displayPhoneNumber: phone.display_phone_number,
      setup,
    };
  });
}

export async function getCustomerMetaWebhookSetup(
  clinicId: string,
  connectionId: string,
): Promise<MetaActionResult> {
  return metaAction(async () => {
    await requireClinicAccess(clinicId, ['owner', 'admin']);
    const connection = await env.DB.prepare(
      `SELECT id, secret_reference AS secretReference FROM integration_connections WHERE id = ? AND clinic_id = ? AND provider = 'whatsapp' AND status = 'connected'`,
    )
      .bind(connectionId, clinicId)
      .first<{ id: string; secretReference: string | null }>();
    if (!connection?.secretReference)
      throw new Error('WhatsApp todavía no está conectado.');
    const credentials = await readStoredWhatsAppCredentials({
      secretReference: connection.secretReference,
      clinicId,
      connectionId,
    });
    if (credentials.mode !== 'customer_app')
      throw new Error(
        'Esta conexión usa la configuración automática anterior y no requiere un webhook individual.',
      );
    return {
      ok: true,
      message:
        'Copia estos dos valores en la configuración de WhatsApp de Meta.',
      setup: webhookSetup(
        connectionId,
        credentials.verifyToken,
        credentials.appId,
      ),
    };
  });
}

export async function completeMetaEmbeddedSignup(input: {
  clinicId: string;
  locationId: string | null;
  label?: string;
  code: string;
  wabaId: string;
  phoneNumberId: string;
}): Promise<MetaActionResult> {
  return metaAction(async () => {
    const access = await requireClinicAccess(input.clinicId, [
      'owner',
      'admin',
    ]);
    if (
      input.code.length < 10 ||
      !/^\d+$/.test(input.wabaId) ||
      !/^\d+$/.test(input.phoneNumberId)
    )
      throw new Error('Meta no devolvió una autorización completa.');
    if (input.locationId) {
      const location = await env.DB.prepare(
        `SELECT id FROM locations WHERE id = ? AND clinic_id = ? AND active = 1`,
      )
        .bind(input.locationId, input.clinicId)
        .first();
      if (!location) throw new Error('Selecciona una sucursal válida.');
    }
    if (!integrationCredentialEncryptionConfigured())
      throw new Error(
        'Configura la clave de cifrado del servidor antes de conectar números reales.',
      );
    const appId = required('META_APP_ID');
    const appSecret = required('META_APP_SECRET');
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0';
    const tokenUrl = new URL(
      `https://graph.facebook.com/${graphVersion}/oauth/access_token`,
    );
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('code', input.code);
    const tokenResponse = await fetch(tokenUrl, { method: 'GET' });
    if (!tokenResponse.ok)
      throw new Error(
        `Meta rechazó la autorización (${tokenResponse.status}).`,
      );
    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
    };
    if (!tokenData.access_token)
      throw new Error('Meta no devolvió una credencial utilizable.');

    const phoneResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${input.phoneNumberId}?fields=id,display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );
    if (!phoneResponse.ok)
      throw new Error(
        `No pudimos verificar el número autorizado (${phoneResponse.status}).`,
      );
    const phoneData = (await phoneResponse.json()) as {
      id?: string;
      display_phone_number?: string;
      verified_name?: string;
    };
    if (phoneData.id !== input.phoneNumberId)
      throw new Error('El número verificado no coincide con la autorización.');

    const subscriptionResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${input.wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    if (!subscriptionResponse.ok)
      throw new Error(
        `Meta no pudo suscribir el webhook (${subscriptionResponse.status}).`,
      );

    const secretReference = await storeOrganizationSecret(
      input.clinicId,
      'whatsapp',
      tokenData.access_token,
    );
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO integration_connections (id, clinic_id, location_id, provider, label, status, external_account_id, phone_number_id, secret_reference, created_at, updated_at) VALUES (?, ?, ?, 'whatsapp', ?, 'connected', ?, ?, ?, ?, ?) ON CONFLICT(phone_number_id) DO UPDATE SET clinic_id = excluded.clinic_id, location_id = excluded.location_id, label = excluded.label, status = 'connected', external_account_id = excluded.external_account_id, secret_reference = excluded.secret_reference, updated_at = excluded.updated_at`,
      ).bind(
        `integration_${crypto.randomUUID()}`,
        input.clinicId,
        input.locationId,
        input.label?.trim() || phoneData.verified_name || 'WhatsApp',
        input.wabaId,
        input.phoneNumberId,
        secretReference,
        now,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO audit_logs (id, clinic_id, actor, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, 'connect', 'integration', 'whatsapp', ?, ?)`,
      ).bind(
        `audit_${crypto.randomUUID()}`,
        input.clinicId,
        access.user.email,
        JSON.stringify({
          wabaId: input.wabaId,
          phoneNumberId: input.phoneNumberId,
          displayPhoneNumber: phoneData.display_phone_number ?? null,
          verifiedName: phoneData.verified_name ?? null,
          scope: input.locationId ? 'location' : 'organization',
          locationId: input.locationId,
        }),
        now,
      ),
    ]);
    revalidatePath('/app');
    return {
      ok: true,
      message: 'WhatsApp quedó conectado y el webhook está suscrito.',
      displayPhoneNumber: phoneData.display_phone_number,
    };
  });
}

export async function testMetaConnection(
  clinicId: string,
  connectionId: string,
): Promise<MetaActionResult> {
  return metaAction(async () => {
    await requireClinicAccess(clinicId, ['owner', 'admin']);
    const connection = await env.DB.prepare(
      `SELECT phone_number_id AS phoneNumberId, secret_reference AS secretReference FROM integration_connections WHERE id = ? AND clinic_id = ? AND provider = 'whatsapp' AND status = 'connected'`,
    )
      .bind(connectionId, clinicId)
      .first<{
        phoneNumberId: string | null;
        secretReference: string | null;
      }>();
    if (!connection?.phoneNumberId || !connection.secretReference)
      throw new Error('WhatsApp todavía no está conectado.');
    const credentials = await readStoredWhatsAppCredentials({
      secretReference: connection.secretReference,
      clinicId,
      connectionId,
    });
    const token = credentials.accessToken;
    const graphVersion =
      credentials.mode === 'customer_app'
        ? credentials.graphVersion
        : (process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0');
    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${connection.phoneNumberId}?fields=display_phone_number`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok)
      throw new Error(`La conexión respondió ${response.status}.`);
    const data = (await response.json()) as { display_phone_number?: string };
    return {
      ok: true,
      message: 'La conexión con Meta está operativa.',
      displayPhoneNumber: data.display_phone_number,
    };
  });
}

export async function disconnectMetaWhatsApp(
  clinicId: string,
  connectionId: string,
): Promise<MetaActionResult> {
  return metaAction(async () => {
    const access = await requireClinicAccess(clinicId, ['owner', 'admin']);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE integration_connections SET status = 'disconnected', secret_reference = NULL, updated_at = ? WHERE id = ? AND clinic_id = ? AND provider = 'whatsapp'`,
      ).bind(now, connectionId, clinicId),
      env.DB.prepare(
        `INSERT INTO audit_logs (id, clinic_id, actor, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, 'disconnect', 'integration', 'whatsapp', NULL, ?)`,
      ).bind(`audit_${crypto.randomUUID()}`, clinicId, access.user.email, now),
    ]);
    revalidatePath('/app');
    return { ok: true, message: 'WhatsApp quedó desconectado.' };
  });
}

async function metaAction(
  operation: () => Promise<MetaActionResult>,
): Promise<MetaActionResult> {
  try {
    await ensureDatabase();
    return await operation();
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'No fue posible completar la conexión con Meta.',
    };
  }
}

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Falta configurar ${key}.`);
  return value;
}

async function validateLocation(clinicId: string, locationId: string | null) {
  if (!locationId) return;
  const location = await env.DB.prepare(
    `SELECT id FROM locations WHERE id = ? AND clinic_id = ? AND active = 1`,
  )
    .bind(locationId, clinicId)
    .first();
  if (!location) throw new Error('Selecciona una sucursal válida.');
}

function numericId(value: string, label: string) {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized))
    throw new Error(`${label} debe contener solamente números.`);
  return normalized;
}

async function graphRequest<T>(
  graphVersion: string,
  path: string,
  token: string,
  errorMessage: string,
): Promise<T> {
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${path}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error(`${errorMessage} (${response.status}).`);
  return (await response.json()) as T;
}

function webhookSetup(
  connectionId: string,
  verifyToken: string,
  appId: string,
) {
  const publicAppUrl = required('PUBLIC_APP_URL').replace(/\/$/, '');
  if (!publicAppUrl.startsWith('https://'))
    throw new Error(
      'PUBLIC_APP_URL debe usar HTTPS para configurar el webhook.',
    );
  return {
    callbackUrl: `${publicAppUrl}/api/whatsapp/webhook?connection=${encodeURIComponent(connectionId)}`,
    verifyToken,
    appId,
  };
}
