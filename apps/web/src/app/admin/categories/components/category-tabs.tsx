'use client';

import {
  RiRouteLine,
  RiTrophyLine,
  RiLayoutGridLine,
  RiCheckLine,
  RiSubtractLine,
  RiLockLine,
} from '@remixicon/react';
import type { JudgingCategories } from '@critiq/core/categories';
import { judgingMethodLabels } from '@critiq/constants';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CategoryActions } from './category-actions';
import { CategoryFormDialog } from './category-form-dialog';

export function CategoryTabs({
  categories,
}: {
  categories: JudgingCategories;
}) {
  const { tracks, challenges, status } = categories;
  return (
    <div className="flex flex-col gap-5">
      {status !== 'DRAFT' && (
        <Alert>
          <AlertDescription>
            Configuration is locked. Categories can only be changed while the
            hackathon is in draft.
          </AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="tracks" className="gap-6">
        <TabsList aria-label="Category views">
          <TabsTrigger value="tracks">
            <RiRouteLine />
            Tracks<Badge>{tracks.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="challenges">
            <RiTrophyLine />
            Challenges<Badge>{challenges.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="matrix">
            <RiLayoutGridLine />
            Matrix
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tracks">
          <section className="flex flex-col gap-5">
            <header className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold leading-snug tracking-tight">
                  Tracks
                </h2>
                <CategoryFormDialog
                  categories={categories}
                  kind="track"
                  locked={status !== 'DRAFT'}
                  onSaved={toast.success}
                />
              </div>
            </header>
            <div className="flex flex-col gap-3">
              <div
                aria-hidden="true"
                className="hidden grid-cols-[minmax(0,1fr)_100px_150px_70px_44px] items-center gap-4 px-4 pb-1 text-xs text-muted-foreground xl:grid"
              >
                <span>Track</span>
                <span>Method</span>
                <span>Challenges</span>
                <span>Projects</span>
                <span />
              </div>
              {tracks.map((track) => {
                const linked = challenges.filter((c) =>
                  c.trackIds.includes(track.id),
                );
                return (
                  <article
                    key={track.id}
                    aria-label={track.name}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_44px] items-center gap-4 rounded-xl border border-border p-4 xl:grid-cols-[minmax(0,1fr)_100px_150px_70px_44px]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-sm font-semibold">
                          {track.name}
                        </h3>
                        {track.isOverall && (
                          <Badge>
                            <RiLockLine className="size-3" />
                            Default
                          </Badge>
                        )}
                      </div>
                      {track.description && (
                        <p className="mt-1 break-words text-sm text-muted-foreground">
                          {track.description}
                        </p>
                      )}
                    </div>
                    <div className="col-start-1 row-start-2 xl:col-auto xl:row-auto">
                      <span className="sr-only">Judging method: </span>
                      <Badge>{judgingMethodLabels[track.method]}</Badge>
                    </div>
                    <div className="col-start-1 flex flex-wrap gap-1.5 xl:col-auto">
                      {linked.map((challenge) => (
                        <Badge
                          key={challenge.id}
                          className="max-w-full whitespace-normal break-words"
                        >
                          {challenge.name}
                        </Badge>
                      ))}
                    </div>
                    <p className="col-start-1 text-sm tabular-nums xl:col-auto">
                      {track.projectCount}
                      <span className="text-muted-foreground xl:sr-only">
                        {' '}
                        projects
                      </span>
                    </p>
                    <div className="col-start-2 row-start-1 xl:col-auto xl:row-auto">
                      <CategoryActions
                        categories={categories}
                        id={track.id}
                        name={track.name}
                        isOverall={track.isOverall}
                        membershipKind="challenges"
                        membershipOptions={challenges.map((challenge) => ({
                          id: challenge.id,
                          name: challenge.name,
                          included: challenge.trackIds.includes(track.id),
                        }))}
                        locked={status !== 'DRAFT'}
                        onDeleted={(name) =>
                          toast.success(`${name} was deleted.`, {
                            description: 'Projects were kept.',
                          })
                        }
                      />
                    </div>
                  </article>
                );
              })}
              {!tracks.length && (
                <EmptyState
                  icon={<RiRouteLine />}
                  title="No tracks yet"
                  description="Tracks will appear here once they are configured. Run the setup seed to create Overall."
                />
              )}
            </div>
          </section>
        </TabsContent>
        <TabsContent value="challenges">
          <section className="flex flex-col gap-5">
            <header className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold leading-snug tracking-tight">
                  Challenges
                </h2>
                <CategoryFormDialog
                  categories={categories}
                  kind="challenge"
                  locked={status !== 'DRAFT'}
                  onSaved={toast.success}
                />
              </div>
            </header>
            <div className="flex flex-col gap-3">
              <div
                aria-hidden="true"
                className="hidden grid-cols-[minmax(0,1fr)_100px_150px_70px_44px] items-center gap-4 px-4 pb-1 text-xs text-muted-foreground xl:grid"
              >
                <span>Challenge</span>
                <span>Method</span>
                <span>Tracks</span>
                <span>Projects</span>
                <span />
              </div>
              {challenges.map((challenge) => (
                <article
                  key={challenge.id}
                  aria-label={challenge.name}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_44px] items-center gap-4 rounded-xl border border-border p-4 xl:grid-cols-[minmax(0,1fr)_100px_150px_70px_44px]"
                >
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold">
                      {challenge.name}
                    </h3>
                    {challenge.description && (
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {challenge.description}
                      </p>
                    )}
                  </div>
                  <div className="col-start-1 row-start-2 xl:col-auto xl:row-auto">
                    <span className="sr-only">Judging method: </span>
                    <Badge>{judgingMethodLabels[challenge.method]}</Badge>
                  </div>
                  <div className="col-start-1 flex flex-wrap gap-1.5 xl:col-auto">
                    {tracks
                      .filter((t) => challenge.trackIds.includes(t.id))
                      .map((t) => (
                        <Badge
                          key={t.id}
                          className="max-w-full whitespace-normal break-words"
                        >
                          {t.name}
                        </Badge>
                      ))}
                  </div>
                  <p className="col-start-1 text-sm tabular-nums xl:col-auto">
                    {challenge.projectCount}
                    <span className="text-muted-foreground xl:sr-only">
                      {' '}
                      projects
                    </span>
                  </p>
                  <div className="col-start-2 row-start-1 xl:col-auto xl:row-auto">
                    <CategoryActions
                      categories={categories}
                      id={challenge.id}
                      name={challenge.name}
                      membershipKind="tracks"
                      membershipOptions={tracks.map((track) => ({
                        id: track.id,
                        name: track.name,
                        included: challenge.trackIds.includes(track.id),
                      }))}
                      locked={status !== 'DRAFT'}
                      onDeleted={(name) =>
                        toast.success(`${name} was deleted.`, {
                          description: 'Projects were kept.',
                        })
                      }
                    />
                  </div>
                </article>
              ))}
              {!challenges.length && (
                <EmptyState
                  icon={<RiTrophyLine />}
                  title="No challenges yet"
                  description="Challenges give projects more ways to stand out. Each challenge will appear here with its tracks and judging method."
                />
              )}
            </div>
          </section>
        </TabsContent>
        <TabsContent value="matrix">
          <section className="flex flex-col gap-5">
            <header className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold leading-snug tracking-tight">
                  Challenge matrix
                </h2>
                <CategoryFormDialog
                  categories={categories}
                  kind="challenge"
                  locked={status !== 'DRAFT'}
                  onSaved={toast.success}
                />
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Membership included />
                  Included
                </span>
                <span className="flex items-center gap-1.5">
                  <Membership included={false} />
                  Not included
                </span>
              </div>
            </header>
            <div>
              {challenges.length ? (
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Challenge membership matrix; scroll horizontally to see all tracks"
                  className="max-w-full overflow-x-auto rounded-xl border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col" className="min-w-48">
                          Challenges
                        </TableHead>
                        {tracks.map((track) => (
                          <TableHead
                            key={track.id}
                            scope="col"
                            className={cn(
                              'min-w-32 text-center whitespace-normal',
                              track.isOverall && 'bg-muted/50',
                            )}
                          >
                            <div className="flex flex-col items-center gap-2 py-3">
                              <RiRouteLine className="size-5" />
                              {track.name}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {challenges.map((challenge) => (
                        <TableRow key={challenge.id}>
                          <TableHead scope="row" className="whitespace-normal">
                            <p className="text-sm font-medium">
                              {challenge.name}
                            </p>
                            {challenge.description && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {challenge.description}
                              </p>
                            )}
                          </TableHead>
                          {tracks.map((track) => (
                            <TableCell
                              key={track.id}
                              className={cn(
                                'text-center',
                                track.isOverall && 'bg-muted/50',
                              )}
                            >
                              <Membership
                                included={challenge.trackIds.includes(track.id)}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={<RiLayoutGridLine />}
                  title="No challenge memberships yet"
                  description="The matrix will show challenge membership across all tracks once challenges are configured."
                />
              )}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Membership({ included }: { included: boolean }) {
  return (
    <span
      aria-label={included ? 'Included' : 'Not included'}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-md',
        included
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {included ? (
        <RiCheckLine className="size-4" aria-hidden="true" />
      ) : (
        <RiSubtractLine className="size-4" aria-hidden="true" />
      )}
    </span>
  );
}
