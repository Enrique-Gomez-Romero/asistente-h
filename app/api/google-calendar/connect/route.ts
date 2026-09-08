import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';

import { buildGoogleCalendarAuthorizationUrl } from '@/lib/google-calendar';
import { requireClinicAccess } from '@/lib/saas';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const clinicId = params.get('clinicId')?.trim();
    if (!clinicId)
      return NextResponse.json(
        { error: 'Falta seleccionar una organización.' },
        { status: 400 },
      );
    const access = await requireClinicAccess(clinicId, ['owner', 'admin']);
    const locationId = params.get('locationId')?.trim() || null;
    if (locationId) {
      const location = await env.DB.prepare(
        `SELECT id FROM locations WHERE id = ? AND clinic_id = ? AND active = 1`,
      )
        .bind(locationId, clinicId)
        .first();
      if (!location)
        return NextResponse.json({ error: 'La sucursal no es válida.' }, { status: 400 });
    }
    const authorizationUrl = await buildGoogleCalendarAuthorizationUrl({
      clinicId,
      userId: access.user.userId,
      calendarId: params.get('calendarId'),
      locationId,
      label: params.get('label'),
    });
    return Response.redirect(authorizationUrl, 302);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No fue posible iniciar la conexión con Google.',
      },
      { status: 400 },
    );
  }
}
