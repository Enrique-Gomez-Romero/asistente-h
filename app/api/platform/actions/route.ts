import { NextResponse } from 'next/server';

import {
  adminRecordManualPayment,
  adminSetOrganizationStatus,
  adminUpdateOrganizationProfile,
  adminUpdateManualPaymentStatus,
  adminUpdateSubscription,
  type CommercialActionResult,
} from '@/app/commercial-actions';
import { getAuthenticatedUser } from '@/lib/auth';

type PlatformAction =
  | 'update-subscription'
  | 'set-organization-status'
  | 'update-organization-profile'
  | 'record-payment'
  | 'update-payment-status';

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

  let body: { action?: PlatformAction; input?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Los datos enviados no son válidos.' },
      { status: 400 },
    );
  }

  const input = body.input as never;
  let result: CommercialActionResult;
  switch (body.action) {
    case 'update-subscription':
      result = await adminUpdateSubscription(input);
      break;
    case 'set-organization-status':
      result = await adminSetOrganizationStatus(input);
      break;
    case 'update-organization-profile':
      result = await adminUpdateOrganizationProfile(input);
      break;
    case 'record-payment':
      result = await adminRecordManualPayment(input);
      break;
    case 'update-payment-status':
      result = await adminUpdateManualPaymentStatus(input);
      break;
    default:
      return NextResponse.json(
        { ok: false, message: 'Acción administrativa no reconocida.' },
        { status: 400 },
      );
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'Cache-Control': 'no-store' },
  });
}
