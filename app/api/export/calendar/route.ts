import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { ensureDatabase } from '@/db/initialize';
import { requireClinicAccess } from '@/lib/saas';

type CalendarAppointment = {
  id: string;
  patientName: string;
  serviceName: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
};

export async function GET(request: Request) {
  await ensureDatabase();
  const clinicId = new URL(request.url).searchParams.get('clinicId');
  if (!clinicId)
    return NextResponse.json(
      { error: 'clinicId es obligatorio.' },
      { status: 400 },
    );
  await requireClinicAccess(clinicId, ['owner', 'admin', 'staff', 'viewer']);
  const clinic = await env.DB.prepare('SELECT name FROM clinics WHERE id = ?')
    .bind(clinicId)
    .first<{ name: string }>();
  if (!clinic)
    return NextResponse.json(
      { error: 'Negocio no encontrado.' },
      { status: 404 },
    );
  const rows = await env.DB.prepare(
    `SELECT a.id, COALESCE(p.full_name, 'Bloqueo') AS patientName, COALESCE(s.name, 'Bloqueo de agenda') AS serviceName, d.name AS professionalName, a.starts_at AS startsAt, a.ends_at AS endsAt, a.status, a.notes FROM appointments a JOIN doctors d ON d.id = a.doctor_id LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN services s ON s.id = a.service_id WHERE a.clinic_id = ? AND a.status NOT IN ('cancelled', 'no_show') ORDER BY a.starts_at`,
  )
    .bind(clinicId)
    .all<CalendarAppointment>();
  const stamp = icsDate(new Date().toISOString());
  const events = rows.results.flatMap((row) => [
    'BEGIN:VEVENT',
    `UID:${icsText(row.id)}@asistente-h`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsDate(row.startsAt)}`,
    `DTEND:${icsDate(row.endsAt)}`,
    `SUMMARY:${icsText(`${row.serviceName} · ${row.patientName}`)}`,
    `DESCRIPTION:${icsText(`Profesional: ${row.professionalName}\nEstado: ${row.status}${row.notes ? `\n${row.notes}` : ''}`)}`,
    'END:VEVENT',
  ]);
  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Asistente H//Agenda//ES',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsText(clinic.name)}`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
  return new Response(calendar, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="agenda-${clinicId}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

function icsDate(value: string) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function icsText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}
