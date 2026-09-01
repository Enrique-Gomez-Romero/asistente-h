import { NextResponse } from 'next/server';

import { processDueAutomations } from '@/lib/automations';

export async function POST(request: Request) {
  const secret = process.env.AUTOMATION_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await processDueAutomations(100);
  return NextResponse.json({ ok: true, ...result });
}
