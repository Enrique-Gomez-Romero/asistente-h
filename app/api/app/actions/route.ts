import { NextResponse } from 'next/server';

import {
  anonymizePatient,
  createAppointment,
  createLocation,
  createOrganization,
  createProfessional,
  createService,
  disconnectGoogleCalendar,
  inviteMember,
  markConversationRead,
  resendInvitation,
  revokeInvitation,
  sendConversationMessage,
  setAppointmentStatus,
  toggleBotPaused,
  toggleService,
  updateBusinessHours,
  updateLocation,
  updateMemberLocations,
  updateOrganizationProfile,
  updatePatientConsent,
  type ActionResult,
} from '@/app/actions';
import {
  addWaitlistEntry,
  createReactivationCampaign,
  requestAppointmentDeposit,
  runAutomationsNow,
  setWaitlistStatus,
  updateAutomationRule,
  verifyAppointmentDeposit,
} from '@/app/commercial-actions';
import { getAuthenticatedUser } from '@/lib/auth';

const handlers = {
  anonymizePatient,
  createAppointment,
  createLocation,
  createOrganization,
  createProfessional,
  createService,
  disconnectGoogleCalendar,
  inviteMember,
  markConversationRead,
  resendInvitation,
  revokeInvitation,
  sendConversationMessage,
  setAppointmentStatus,
  toggleBotPaused,
  toggleService,
  updateBusinessHours,
  updateLocation,
  updateMemberLocations,
  updateOrganizationProfile,
  updatePatientConsent,
  addWaitlistEntry,
  createReactivationCampaign,
  requestAppointmentDeposit,
  runAutomationsNow,
  setWaitlistStatus,
  updateAutomationRule,
  verifyAppointmentDeposit,
} as const;

type ActionName = keyof typeof handlers;
type GenericAction = (...args: never[]) => Promise<ActionResult>;

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== requestUrl.origin)
    return NextResponse.json(
      { ok: false, message: 'Solicitud no válida.' },
      { status: 403 },
    );
  const user = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json(
      { ok: false, message: 'Tu sesión expiró. Inicia sesión otra vez.' },
      { status: 401 },
    );

  let body: { action?: ActionName; args?: unknown[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Los datos enviados no son válidos.' },
      { status: 400 },
    );
  }
  if (!body.action || !Array.isArray(body.args) || !(body.action in handlers))
    return NextResponse.json(
      { ok: false, message: 'Acción no reconocida.' },
      { status: 400 },
    );

  const handler = handlers[body.action] as unknown as GenericAction;
  const result = await handler(...(body.args as never[]));
  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'Cache-Control': 'no-store' },
  });
}
