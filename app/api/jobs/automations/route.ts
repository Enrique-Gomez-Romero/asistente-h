import { NextResponse } from 'next/server';

import { processDueAutomations } from '@/lib/automations';
import { logOperationalEvent } from '@/lib/observability';
import {
  expirePastDueSubscriptions,
  sendUpcomingSubscriptionNotices,
} from '@/lib/subscriptions';

export async function POST(request: Request) {
  const secret = process.env.AUTOMATION_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [expiredSubscriptions, subscriptionNotices, result] = await Promise.all([
      expirePastDueSubscriptions(),
      sendUpcomingSubscriptionNotices(),
      processDueAutomations(100),
    ]);
    logOperationalEvent('info', 'automations.completed', {
      expiredSubscriptions,
      subscriptionNotices,
      ...result,
    });
    return NextResponse.json({ ok: true, expiredSubscriptions, subscriptionNotices, ...result });
  } catch (error) {
    logOperationalEvent('error', 'automations.failed', { error });
    return NextResponse.json(
      { ok: false, error: 'No fue posible procesar las automatizaciones.' },
      { status: 500 },
    );
  }
}
