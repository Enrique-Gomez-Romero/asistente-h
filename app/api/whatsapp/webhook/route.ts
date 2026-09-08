import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { ensureDatabase } from '@/db/initialize';
import { generateAssistantReply } from '@/lib/assistant';
import { enqueueAppointmentAutomations } from '@/lib/automations';
import { getAvailableSlots } from '@/lib/dental-data';
import { syncAppointmentToGoogleCalendar } from '@/lib/google-calendar';
import { logOperationalEvent } from '@/lib/observability';
import { normalizePhone } from '@/lib/phone';
import { appointmentEnd } from '@/lib/scheduling';
import { recordUsage, resolveWhatsAppConnection } from '@/lib/saas';
import { verifyWebhookSignature } from '@/lib/webhook-security';
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
        statuses?: Array<{
          id?: string;
          status?: string;
          errors?: Array<{ title?: string; message?: string }>;
        }>;
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
  const declaredSize = Number(request.headers.get('content-length') ?? 0);
  if (declaredSize > 1_000_000)
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000)
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret)
    return NextResponse.json(
      { error: 'Webhook is not configured' },
      { status: 503 },
    );
  const signature = request.headers.get('x-hub-signature-256');
  if (
    !signature ||
    !(await verifyWebhookSignature(rawBody, signature, appSecret))
  ) {
    logOperationalEvent('warn', 'whatsapp.invalid_signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  const payload = safePayload(rawBody);
  if (!payload)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  await ensureDatabase();

  let processedMessages = 0;
  let processedStatuses = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const status of value?.statuses ?? []) {
        if (!status.id) continue;
        const error = status.errors?.[0];
        await env.DB.prepare(
          `UPDATE messages SET delivery_status = ?, last_error = ? WHERE external_id = ?`,
        )
          .bind(
            status.status ?? 'unknown',
            error?.message ?? error?.title ?? null,
            status.id,
          )
          .run();
        processedStatuses += 1;
      }
      const phoneNumberId = value?.metadata?.phone_number_id;
      const connection = await resolveWhatsAppConnection(phoneNumberId);
      if (!connection) continue;
      const contactName =
        value?.contacts?.[0]?.profile?.name?.trim() || 'Paciente de WhatsApp';
      for (const message of value?.messages ?? []) {
        const normalizedPhone = message.from
          ? normalizePhone(message.from)
          : null;
        if (
          message.type !== 'text' ||
          !normalizedPhone ||
          !message.text?.body
        )
          continue;
        await processIncomingMessage(
          connection.clinicId,
          connection.locationId,
          normalizedPhone,
          contactName,
          message.text.body,
          message.id,
        );
        processedMessages += 1;
      }
    }
  }
  logOperationalEvent('info', 'whatsapp.webhook_processed', {
    processedMessages,
    processedStatuses,
  });
  return NextResponse.json({ received: true });
}

function safePayload(value: string): WhatsAppPayload | null {
  try {
    const payload = JSON.parse(value) as unknown;
    return payload && typeof payload === 'object'
      ? (payload as WhatsAppPayload)
      : null;
  } catch {
    return null;
  }
}

async function processIncomingMessage(
  clinicId: string,
  locationId: string | null,
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
    `SELECT id, bot_paused AS botPaused FROM conversations WHERE clinic_id = ? AND patient_id = ? AND location_id IS ? AND status = 'open' ORDER BY last_message_at DESC LIMIT 1`,
  )
    .bind(clinicId, patient.id, locationId)
    .first<{ id: string; botPaused: number }>();
  if (!conversation) {
    conversation = { id: `conv_${crypto.randomUUID()}`, botPaused: 0 };
    await env.DB.prepare(
      `INSERT INTO conversations (id, clinic_id, location_id, patient_id, channel, status, assigned_to, bot_paused, unread_count, last_message_at) VALUES (?, ?, ?, ?, 'whatsapp', 'open', NULL, 0, 1, ?)`,
    )
      .bind(conversation.id, clinicId, locationId, patient.id, now)
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
      `INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, delivery_status, last_error, created_at) VALUES (?, ?, 'inbound', 'patient', ?, ?, 'received', NULL, ?)`,
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
    conversation.id,
    patient.id,
    body,
  );
  if (automaticReply) {
    await storeAndSendReply(clinicId, locationId, conversation.id, phone, automaticReply);
    return;
  }
  const assistant = await generateAssistantReply(body, clinicId);
  if (assistant.toolsUsed.includes('request_human_help'))
    await escalateConversation(
      clinicId,
      conversation.id,
      'El paciente o el asistente solicitó apoyo humano.',
    );
  await storeAndSendReply(clinicId, locationId, conversation.id, phone, assistant.reply);
}

