'use server';

import { env } from 'cloudflare:workers';
import { revalidatePath } from 'next/cache';

import { ensureDatabase } from '@/db/initialize';

export type ActionResult = { ok: boolean; message: string };

type AppointmentInput = {
  patientName: string;
  phone: string;
  email?: string;
  serviceId: string;
  doctorId: string;
  startsAtLocal: string;
  notes?: string;
};

export async function createAppointment(input: AppointmentInput): Promise<ActionResult> {
  await ensureDatabase();
  const patientName = input.patientName.trim();
  const phone = input.phone.trim();
  if (patientName.length < 2 || phone.replace(/\D/g, '').length < 8) {
    return { ok: false, message: 'Escribe el nombre y un teléfono válido.' };
  }

  const service = await env.DB.prepare('SELECT id, duration_minutes AS durationMinutes FROM services WHERE id = ? AND active = 1').bind(input.serviceId).first<{ id: string; durationMinutes: number }>();
  const doctor = await env.DB.prepare('SELECT id FROM doctors WHERE id = ? AND active = 1').bind(input.doctorId).first<{ id: string }>();
  if (!service || !doctor) return { ok: false, message: 'El servicio o doctor seleccionado ya no está disponible.' };

  const startsAt = parseMexicoLocalDate(input.startsAtLocal);
  if (!startsAt || Number.isNaN(startsAt.getTime())) return { ok: false, message: 'Selecciona una fecha y hora válidas.' };
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
  const conflict = await env.DB.prepare(`SELECT id FROM appointments WHERE doctor_id = ? AND status NOT IN ('cancelled', 'no_show') AND starts_at < ? AND ends_at > ? LIMIT 1`).bind(input.doctorId, endsAt.toISOString(), startsAt.toISOString()).first<{ id: string }>();
  if (conflict) return { ok: false, message: 'Ese horario acaba de ocuparse. Elige otro horario.' };

  const patient = await env.DB.prepare(`SELECT id FROM patients WHERE clinic_id = 'clinic_demo' AND phone = ?`).bind(phone).first<{ id: string }>();
  const now = new Date().toISOString();
  const patientId = patient?.id ?? `pat_${crypto.randomUUID()}`;
  const appointmentId = `appt_${crypto.randomUUID()}`;

  const statements = [];
  if (!patient) {
    statements.push(env.DB.prepare(`INSERT INTO patients (id, clinic_id, full_name, phone, email, notes, last_visit_at, created_at) VALUES (?, 'clinic_demo', ?, ?, ?, NULL, NULL, ?)`).bind(patientId, patientName, phone, input.email?.trim() || null, now));
  } else {
    statements.push(env.DB.prepare(`UPDATE patients SET full_name = ?, email = COALESCE(?, email) WHERE id = ?`).bind(patientName, input.email?.trim() || null, patientId));
  }
  statements.push(
    env.DB.prepare(`INSERT INTO appointments (id, clinic_id, patient_id, doctor_id, service_id, starts_at, ends_at, status, source, notes, created_at) VALUES (?, 'clinic_demo', ?, ?, ?, ?, ?, 'pending', 'manual', ?, ?)`).bind(appointmentId, patientId, input.doctorId, input.serviceId, startsAt.toISOString(), endsAt.toISOString(), input.notes?.trim() || null, now),
    env.DB.prepare(`INSERT INTO audit_logs (id, clinic_id, actor, action, entity_type, entity_id, details, created_at) VALUES (?, 'clinic_demo', 'panel', 'create', 'appointment', ?, ?, ?)`).bind(`audit_${crypto.randomUUID()}`, appointmentId, JSON.stringify({ patientName, startsAt: startsAt.toISOString() }), now),
  );
  await env.DB.batch(statements);
  revalidatePath('/');
  return { ok: true, message: 'Cita creada correctamente. Quedó pendiente de confirmación.' };
}

