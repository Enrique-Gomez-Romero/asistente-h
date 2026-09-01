import { redirect } from 'next/navigation';

import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { PlatformAdmin } from '@/components/platform-admin';
import { getPlatformAdminData } from '@/lib/saas';

export const dynamic = 'force-dynamic';

export default async function PlatformPage() {
  const user = await requireChatGPTUser('/platform');
  let data;
  try {
    data = await getPlatformAdminData(user);
  } catch {
    redirect('/app');
  }
  return <PlatformAdmin data={data} />;
}
