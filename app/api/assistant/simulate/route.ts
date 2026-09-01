import { NextResponse } from 'next/server';

import { generateAssistantReply } from '@/lib/assistant';
import { requireClinicAccess } from '@/lib/saas';

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    message?: unknown;
    clinicId?: unknown;
  } | null;
  const message =
    typeof payload?.message === 'string' ? payload.message.trim() : '';
  const clinicId =
    typeof payload?.clinicId === 'string' ? payload.clinicId : '';
  if (!message || message.length > 1500) {
    return NextResponse.json(
      { error: 'Escribe un mensaje de hasta 1,500 caracteres.' },
      { status: 400 },
    );
  }
  try {
    await requireClinicAccess(clinicId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No autorizado.' },
      { status: 403 },
    );
  }
  const result = await generateAssistantReply(message, clinicId);
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
