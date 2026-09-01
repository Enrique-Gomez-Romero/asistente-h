import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { DentalDashboard } from '@/components/dental-dashboard';
import { OrganizationOnboarding } from '@/components/organization-onboarding';
import { getDashboardData } from '@/lib/dental-data';
import { getSaasContext } from '@/lib/saas';

export const dynamic = 'force-dynamic';

export default async function CustomerApp({
  searchParams,
}: {
  searchParams: Promise<{ organization?: string }>;
}) {
  const user = await requireChatGPTUser('/app');
  const params = await searchParams;
  const saas = await getSaasContext(user, params.organization);
  if (!saas.activeOrganization)
    return <OrganizationOnboarding displayName={user.displayName} />;
  const data = await getDashboardData(saas.activeOrganization.id, saas);
  return <DentalDashboard data={data} />;
}
