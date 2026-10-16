import { authMode } from '@critiq/auth';
import { AdminHeading } from '@/components/admin-heading';
import { getJudgesPage } from './queries';
import { JudgesSection } from './components/judges-section';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await getJudgesPage(await searchParams);
  return (
    <>
      <AdminHeading title="Judges" />
      <JudgesSection data={data} emailEnabled={authMode === 'otp'} />
    </>
  );
}