async function storeAndSendReply(
  clinicId: string,
  locationId: string | null,
  conversationId: string,
  phone: string,
  body: string,
) {
  const replyTime = new Date().toISOString();
  const messageId = `msg_${crypto.randomUUID()}`;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, delivery_status, last_error, created_at) VALUES (?, ?, 'outbound', 'assistant', ?, NULL, 'pending', NULL, ?)`,
    ).bind(messageId, conversationId, body, replyTime),
    env.DB.prepare(
      'UPDATE conversations SET last_message_at = ? WHERE id = ?',
    ).bind(replyTime, conversationId),
  ]);
  const delivery = await sendTenantWhatsAppText(clinicId, phone, body, locationId);
  await env.DB.prepare(
    `UPDATE messages SET external_id = ?, delivery_status = ?, last_error = ? WHERE id = ?`,
  )
    .bind(
      delivery.externalId ?? null,
      delivery.sent ? 'accepted' : 'failed',
      delivery.error ?? null,
      messageId,
    )
    .run();
  if (!delivery.sent)
    await env.DB.prepare(
      `INSERT INTO staff_notifications (id, clinic_id, user_id, kind, title, body, entity_type, entity_id, read_at, created_at) VALUES (?, ?, NULL, 'message_error', 'Mensaje no entregado', ?, 'conversation', ?, NULL, ?)`,
    )
      .bind(
        `notification_${crypto.randomUUID()}`,
        clinicId,
        delivery.error ?? 'Meta no confirmó la entrega del mensaje.',
        conversationId,
        replyTime,
      )
      .run();
}

async function processCommercialReply(
  clinicId: string,
  conversationId: string,
  patientId: string,
  body: string,
): Promise<string | null> {
  const normalized = body
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const pendingReply = await continuePendingFlow(
    clinicId,
    conversationId,
    patientId,
    normalized,
  );
  if (pendingReply) return pendingReply;

  if (/\b(agendar|reservar|sacar)\b.*\b(cita|consulta)\b|\bquiero una cita\b/.test(normalized))
    return startBookingFlow(clinicId, conversationId);
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
    `SELECT id, doctor_id AS doctorId, service_id AS serviceId, starts_at AS startsAt, ends_at AS endsAt FROM appointments WHERE clinic_id = ? AND patient_id = ? AND starts_at >= ? AND status IN ('pending', 'confirmed') ORDER BY starts_at LIMIT 1`,
  )
    .bind(clinicId, patientId, new Date().toISOString())
    .first<{
      id: string;
      doctorId: string;
      serviceId: string | null;
      startsAt: string;
      endsAt: string;
    }>();
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
    await syncAppointmentToGoogleCalendar(clinicId, appointment.id);
    await clearPendingFlow(conversationId);
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
    await syncAppointmentToGoogleCalendar(clinicId, appointment.id);
    await clearPendingFlow(conversationId);
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
  const slots = await getAvailableSlots(
    clinicId,
    date,
    appointment.doctorId,
    appointment.serviceId ?? undefined,
  );
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
  await setPendingFlow(conversationId, 'reschedule_slot', {
    appointmentId: appointment.id,
    slots,
  });
  const options = slots
    .slice(0, 3)
    .map((slot, index) => `${index + 1}. ${formatSlot(slot, clinic?.timezone)}`)
    .join('\n');
  return `Puedo proponerte estos horarios:\n${options}\nResponde con el número de tu opción para completar el cambio.`;
}

async function continuePendingFlow(
  clinicId: string,
  conversationId: string,
  patientId: string,
  normalized: string,
): Promise<string | null> {
  const flow = await env.DB.prepare(
    `SELECT pending_action AS action, pending_payload AS payload FROM conversations WHERE id = ? AND clinic_id = ?`,
  )
    .bind(conversationId, clinicId)
    .first<{ action: string | null; payload: string | null }>();
  if (!flow?.action) return null;
  if (/^(salir|detener|olvidar|cancelar proceso)$/.test(normalized)) {
    await clearPendingFlow(conversationId);
    return 'De acuerdo, cancelé el proceso. ¿En qué más puedo ayudarte?';
  }

  const payload = safeObject(flow.payload);
  const selectedIndex = /^\d+$/.test(normalized)
    ? Number(normalized) - 1
    : -1;
  if (selectedIndex < 0)
    return 'Responde con el número de una opción o escribe “cancelar proceso”.';

  if (flow.action === 'booking_service') {
    const serviceIds = stringArray(payload.serviceIds);
    const serviceId = serviceIds[selectedIndex];
    if (!serviceId) return 'Esa opción no existe. Elige uno de los números mostrados.';
    const doctors = await env.DB.prepare(
      `SELECT id, name FROM doctors WHERE clinic_id = ? AND active = 1 ORDER BY name LIMIT 8`,
    )
      .bind(clinicId)
      .all<{ id: string; name: string }>();
    if (!doctors.results.length) {
      await clearPendingFlow(conversationId);
      return 'No hay profesionales activos. Avisaré a recepción para ayudarte.';
    }
    await setPendingFlow(conversationId, 'booking_doctor', {
      serviceId,
      doctorIds: doctors.results.map((doctor) => doctor.id),
    });
    return `¿Con qué profesional deseas atenderte?\n${doctors.results
      .map((doctor, index) => `${index + 1}. ${doctor.name}`)
      .join('\n')}`;
  }

  if (flow.action === 'booking_doctor') {
    const doctorIds = stringArray(payload.doctorIds);
    const doctorId = doctorIds[selectedIndex];
    const serviceId = stringValue(payload.serviceId);
    if (!doctorId || !serviceId)
      return 'Esa opción no existe. Elige uno de los números mostrados.';
    const availability = await findNextAvailability(
      clinicId,
      doctorId,
      serviceId,
    );
    if (!availability) {
      await clearPendingFlow(conversationId);
      return 'No encontré horarios en los próximos días. Avisaré a recepción para ayudarte.';
    }
    await setPendingFlow(conversationId, 'booking_slot', {
      serviceId,
      doctorId,
      slots: availability.slots,
    });
    return `Encontré estos horarios:\n${availability.slots
      .map(
        (slot, index) =>
          `${index + 1}. ${formatSlot(slot, availability.timezone)}`,
      )
      .join('\n')}\nResponde con el número que prefieras.`;
  }

  if (flow.action === 'booking_slot') {
    const slots = stringArray(payload.slots);
    const startsAt = slots[selectedIndex];
    const serviceId = stringValue(payload.serviceId);
    const doctorId = stringValue(payload.doctorId);
    if (!startsAt || !serviceId || !doctorId)
      return 'Esa opción no existe. Elige uno de los números mostrados.';
    const result = await bookAppointmentForPatient({
      clinicId,
      conversationId,
      patientId,
      serviceId,
      doctorId,
      startsAt,
    });
    if (!result.ok) return result.message;
    await clearPendingFlow(conversationId);
    return result.message;
  }

  if (flow.action === 'reschedule_slot') {
    const slots = stringArray(payload.slots);
    const startsAt = slots[selectedIndex];
    const appointmentId = stringValue(payload.appointmentId);
    if (!startsAt || !appointmentId)
      return 'Esa opción no existe. Elige uno de los números mostrados.';
    const result = await rescheduleAppointment(
      clinicId,
      appointmentId,
      startsAt,
    );
    if (!result.ok) return result.message;
    await clearPendingFlow(conversationId);
    return result.message;
  }

  await clearPendingFlow(conversationId);
  return null;
}

async function startBookingFlow(
  clinicId: string,
  conversationId: string,
): Promise<string> {
  const services = await env.DB.prepare(
    `SELECT id, name, duration_minutes AS durationMinutes FROM services WHERE clinic_id = ? AND active = 1 ORDER BY name LIMIT 8`,
  )
    .bind(clinicId)
    .all<{ id: string; name: string; durationMinutes: number }>();
  if (!services.results.length)
    return 'El catálogo todavía no está configurado. Avisaré a recepción para ayudarte.';
  await setPendingFlow(conversationId, 'booking_service', {
    serviceIds: services.results.map((service) => service.id),
  });
  return `Claro. ¿Qué servicio necesitas?\n${services.results
    .map(
      (service, index) =>
        `${index + 1}. ${service.name} · ${service.durationMinutes} min`,
    )
    .join('\n')}`;
}

async function findNextAvailability(
  clinicId: string,
  doctorId: string,
  serviceId: string,
): Promise<{ slots: string[]; timezone: string } | null> {
  const clinic = await env.DB.prepare(
    `SELECT timezone FROM clinics WHERE id = ?`,
  )
    .bind(clinicId)
    .first<{ timezone: string }>();
  const timezone = clinic?.timezone ?? 'America/Mexico_City';
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = dateInTimeZone(offset, timezone);
    const slots = await getAvailableSlots(
      clinicId,
      date,
      doctorId,
      serviceId,
    );
    if (slots.length) return { slots: slots.slice(0, 5), timezone };
  }
  return null;
}

async function bookAppointmentForPatient(input: {
  clinicId: string;
  conversationId: string;
  patientId: string;
  serviceId: string;
  doctorId: string;
  startsAt: string;
}): Promise<{ ok: boolean; message: string }> {
  const [service, doctor, conversation] = await Promise.all([
    env.DB.prepare(
      `SELECT name, duration_minutes AS durationMinutes FROM services WHERE id = ? AND clinic_id = ? AND active = 1`,
    )
      .bind(input.serviceId, input.clinicId)
      .first<{ name: string; durationMinutes: number }>(),
    env.DB.prepare(
      `SELECT name FROM doctors WHERE id = ? AND clinic_id = ? AND active = 1`,
    )
      .bind(input.doctorId, input.clinicId)
      .first<{ name: string }>(),
    env.DB.prepare(
      `SELECT location_id AS locationId FROM conversations WHERE id = ? AND clinic_id = ?`,
    )
      .bind(input.conversationId, input.clinicId)
      .first<{ locationId: string | null }>(),
  ]);
  if (!service || !doctor)
    return { ok: false, message: 'El servicio o profesional ya no está disponible.' };
  const startsAt = new Date(input.startsAt);
  const endsAt = appointmentEnd(startsAt, service.durationMinutes);
  if (startsAt.getTime() <= Date.now())
    return { ok: false, message: 'Ese horario ya pasó. Inicia nuevamente la reservación.' };
  const appointmentId = `appt_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const insert = await env.DB.prepare(
    `INSERT INTO appointments (id, clinic_id, location_id, patient_id, doctor_id, service_id, starts_at, ends_at, status, source, notes, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'whatsapp', NULL, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM appointments WHERE clinic_id = ? AND doctor_id = ?
       AND status NOT IN ('cancelled', 'no_show') AND starts_at < ? AND ends_at > ?
     )`,
  )
    .bind(
      appointmentId,
      input.clinicId,
      conversation?.locationId ?? null,
      input.patientId,
      input.doctorId,
      input.serviceId,
      startsAt.toISOString(),
      endsAt.toISOString(),
      now,
      input.clinicId,
      input.doctorId,
      endsAt.toISOString(),
      startsAt.toISOString(),
    )
    .run();
  if (!insert.meta.changes)
    return {
      ok: false,
      message: 'Ese horario acaba de ocuparse. Inicia nuevamente para elegir otro.',
    };
  await env.DB.batch([
    patientEvent(
      input.clinicId,
      input.patientId,
      'Cita reservada por WhatsApp',
      appointmentId,
      now,
    ),
    staffNotification(
      input.clinicId,
      'Nueva cita por WhatsApp',
      `${service.name} con ${doctor.name}.`,
      appointmentId,
      now,
    ),
  ]);
  await enqueueAppointmentAutomations(input.clinicId, appointmentId);
  await syncAppointmentToGoogleCalendar(input.clinicId, appointmentId);
  const clinic = await env.DB.prepare(`SELECT timezone FROM clinics WHERE id = ?`)
    .bind(input.clinicId)
    .first<{ timezone: string }>();
  return {
    ok: true,
    message: `Listo. Tu cita para ${service.name} con ${doctor.name} quedó confirmada el ${formatSlot(startsAt.toISOString(), clinic?.timezone)}.`,
  };
}

