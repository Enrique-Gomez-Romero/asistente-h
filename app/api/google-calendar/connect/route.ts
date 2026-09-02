import { NextResponse } from 'next/server';

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
    const authorizationUrl = await buildGoogleCalendarAuthorizationUrl({
      clinicId,
      userId: access.user.userId,
      calendarId: params.get('calendarId'),
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
