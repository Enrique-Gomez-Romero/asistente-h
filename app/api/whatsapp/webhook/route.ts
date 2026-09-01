import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { ensureDatabase } from '@/db/initialize';
import { generateAssistantReply } from '@/lib/assistant';
import { enqueueAppointmentAutomations } from '@/lib/automations';
import { getAvailableSlots } from '@/lib/dental-data';
import { recordUsage, resolveClinicByWhatsAppNumber } from '@/lib/saas';
import { sendTenantWhatsAppText } from '@/lib/whatsapp';

type WhatsAppMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
};
type WhatsAppPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: WhatsAppMessage[];
      };
    }>;
  }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (
    mode === 'subscribe' &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(challenge ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (process.env.META_APP_SECRET) {
    const signature = request.headers.get('x-hub-signature-256');
    if (
      !signature ||
      !(await verifySignature(rawBody, signature, process.env.META_APP_SECRET))
    ) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }
  const payload = JSON.parse(rawBody) as WhatsAppPayload;
  await ensureDatabase();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      const clinicId = await resolveClinicByWhatsAppNumber(phoneNumberId);
      if (!clinicId) continue;
      const contactName =
        value?.contacts?.[0]?.profile?.name?.trim() || 'Paciente de WhatsApp';
      for (const message of value?.messages ?? []) {
        if (message.type !== 'text' || !message.from || !message.text?.body)
          continue;
        await processIncomingMessage(
          clinicId,
          message.from,
          contactName,
          message.text.body,
          message.id,
        );
      }
    }
  }
  return NextResponse.json({ received: true });
}

async function processIncomingMessage(
  clinicId: string,
  phone: string,
  name: string,
  body: string,
  externalId?: string,
) {
  if (externalId) {
    const duplicate = await env.DB.prepare(
      'SELECT id FROM messages WHERE external_id = ? LIMIT 1',
    )
      .bind(externalId)
      .first<{ id: string }>();
    if (duplicate) return;
  }
  let patient = await env.DB.prepare(
    'SELECT id FROM patients WHERE clinic_id = ? AND phone = ?',
  )
    .bind(clinicId, phone)
    .first<{ id: string }>();
  const now = new Date().toISOString();
  if (!patient) {
    patient = { id: `pat_${crypto.randomUUID()}` };
    await env.DB.prepare(
      'INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, created_at) VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?)',
    )
      .bind(patient.id, clinicId, name, phone, now)
      .run();
  }
  let conversation = await env.DB.prepare(
    `SELECT id, bot_paused AS botPaused FROM conversations WHERE clinic_id = ? AND patient_id = ? AND status = 'open' ORDER BY last_message_at DESC LIMIT 1`,
  )
    .bind(clinicId, patient.id)
    .first<{ id: string; botPaused: number }>();
  if (!conversation) {
    conversation = { id: `conv_${crypto.randomUUID()}`, botPaused: 0 };
    await env.DB.prepare(
      `INSERT INTO conversations (id, clinic_id, patient_id, channel, status, assigned_to, bot_paused, unread_count, last_message_at) VALUES (?, ?, ?, 'whatsapp', 'open', NULL, 0, 1, ?)`,
    )
      .bind(conversation.id, clinicId, patient.id, now)
      .run();
    await recordUsage(
      clinicId,
      'conversation',
      1,
      `conversation:${conversation.id}`,
    );
  }
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, 'inbound', 'patient', ?, ?, ?)`,
    ).bind(
      `msg_${crypto.randomUUID()}`,
      conversation.id,
      body,
      externalId ?? null,
      now,
    ),
    env.DB.prepare(
      'UPDATE conversations SET last_message_at = ?, unread_count = unread_count + 1 WHERE id = ?',
    ).bind(now, conversation.id),
  ]);
  await recordUsage(
    clinicId,
    'whatsapp_message',
    1,
    externalId ? `whatsapp:${externalId}` : undefined,
  );

  if (conversation.botPaused) return;
  const automaticReply = await processCommercialReply(
    clinicId,
    patient.id,
    body,
  );
  if (automaticReply) {
    await storeAndSendReply(clinicId, conversation.id, phone, automaticReply);
    return;
  }
  const assistant = await generateAssistantReply(body, clinicId);
  await storeAndSendReply(clinicId, conversation.id, phone, assistant.reply);
}

async function storeAndSendReply(
  clinicId: string,
  conversationId: string,
  phone: string,
  body: string,
) {
  const replyTime = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, 'outbound', 'assistant', ?, NULL, ?)`,
    ).bind(`msg_${crypto.randomUUID()}`, conversationId, body, replyTime),
    env.DB.prepare(
      'UPDATE conversations SET last_message_at = ? WHERE id = ?',
    ).bind(replyTime, conversationId),
  ]);
  await sendTenantWhatsAppText(clinicId, phone, body);
}

