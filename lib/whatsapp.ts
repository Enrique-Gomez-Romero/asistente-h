import { env } from 'cloudflare:workers';

import { ensureDatabase } from '@/db/initialize';
import { accessOrganizationSecret } from '@/lib/integration-secrets';
import { normalizePhone } from '@/lib/phone';
import { recordUsage } from '@/lib/saas';

export type WhatsAppSendResult = {
  sent: boolean;
  externalId?: string;
  error?: string;
};

export async function sendTenantWhatsAppText(
  clinicId: string,
  phone: string,
  body: string,
  locationId?: string | null,
): Promise<WhatsAppSendResult> {
  return sendTenantWhatsAppPayload(clinicId, phone, {
    type: 'text',
    text: { body },
  }, locationId);
}

export async function sendTenantWhatsAppTemplate(
  clinicId: string,
  phone: string,
  templateName: string,
  language: string,
  bodyParameter: string,
): Promise<WhatsAppSendResult> {
  if (!/^[a-z0-9_]+$/.test(templateName))
    return { sent: false, error: 'La plantilla de WhatsApp no es válida.' };
  return sendTenantWhatsAppPayload(clinicId, phone, {
    type: 'template',
    template: {
      name: templateName,
      language: { code: language || 'es_MX' },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: bodyParameter }],
        },
      ],
    },
  });
}

async function sendTenantWhatsAppPayload(
  clinicId: string,
  phone: string,
  content: Record<string, unknown>,
  locationId?: string | null,
): Promise<WhatsAppSendResult> {
  await ensureDatabase();
  const recipient = normalizePhone(phone);
  if (!recipient)
    return { sent: false, error: 'El número de WhatsApp no es válido.' };

  const credentials = await getTenantCredentials(clinicId, locationId);
  if (!credentials.ok) return { sent: false, error: credentials.error };

  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0'}/${credentials.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          ...content,
        }),
      },
    );
  } catch {
    return {
      sent: false,
      error: 'No fue posible comunicarse con Meta. Se intentará nuevamente.',
    };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return {
      sent: false,
      error: `Meta respondió ${response.status}${detail ? `: ${detail.slice(0, 160)}` : '.'}`,
    };
  }

  const result = (await response.json().catch(() => null)) as {
    messages?: Array<{ id?: string }>;
  } | null;
  await recordUsage(clinicId, 'whatsapp_message');
  return { sent: true, externalId: result?.messages?.[0]?.id };
}

async function getTenantCredentials(
  clinicId: string,
  locationId?: string | null,
): Promise<
  | { ok: true; phoneNumberId: string; accessToken: string }
  | { ok: false; error: string }
> {
  const connection = await env.DB.prepare(
    `SELECT phone_number_id AS phoneNumberId, secret_reference AS secretReference FROM integration_connections WHERE clinic_id = ? AND provider = 'whatsapp' AND status = 'connected' AND ((? IS NULL AND location_id IS NULL) OR (? IS NOT NULL AND (location_id = ? OR location_id IS NULL))) ORDER BY CASE WHEN location_id = ? THEN 0 WHEN location_id IS NULL THEN 1 ELSE 2 END, created_at LIMIT 1`,
  )
    .bind(
      clinicId,
      locationId ?? null,
      locationId ?? null,
      locationId ?? null,
      locationId ?? null,
    )
    .first<{
      phoneNumberId: string | null;
      secretReference: string | null;
    }>();
  const phoneNumberId =
    connection?.phoneNumberId ||
    (clinicId === 'clinic_demo' ? process.env.WHATSAPP_PHONE_NUMBER_ID : null);
  if (!phoneNumberId)
    return {
      ok: false,
      error: 'WhatsApp todavía no está conectado para esta organización.',
    };

  if (connection?.secretReference) {
    try {
      return {
        ok: true,
        phoneNumberId,
        accessToken: await accessOrganizationSecret(
          connection.secretReference,
          clinicId,
          'whatsapp',
        ),
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No fue posible leer la credencial de WhatsApp.',
      };
    }
  }

  if (
    process.env.WHATSAPP_ACCESS_TOKEN &&
    phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID
  )
    return {
      ok: true,
      phoneNumberId,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    };

  return {
    ok: false,
    error: 'La conexión requiere un token seguro por organización.',
  };
}
