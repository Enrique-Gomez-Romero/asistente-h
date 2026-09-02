import { env } from 'cloudflare:workers';

import { ensureDatabase } from '@/db/initialize';

export async function expirePastDueSubscriptions(): Promise<number> {
  await ensureDatabase();
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE status IN ('trialing', 'active') AND current_period_end < ?`,
  )
    .bind(now, now)
    .run();
  return Number(result.meta.changes ?? 0);
}