async function rescheduleAppointment(
  clinicId: string,
  appointmentId: string,
  startsAtValue: string,
): Promise<{ ok: boolean; message: string }> {
  const appointment = await env.DB.prepare(
    `SELECT doctor_id AS doctorId, starts_at AS startsAt, ends_at AS endsAt FROM appointments WHERE id = ? AND clinic_id = ? AND status IN ('pending', 'confirmed')`,
  )
    .bind(appointmentId, clinicId)
    .first<{ doctorId: string; startsAt: string; endsAt: string }>();
  if (!appointment)
    return { ok: false, message: 'La cita ya no está disponible para reprogramarse.' };
  const duration =
    new Date(appointment.endsAt).getTime() -
    new Date(appointment.startsAt).getTime();
  const startsAt = new Date(startsAtValue);
  const endsAt = new Date(startsAt.getTime() + duration);
  const update = await env.DB.prepare(
    `UPDATE appointments SET starts_at = ?, ends_at = ?, status = 'confirmed'
     WHERE id = ? AND clinic_id = ?
     AND NOT EXISTS (
       SELECT 1 FROM appointments other WHERE other.clinic_id = ?
       AND other.doctor_id = ? AND other.id <> ?
       AND other.status NOT IN ('cancelled', 'no_show')
       AND other.starts_at < ? AND other.ends_at > ?
     )`,
  )
    .bind(
      startsAt.toISOString(),
      endsAt.toISOString(),
      appointmentId,
      clinicId,
      clinicId,
      appointment.doctorId,
      appointmentId,
      endsAt.toISOString(),
      startsAt.toISOString(),
    )
    .run();
  if (!update.meta.changes)
    return { ok: false, message: 'Ese horario acaba de ocuparse. Elige otra opción.' };
  await env.DB.prepare(
    `UPDATE scheduled_messages SET status = 'cancelled', last_error = 'Cita reprogramada' WHERE clinic_id = ? AND appointment_id = ? AND status = 'pending'`,
  )
    .bind(clinicId, appointmentId)
    .run();
  await enqueueAppointmentAutomations(clinicId, appointmentId);
  await syncAppointmentToGoogleCalendar(clinicId, appointmentId);
  const clinic = await env.DB.prepare(`SELECT timezone FROM clinics WHERE id = ?`)
    .bind(clinicId)
    .first<{ timezone: string }>();
  return {
    ok: true,
    message: `Tu cita quedó reprogramada para ${formatSlot(startsAt.toISOString(), clinic?.timezone)}.`,
  };
}

