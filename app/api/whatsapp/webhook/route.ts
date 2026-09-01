import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { ensureDatabase } from '@/db/initialize';
import { generateAssistantReply } from '@/lib/assistant';

type WhatsAppMessage = { id?: string; from?: string; type?: string; text?: { body?: string } };
type WhatsAppPayload = {
  entry?: Array<{ changes?: Array<{ value?: { contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>; messages?: WhatsAppMessage[] } }> }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (process.env.META_APP_SECRET) {
    const signature = request.headers.get('x-hub-signature-256');
    if (!signature || !(await verifySignature(rawBody, signature, process.env.META_APP_SECRET))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }
  const payload = JSON.parse(rawBody) as WhatsAppPayload;
  await ensureDatabase();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contactName = value?.contacts?.[0]?.profile?.name?.trim() || 'Paciente de WhatsApp';
      for (const message of value?.messages ?? []) {
        if (message.type !== 'text' || !message.from || !message.text?.body) continue;
        await processIncomingMessage(message.from, contactName, message.text.body, message.id);
      }
    }
  }
  return NextResponse.json({ received: true });
}

async function processIncomingMessage(phone: string, name: string, body: string, externalId?: string) {
  if (externalId) {
    const duplicate = await env.DB.prepare('SELECT id FROM messages WHERE external_id = ? LIMIT 1').bind(externalId).first<{ id: string }>();
    if (duplicate) return;
  }
  let patient = await env.DB.prepare(`SELECT id FROM patients WHERE clinic_id = 'clinic_demo' AND phone = ?`).bind(phone).first<{ id: string }>();
  const now = new Date().toISOString();
  if (!patient) {
    patient = { id: `pat_${crypto.randomUUID()}` };
    await env.DB.prepare(`INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, created_at) VALUES (?, 'clinic_demo', ?, ?, NULL, NULL, NULL, ?)`).bind(patient.id, name, phone, now).run();
  }
  let conversation = await env.DB.prepare(`SELECT id, bot_paused AS botPaused FROM conversations WHERE clinic_id = 'clinic_demo' AND patient_id = ? AND status = 'open' ORDER BY last_message_at DESC LIMIT 1`).bind(patient.id).first<{ id: string; botPaused: number }>();
  if (!conversation) {
    conversation = { id: `conv_${crypto.randomUUID()}`, botPaused: 0 };
    await env.DB.prepare(`INSERT INTO conversations (id, clinic_id, patient_id, channel, status, assigned_to, bot_paused, unread_count, last_message_at) VALUES (?, 'clinic_demo', ?, 'whatsapp', 'open', NULL, 0, 1, ?)`).bind(conversation.id, patient.id, now).run();
  }
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, 'inbound', 'patient', ?, ?, ?)`).bind(`msg_${crypto.randomUUID()}`, conversation.id, body, externalId ?? null, now),
    env.DB.prepare('UPDATE conversations SET last_message_at = ?, unread_count = unread_count + 1 WHERE id = ?').bind(now, conversation.id),
  ]);

  if (conversation.botPaused) return;
  const assistant = await generateAssistantReply(body);
  const replyTime = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, 'outbound', 'assistant', ?, NULL, ?)`).bind(`msg_${crypto.randomUUID()}`, conversation.id, assistant.reply, replyTime),
    env.DB.prepare('UPDATE conversations SET last_message_at = ? WHERE id = ?').bind(replyTime, conversation.id),
  ]);
  await sendWhatsAppText(phone, assistant.reply);
}

async function sendWhatsAppText(phone: string, body: string) {
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) return;
  const response = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: phone.replace(/\D/g, ''), type: 'text', text: { body } }),
  });
  if (!response.ok) console.error('WhatsApp response failed', response.status);
}

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = `sha256=${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let index = 0; index < expected.length; index += 1) result |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  return result === 0;
}
