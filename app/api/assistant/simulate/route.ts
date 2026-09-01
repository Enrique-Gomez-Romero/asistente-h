import { NextResponse } from 'next/server';

import { generateAssistantReply } from '@/lib/assistant';

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as { message?: unknown } | null;
  const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
  if (!message || message.length > 1500) {
    return NextResponse.json({ error: 'Escribe un mensaje de hasta 1,500 caracteres.' }, { status: 400 });
  }
  const result = await generateAssistantReply(message);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
