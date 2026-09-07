import { NextResponse } from 'next/server';

import {
  authenticateWithPassword,
  issueSession,
  safeRelativePath,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/auth';

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== requestUrl.origin)
    return new Response('Solicitud no válida.', { status: 403 });

  const form = await request.formData();
  const email = formText(form, 'email');
  const password = formText(form, 'password');
  const next = safeRelativePath(formText(form, 'next') || '/app');
  const result = await authenticateWithPassword(email, password);

  if (!result.ok) {
    const loginUrl = new URL('/login', requestUrl.origin);
    loginUrl.searchParams.set('next', next);
    loginUrl.searchParams.set('error', 'invalid_credentials');
    return NextResponse.redirect(loginUrl, 303);
  }

  const session = await issueSession(result.user.userId);
  const response = NextResponse.redirect(new URL(next, requestUrl.origin), 303);
  response.cookies.set(
    SESSION_COOKIE,
    session.token,
    sessionCookieOptions(session.expiresAt),
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}
