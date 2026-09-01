import { DentalDashboard } from '@/components/dental-dashboard';
import { getDashboardData } from '@/lib/dental-data';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const data = await getDashboardData();
  return <DentalDashboard data={data} />;
}