async function setPendingFlow(
  conversationId: string,
  action: string,
  payload: Record<string, unknown>,
) {
  await env.DB.prepare(
    `UPDATE conversations SET pending_action = ?, pending_payload = ? WHERE id = ?`,
  )
    .bind(action, JSON.stringify(payload), conversationId)
    .run();
}

async function clearPendingFlow(conversationId: string) {
  await env.DB.prepare(
    `UPDATE conversations SET pending_action = NULL, pending_payload = NULL WHERE id = ?`,
  )
    .bind(conversationId)
    .run();
}

async function escalateConversation(
  clinicId: string,
  conversationId: string,
  reason: string,
) {
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE conversations SET bot_paused = 1, assigned_to = 'Recepción', pending_action = NULL, pending_payload = NULL WHERE id = ? AND clinic_id = ?`,
    ).bind(conversationId, clinicId),
    env.DB.prepare(
      `INSERT INTO staff_notifications (id, clinic_id, user_id, kind, title, body, entity_type, entity_id, read_at, created_at) VALUES (?, ?, NULL, 'human_help', 'Paciente solicita atención humana', ?, 'conversation', ?, NULL, ?)`,
    ).bind(
      `notification_${crypto.randomUUID()}`,
      clinicId,
      reason,
      conversationId,
      now,
    ),
  ]);
}

function safeObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function dateInTimeZone(offsetDays: number, timeZone: string): string {
  const current = new Date();
  current.setUTCDate(current.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(current);
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
