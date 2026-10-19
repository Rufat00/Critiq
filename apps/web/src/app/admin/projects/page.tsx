import { AdminHeading } from '@/components/admin-heading';
import { getProjectsPage } from './queries';
import { ProjectsSection } from './components/projects-section';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await getProjectsPage(await searchParams);
  return (
    <>
      <AdminHeading title="Projects" />
      <ProjectsSection data={data} />
    </>
  );
}
