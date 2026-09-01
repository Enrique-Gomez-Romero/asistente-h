import { NextResponse } from 'next/server';

import { ensureDatabase } from '@/db/initialize';

export async function GET() {
  await ensureDatabase();
  return NextResponse.json({
    status: 'ok',
    service: 'asistente-h',
    timestamp: new Date().toISOString(),
  });
}