export async function setAppointmentStatus(id: string, status: string): Promise<ActionResult> {
  await ensureDatabase();
  const allowed = new Set(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']);
  if (!allowed.has(status)) return { ok: false, message: 'Estado no permitido.' };
  const result = await env.DB.prepare('UPDATE appointments SET status = ? WHERE id = ?').bind(status, id).run();
  if (!result.meta.changes) return { ok: false, message: 'No se encontró la cita.' };
  await logAudit('update_status', 'appointment', id, { status });
  revalidatePath('/');
  return { ok: true, message: 'Estado de la cita actualizado.' };
}

export async function createService(input: { name: string; category: string; durationMinutes: number; pricePesos: number; description?: string }): Promise<ActionResult> {
  await ensureDatabase();
  if (input.name.trim().length < 3 || input.durationMinutes < 10 || input.pricePesos < 0) {
    return { ok: false, message: 'Revisa el nombre, duración y precio del servicio.' };
  }
  const id = `service_${crypto.randomUUID()}`;
  await env.DB.prepare(`INSERT INTO services (id, clinic_id, name, category, description, duration_minutes, price_cents, active) VALUES (?, 'clinic_demo', ?, ?, ?, ?, ?, 1)`).bind(id, input.name.trim(), input.category.trim() || 'General', input.description?.trim() || null, Math.round(input.durationMinutes), Math.round(input.pricePesos * 100)).run();
  await logAudit('create', 'service', id, { name: input.name });
  revalidatePath('/');
  return { ok: true, message: 'Servicio agregado al catálogo.' };
}

export async function toggleService(id: string, active: boolean): Promise<ActionResult> {
  await ensureDatabase();
  await env.DB.prepare('UPDATE services SET active = ? WHERE id = ?').bind(active ? 1 : 0, id).run();
  await logAudit('toggle', 'service', id, { active });
  revalidatePath('/');
  return { ok: true, message: active ? 'Servicio activado.' : 'Servicio pausado.' };
}

export async function toggleBotPaused(conversationId: string, paused: boolean): Promise<ActionResult> {
  await ensureDatabase();
  await env.DB.prepare(`UPDATE conversations SET bot_paused = ?, assigned_to = ? WHERE id = ?`).bind(paused ? 1 : 0, paused ? 'Dra. Renata' : null, conversationId).run();
  await logAudit(paused ? 'human_takeover' : 'resume_bot', 'conversation', conversationId, null);
  revalidatePath('/');
  return { ok: true, message: paused ? 'La conversación quedó a cargo de una persona.' : 'El asistente volvió a atender la conversación.' };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await ensureDatabase();
  await env.DB.prepare('UPDATE conversations SET unread_count = 0 WHERE id = ?').bind(conversationId).run();
  revalidatePath('/');
}

export async function sendConversationMessage(conversationId: string, body: string): Promise<ActionResult> {
  await ensureDatabase();
  const message = body.trim();
  if (!message) return { ok: false, message: 'Escribe un mensaje.' };
  const conversation = await env.DB.prepare('SELECT id FROM conversations WHERE id = ?').bind(conversationId).first<{ id: string }>();
  if (!conversation) return { ok: false, message: 'No se encontró la conversación.' };
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO messages (id, conversation_id, direction, author_type, body, external_id, created_at) VALUES (?, ?, 'outbound', 'staff', ?, NULL, ?)`).bind(`msg_${crypto.randomUUID()}`, conversationId, message, now),
    env.DB.prepare('UPDATE conversations SET last_message_at = ?, unread_count = 0 WHERE id = ?').bind(now, conversationId),
  ]);
  await sendWhatsAppText(conversationId, message);
  revalidatePath('/');
  return { ok: true, message: 'Mensaje enviado.' };
}

async function sendWhatsAppText(conversationId: string, body: string): Promise<void> {
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) return;
  const patient = await env.DB.prepare(`SELECT p.phone FROM conversations c JOIN patients p ON p.id = c.patient_id WHERE c.id = ?`).bind(conversationId).first<{ phone: string }>();
  if (!patient) return;
  const response = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: patient.phone.replace(/\D/g, ''), type: 'text', text: { body } }),
  });
  if (!response.ok) console.error('WhatsApp send failed', response.status);
}

async function logAudit(action: string, entityType: string, entityId: string, details: unknown): Promise<void> {
  await env.DB.prepare(`INSERT INTO audit_logs (id, clinic_id, actor, action, entity_type, entity_id, details, created_at) VALUES (?, 'clinic_demo', 'panel', ?, ?, ?, ?, ?)`).bind(`audit_${crypto.randomUUID()}`, action, entityType, entityId, details ? JSON.stringify(details) : null, new Date().toISOString()).run();
}

function parseMexicoLocalDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return new Date(`${value}:00-06:00`);
}
