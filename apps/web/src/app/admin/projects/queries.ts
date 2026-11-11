import { getJudgingCategories } from '@critiq/core/categories';
import { listProjects } from '@critiq/core/projects';
import { createWebAppContext } from '@/lib/core/create-web-app-context';
export async function getProjectsPage(
  params: Record<string, string | string[] | undefined>,
) {
  const ctx = await createWebAppContext('web-page');
  const categories = await getJudgingCategories(ctx, {});
  const track =
    categories.tracks.find((t) => t.id === params.track) ??
    categories.tracks[0];
  const pageNumber = Number(params.page);
  const page =
    Number.isInteger(pageNumber) && pageNumber > 0 && pageNumber <= 100000
      ? pageNumber
      : 1;
  const search =
    typeof params.search === 'string' ? params.search.slice(0, 200) : '';
  const projects = track
    ? await listProjects(ctx, {
        filters: { trackId: track.trackId },
        pagination: { page },
        search,
      })
    : null;
  return {
    categories,
    categoryId: track?.id,
    projects,
    search,
    locked: categories.status !== 'DRAFT',
  };
}
export type ProjectsPageData = Awaited<ReturnType<typeof getProjectsPage>>;
