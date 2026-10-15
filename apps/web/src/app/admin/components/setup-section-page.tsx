import Link from 'next/link';
import { RiArrowLeftLine, RiSettings3Line } from '@remixicon/react';
import type { SetupSection } from '@critiq/core/hackathon';
import { getAdminHome } from '@/app/admin/queries';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { SummaryPanel } from '@/components/summary-panel';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export async function SetupSectionPage({
  sectionId,
}: {
  sectionId: SetupSection;
}) {
  const summary = await getAdminHome();
  const section = summary.sections.find((item) => item.id === sectionId)!;
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          {sectionId === 'event' ? 'Settings' : section.title}
        </h1>
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin">
            <RiArrowLeftLine data-icon="inline-start" />
            Back to home
          </Link>
        </Button>
      </header>
      {sectionId === 'event' ? (
        <Card>
          <CardHeader>
            <CardTitle>Event details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="break-words">{summary.name ?? 'Not set'}</dd>
              <dt className="text-muted-foreground">Score scale</dt>
              <dd>{summary.scoreScale} points</dd>
            </dl>
          </CardContent>
        </Card>
      ) : (
        <SummaryPanel
          title={section.title}
          metric={section.count}
          subtitle={
            sectionId === 'categories'
              ? 'Tracks and challenges · Overall is included by default'
              : 'Currently configured'
          }
        />
      )}
      {sectionId === 'categories' && summary.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Configured categories</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {summary.categories.map((category) => (
                <li
                  key={category.id}
                  className="flex flex-wrap justify-between gap-2 text-sm"
                >
                  <span>
                    {category.name}
                    {category.kind === 'OVERALL' ? ' (default)' : ''}
                  </span>
                  <span className="text-muted-foreground">
                    {category.method === 'RUBRIC'
                      ? 'Rubric'
                      : 'Relative judging'}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <EmptyState
        icon={<RiSettings3Line />}
        title="Setup editor coming soon"
        description="This page shows your saved setup. Creating, importing, and editing entries will be available in the next update."
      />
    </>
  );
}
