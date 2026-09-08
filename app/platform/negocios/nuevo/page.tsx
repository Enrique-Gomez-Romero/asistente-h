import { redirect } from 'next/navigation';

import { NewBusinessForm } from '@/components/new-business-form';
import { requireAuthenticatedUser } from '@/lib/auth';
import { getPlatformAdminData } from '@/lib/saas';

export const dynamic = 'force-dynamic';

export default async function NewBusinessPage() {
  const user = await requireAuthenticatedUser('/platform/negocios/nuevo');
  let data;
  try {
    data = await getPlatformAdminData(user);
  } catch {
    redirect('/app');
  }
  return <NewBusinessForm plans={data.plans} />;
}
