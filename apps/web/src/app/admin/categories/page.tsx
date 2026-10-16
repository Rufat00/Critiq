import { CategoryPageLayout } from './components/category-page-layout';
import { CategoryTabs } from './components/category-tabs';
import { getCategories } from './queries';

export default async function Page() {
  const categories = await getCategories();
  return (
    <CategoryPageLayout>
      <CategoryTabs categories={categories} />
    </CategoryPageLayout>
  );
}
