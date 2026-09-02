import {
  completeGoogleCalendarAuthorization,
  syncUpcomingAppointmentsToGoogleCalendar,
  verifyOAuthState,
} from '@/lib/google-calendar';
import { getRequestUser, requireClinicAccess } from '@/lib/saas';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const destination = new URL('/app', request.url);
  try {
    if (params.get('error'))
      throw new Error('Google canceló o rechazó la autorización.');
    const code = params.get('code');
    const encodedState = params.get('state');
    if (!code || !encodedState)
      throw new Error('La respuesta de Google está incompleta.');
    const user = await getRequestUser();
    if (!user) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    const state = await verifyOAuthState(encodedState);
    if (state.userId !== user.userId)
      throw new Error('La conexión no pertenece a esta sesión.');
    await requireClinicAccess(state.clinicId, ['owner', 'admin']);
    const result = await completeGoogleCalendarAuthorization({
      code,
      state: encodedState,
      currentUserId: user.userId,
    });
    await syncUpcomingAppointmentsToGoogleCalendar(result.clinicId);
    destination.searchParams.set('organization', result.clinicId);
    destination.searchParams.set('googleCalendar', 'connected');
  } catch (error) {
    destination.searchParams.set('googleCalendar', 'error');
    destination.searchParams.set(
      'message',
      error instanceof Error
        ? error.message
        : 'No fue posible conectar Google Calendar.',
    );
  }
  return Response.redirect(destination, 302);
}
