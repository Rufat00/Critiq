import { getJudgingCategories } from '@critiq/core/categories';
import { createWebAppContext } from '@/lib/core/create-web-app-context';

export async function getCategories() {
  return getJudgingCategories(await createWebAppContext('web-page'), {});
}
