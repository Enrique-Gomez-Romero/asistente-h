import { NextResponse } from 'next/server';

import { ensureDatabase } from '@/db/initialize';
import { logOperationalEvent } from '@/lib/observability';

export async function GET() {
  const startedAt = Date.now();
  try {
    await ensureDatabase();
    return NextResponse.json(
      {
        status: 'ok',
        service: 'asistente-h',
        database: 'ok',
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logOperationalEvent('error', 'health.database_failed', { error });
    return NextResponse.json(
      {
        status: 'degraded',
        service: 'asistente-h',
        database: 'error',
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