async function processCommercialReply(
  clinicId: string,
  patientId: string,
  body: string,
): Promise<string | null> {
  const normalized = body
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (/^[1-5]$/.test(normalized)) {
    const survey = await env.DB.prepare(
      `SELECT id FROM surveys WHERE clinic_id = ? AND patient_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(clinicId, patientId)
      .first<{ id: string }>();
    if (survey) {
      await env.DB.prepare(
        `UPDATE surveys SET score = ?, status = 'responded', responded_at = ? WHERE id = ? AND clinic_id = ?`,
      )
        .bind(Number(normalized), new Date().toISOString(), survey.id, clinicId)
        .run();
      return '¡Gracias por compartir tu experiencia! Tu respuesta quedó registrada.';
    }
  }

  const intent = normalized.includes('reprogram')
    ? 'reschedule'
    : normalized.includes('cancel')
      ? 'cancel'
      : /^(confirmar|confirmo|si|sí)$/.test(normalized)
        ? 'confirm'
        : null;
  if (!intent) return null;
  const appointment = await env.DB.prepare(
    `SELECT id, doctor_id AS doctorId, starts_at AS startsAt FROM appointments WHERE clinic_id = ? AND patient_id = ? AND starts_at >= ? AND status IN ('pending', 'confirmed') ORDER BY starts_at LIMIT 1`,
  )
    .bind(clinicId, patientId, new Date().toISOString())
    .first<{ id: string; doctorId: string; startsAt: string }>();
  if (!appointment)
    return 'No encontré una cita próxima pendiente. El equipo revisará tu mensaje para ayudarte.';
  const now = new Date().toISOString();
  if (intent === 'confirm') {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE appointments SET status = 'confirmed' WHERE id = ? AND clinic_id = ?`,
      ).bind(appointment.id, clinicId),
      patientEvent(
        clinicId,
        patientId,
        'Cita confirmada por WhatsApp',
        appointment.id,
        now,
      ),
    ]);
    await enqueueAppointmentAutomations(clinicId, appointment.id);
    return 'Tu cita quedó confirmada. Te enviaremos un recordatorio antes de tu visita.';
  }
  if (intent === 'cancel') {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE appointments SET status = 'cancelled' WHERE id = ? AND clinic_id = ?`,
      ).bind(appointment.id, clinicId),
      patientEvent(
        clinicId,
        patientId,
        'Cita cancelada por WhatsApp',
        appointment.id,
        now,
      ),
      staffNotification(
        clinicId,
        'Cita cancelada por WhatsApp',
        'Se liberó un espacio de agenda. Revisa la lista de espera.',
        appointment.id,
        now,
      ),
    ]);
    return 'Tu cita quedó cancelada. Si deseas una nueva fecha, responde REPROGRAMAR.';
  }

  const clinic = await env.DB.prepare(
    `SELECT timezone FROM clinics WHERE id = ?`,
  )
    .bind(clinicId)
    .first<{ timezone: string }>();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60_000);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: clinic?.timezone ?? 'America/Mexico_City',
  }).format(tomorrow);
  const slots = await getAvailableSlots(clinicId, date, appointment.doctorId);
  await env.DB.batch([
    patientEvent(
      clinicId,
      patientId,
      'Reprogramación solicitada por WhatsApp',
      appointment.id,
      now,
    ),
    staffNotification(
      clinicId,
      'Solicitud de reprogramación',
      'Un paciente solicitó otra fecha desde WhatsApp.',
      appointment.id,
      now,
    ),
  ]);
  if (!slots.length)
    return 'Recibimos tu solicitud de reprogramación. El equipo te propondrá nuevos horarios.';
  const options = slots
    .slice(0, 3)
    .map((slot, index) => `${index + 1}. ${formatSlot(slot, clinic?.timezone)}`)
    .join('\n');
  return `Puedo proponerte estos horarios:\n${options}\nResponde con tu opción y el equipo completará el cambio.`;
}

function patientEvent(
  clinicId: string,
  patientId: string,
  title: string,
  entityId: string,
  createdAt: string,
) {
  return env.DB.prepare(
    `INSERT INTO patient_events (id, clinic_id, patient_id, kind, title, details, entity_id, created_at) VALUES (?, ?, ?, 'appointment_status', ?, NULL, ?, ?)`,
  ).bind(
    `patient_event_${crypto.randomUUID()}`,
    clinicId,
    patientId,
    title,
    entityId,
    createdAt,
  );
}

function staffNotification(
  clinicId: string,
  title: string,
  body: string,
  entityId: string,
  createdAt: string,
) {
  return env.DB.prepare(
    `INSERT INTO staff_notifications (id, clinic_id, user_id, kind, title, body, entity_type, entity_id, read_at, created_at) VALUES (?, ?, NULL, 'appointment', ?, ?, 'appointment', ?, NULL, ?)`,
  ).bind(
    `notification_${crypto.randomUUID()}`,
    clinicId,
    title,
    body,
    entityId,
    createdAt,
  );
}

function formatSlot(value: string, timeZone = 'America/Mexico_City') {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

async function verifySignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(body),
  );
  const expected = `sha256=${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let index = 0; index < expected.length; index += 1)
    result |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  return result === 0;
}
