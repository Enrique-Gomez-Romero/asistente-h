import { env } from 'cloudflare:workers';

import { ensureDatabase } from '@/db/initialize';
import { recordUsage } from '@/lib/saas';

export async function sendTenantWhatsAppText(
  clinicId: string,
  phone: string,
  body: string,
): Promise<{ sent: boolean; error?: string }> {
  await ensureDatabase();
  const connection = await env.DB.prepare(
    `SELECT phone_number_id AS phoneNumberId, status FROM integration_connections WHERE clinic_id = ? AND provider = 'whatsapp'`,
  )
    .bind(clinicId)
    .first<{ phoneNumberId: string | null; status: string }>();
  const configuredPhoneNumberId =
    connection?.phoneNumberId ||
    (clinicId === 'clinic_demo' ? process.env.WHATSAPP_PHONE_NUMBER_ID : null);
  if (!configuredPhoneNumberId)
    return {
      sent: false,
      error: 'WhatsApp todavía no está conectado para esta organización.',
    };
  if (
    !process.env.WHATSAPP_ACCESS_TOKEN ||
    configuredPhoneNumberId !== process.env.WHATSAPP_PHONE_NUMBER_ID
  )
    return {
      sent: false,
      error: 'La conexión requiere un token seguro por organización.',
    };

  const response = await fetch(
    `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0'}/${configuredPhoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/\D/g, ''),
        type: 'text',
        text: { body },
      }),
    },
  );
  if (!response.ok)
    return { sent: false, error: `Meta respondió ${response.status}.` };
  await recordUsage(clinicId, 'whatsapp_message');
  return { sent: true };
}
