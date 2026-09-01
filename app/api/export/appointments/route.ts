import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { ensureDatabase } from '@/db/initialize';
import { requireClinicAccess } from '@/lib/saas';

type ExportAppointment = {
  patientName: string;
  patientPhone: string | null;
  serviceName: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  source: string;
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
    `SELECT COALESCE(p.full_name, 'Bloqueo') AS patientName, p.phone AS patientPhone, COALESCE(s.name, 'Bloqueo de agenda') AS serviceName, d.name AS professionalName, a.starts_at AS startsAt, a.ends_at AS endsAt, a.status, a.source, a.notes FROM appointments a JOIN doctors d ON d.id = a.doctor_id LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN services s ON s.id = a.service_id WHERE a.clinic_id = ? ORDER BY a.starts_at DESC`,
  )
    .bind(clinicId)
    .all<ExportAppointment>();

  const headers = [
    'Paciente',
    'Teléfono',
    'Servicio',
    'Profesional',
    'Inicio',
    'Fin',
    'Estado',
    'Origen',
    'Notas',
  ];
  const csv = [
    headers,
    ...rows.results.map((row) => [
      row.patientName,
      row.patientPhone ?? '',
      row.serviceName,
      row.professionalName,
      row.startsAt,
      row.endsAt,
      row.status,
      row.source,
      row.notes ?? '',
    ]),
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  const filename = `${slugify(clinic.name)}-citas.csv`;
  return new Response(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function slugify(value: string) {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'asistente-h'
  );
}
