'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  RiAddLine,
  RiFileUploadLine,
  RiDownloadCloud2Line,
  RiFolderLine,
  RiEditLine,
  RiArrowLeftRightLine,
  RiExternalLinkLine,
} from '@remixicon/react';
import type { ProjectsPageData } from '../queries';
import { ActionTile } from '@/components/action-tile';
import { EmptyState } from '@/components/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUnsavedGuardContext } from '@/components/ui/unsaved-guard';
import { ProjectFormDialog } from './project-form-dialog';
import { ProjectImportDialog } from './project-import-dialog';
import { ProjectDeleteDialog } from './project-delete-dialog';
import { SearchForm } from '@/components/search-form';
import { ProjectPagination } from './project-pagination';

export function ProjectsSection({ data }: { data: ProjectsPageData }) {
  const router = useRouter(),
    guard = useUnsavedGuardContext();
  const [pending, startTransition] = useTransition();
  const track = data.categories.tracks.find((t) => t.id === data.categoryId);
  const locked = data.locked || pending;
  function navigate(changes: Record<string, string>, replace = false) {
    startTransition(() => {
      const params = new URLSearchParams({
        track: data.categoryId ?? '',
        search: data.search,
        page: String(data.projects?.pagination.page ?? 1),

        ...changes,
      });
      const href = `/admin/projects?${params}`;
      if (replace) router.replace(href, { scroll: false });
      else router.push(href);
    });
  }
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {data.locked && (
        <Alert>
          <AlertDescription>
            Project setup is locked. Return the hackathon to draft before
            adding, importing, editing, moving, or deleting projects.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <ProjectFormDialog
          categories={data.categories}
          defaultTrackId={track?.trackId ?? ''}
          locked={locked}
        >
          <ActionTile icon={<RiAddLine />} disabled={locked || !track}>
            Add Project
          </ActionTile>
        </ProjectFormDialog>
        <ProjectImportDialog format="devpost" locked={locked}>
          <ActionTile
            icon={<RiDownloadCloud2Line />}
            disabled={locked || !track}
          >
            Import from Devpost
          </ActionTile>
        </ProjectImportDialog>
        <ProjectImportDialog format="csv" locked={locked}>
          <ActionTile icon={<RiFileUploadLine />} disabled={locked || !track}>
            Import CSV
          </ActionTile>
        </ProjectImportDialog>
      </div>
      {!track ? (
        <EmptyState
          icon={<RiFolderLine />}
          title="No tracks available"
          description="Set up your judging categories before adding projects."
        />
      ) : (
        <Tabs
          value={data.categoryId}
          onValueChange={(value) => {
            void (async () => {
              if (guard && !(await guard.confirmNavigation())) return;
              navigate({ track: value, page: '1', search: '' });
            })();
          }}
          className="gap-6"
        >
          <div className="overflow-x-auto">
            <TabsList aria-label="Project tracks">
              {data.categories.tracks.map((item) => (
                <TabsTrigger key={item.id} value={item.id} disabled={pending}>
                  {item.name}
                  <Badge>{item.projectCount}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent
            value={track.id}
            className="flex min-w-0 flex-col gap-5"
            aria-busy={pending}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold">{track.name} projects</h2>
              <SearchForm
                id="project-search"
                label="Search projects"
                placeholder="Search title or description"
                className="sm:max-w-sm"
                key={track.id}
                initialSearch={data.search}
                pending={pending}
                onSearch={(search) => navigate({ search, page: '1' }, true)}
              />
            </div>
            {data.projects?.items.length ? (
              <ul className="flex flex-col gap-3">
                {data.projects.items.map((project) => (
                  <li
                    key={project.id}
                    className="flex min-w-0 flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-5"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <h3 className="break-words font-semibold">
                        {project.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {project.room && project.tableNumber !== null
                          ? `${project.room.name} · Table ${project.tableNumber}`
                          : 'Awaiting an available table range'}
                      </p>
                      {project.description && (
                        <p className="line-clamp-2 break-words text-sm text-muted-foreground">
                          {project.description}
                        </p>
                      )}
                      {project.challenges.length > 0 && (
                        <div
                          className="flex flex-wrap gap-2"
                          aria-label="Opt-in challenges"
                        >
                          {project.challenges.map((c) => (
                            <Badge key={c.challengeId}>
                              {c.challenge.category.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {(
                          [
                            ['Submission', project.submissionUrl],
                            ['GitHub', project.repositoryUrl],
                            ['Video demo', project.demoUrl],
                          ] as const
                        ).map(([label, url]) =>
                          url && /^https?:\/\//i.test(url) ? (
                            <a
                              key={label}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4"
                            >
                              {label}
                              <RiExternalLinkLine
                                className="size-4"
                                aria-hidden="true"
                              />
                            </a>
                          ) : null,
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
                      <ProjectFormDialog
                        key={`edit-${project.id}`}
                        categories={data.categories}
                        project={project}
                        defaultTrackId={project.trackId}
                        locked={locked}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={locked}
                          aria-label={`Edit ${project.name}`}
                        >
                          <RiEditLine />
                        </Button>
                      </ProjectFormDialog>
                      <ProjectFormDialog
                        key={`move-${project.id}`}
                        categories={data.categories}
                        project={project}
                        mode="move"
                        defaultTrackId={project.trackId}
                        locked={locked}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={locked || data.categories.tracks.length < 2}
                          aria-label={`Move ${project.name} to another track`}
                        >
                          <RiArrowLeftRightLine />
                        </Button>
                      </ProjectFormDialog>
                      <ProjectDeleteDialog
                        projectId={project.id}
                        name={project.name}
                        locked={locked}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<RiFolderLine />}
                title={
                  data.search
                    ? 'No matching projects'
                    : `No projects in ${track.name} yet`
                }
                description={
                  data.search
                    ? 'Try a different project title or description.'
                    : 'Add a project or import submitted projects using the tiles above.'
                }
                action={
                  data.search ? (
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => navigate({ search: '', page: '1' })}
                    >
                      Clear search
                    </Button>
                  ) : undefined
                }
              />
            )}
            {data.projects && (
              <ProjectPagination
                pagination={data.projects.pagination}
                disabled={pending}
                onNavigate={navigate}
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
