import { listRooms } from '@critiq/core/rooms';
import { createWebAppContext } from '@/lib/core/create-web-app-context';

export async function getRoomsPage(
  params: Record<string, string | string[] | undefined>,
) {
  const page = Number(params.page);
  const size = Number(params.size);
  const search =
    typeof params.search === 'string' ? params.search.slice(0, 200) : '';
  const data = await listRooms(await createWebAppContext('web-page'), {
    search,
    pagination: {
      page: Number.isInteger(page) && page > 0 && page <= 100000 ? page : 1,
      pageSize: size === 10 || size === 50 || size === 100 ? size : 25,
    },
  });
  return { ...data, search };
}
export type RoomsPageData = Awaited<ReturnType<typeof getRoomsPage>>;
