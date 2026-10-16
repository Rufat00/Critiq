import {
  listJudgeTracks,
  listJudges,
  listJudgeInvitations,
} from '@critiq/core/judges';
import { createWebAppContext } from '@/lib/core/create-web-app-context';
import { getJudgingCategories } from '@critiq/core/categories';

export async function getJudgesPage(
  params: Record<string, string | string[] | undefined>,
) {
  const ctx = await createWebAppContext('web-page');
  const [tracks, categories] = await Promise.all([
    listJudgeTracks(ctx, {}),
    getJudgingCategories(ctx, {}),
  ]);
  const categoryId =
    tracks.find((track) => track.id === params.track)?.id ?? tracks[0]?.id;
  const pageValue = Number(params.page);
  const page =
    Number.isInteger(pageValue) && pageValue > 0 && pageValue <= 100000
      ? pageValue
      : 1;
  const size = Number(params.size);
  const pageSize: 10 | 25 | 50 | 100 =
    size === 10 || size === 50 || size === 100 ? size : 25;
  const search =
    typeof params.search === 'string' ? params.search.slice(0, 200) : '';
  const view = params.view === 'invitations' ? 'invitations' : 'judges';
  if (!categoryId)
    return {
      tracks,
      locked: categories.status !== 'DRAFT',
      categoryId,
      search,
      view,
      judges: null,
      invitations: null,
    } as const;
  const input = {
    filters: { categoryId },
    search,
    pagination: { page, pageSize },
  };
  const [judges, invitations] = await Promise.all([
    listJudges(ctx, {
      ...input,
      pagination: { ...input.pagination, page: view === 'judges' ? page : 1 },
    }),
    listJudgeInvitations(ctx, {
      ...input,
      pagination: {
        ...input.pagination,
        page: view === 'invitations' ? page : 1,
      },
    }),
  ]);
  return {
    tracks,
    locked: categories.status !== 'DRAFT',
    categoryId,
    search,
    view,
    judges,
    invitations,
  } as const;
}
export type JudgesPageData = Awaited<ReturnType<typeof getJudgesPage>>;
