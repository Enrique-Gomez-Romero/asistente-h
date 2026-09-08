'use server';

import { env } from 'cloudflare:workers';
import { revalidatePath } from 'next/cache';

import { ensureDatabase } from '@/db/initialize';
import {
  accessOrganizationSecret,
  deleteOrganizationSecret,
  googleSecretManagerConfigured,
  storeOrganizationSecret,
} from '@/lib/google-secrets';
import { requireClinicAccess } from '@/lib/saas';

export type MetaActionResult = {
  ok: boolean;
  message: string;
  displayPhoneNumber?: string;
};

export async function completeMetaEmbeddedSignup(input: {
  clinicId: string;
  locationId: string;
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
    const location = await env.DB.prepare(
      `SELECT id FROM locations WHERE id = ? AND clinic_id = ? AND active = 1`,
    )
      .bind(input.locationId, input.clinicId)
      .first();
    if (!location) throw new Error('Selecciona una sucursal válida.');
    if (!googleSecretManagerConfigured())
      throw new Error(
        'Configura Google Secret Manager antes de conectar números reales.',
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
      `whatsapp-${input.phoneNumberId}`,
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
    const token = await accessOrganizationSecret(connection.secretReference);
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0';
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
    const connection = await env.DB.prepare(
      `SELECT secret_reference AS secretReference FROM integration_connections WHERE id = ? AND clinic_id = ? AND provider = 'whatsapp'`,
    )
      .bind(connectionId, clinicId)
      .first<{ secretReference: string | null }>();
    if (connection?.secretReference)
      await deleteOrganizationSecret(connection.secretReference);
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
