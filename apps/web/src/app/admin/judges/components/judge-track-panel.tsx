'use client';

import type { JudgeTracks } from '@critiq/core/judges';
import type { JudgesPageData } from '../queries';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { InviteControls } from './invite-controls';
import { JudgeSearch } from './judge-search';
import { JudgeList } from './judge-list';
import { JudgeInvitations } from './judge-invitations';
import { JudgePagination } from './judge-pagination';

export function JudgeTrackPanel({
  track,
  data,
  emailEnabled,
  pending,
  onNavigate,
}: {
  track: JudgeTracks[number];
  data: JudgesPageData;
  emailEnabled: boolean;
  pending: boolean;
  onNavigate: (changes: Record<string, string>) => void;
}) {
  const { judges, invitations } = data;
  return (
    <>
      <InviteControls
        categoryId={track.id}
        trackName={track.name}
        emailEnabled={emailEnabled}
        disabled={data.locked || pending}
      />
      {judges && invitations && (
        <section
          className="flex min-w-0 flex-col gap-5"
          aria-label={`${track.name} judges`}
          aria-busy={pending}
        >
          <div className="grid items-end gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
            <Tabs
              className="min-w-0"
              value={data.view}
              onValueChange={(view) => onNavigate({ view, page: '1' })}
            >
              <TabsList aria-label="Judge records">
                <TabsTrigger value="judges" disabled={pending}>
                  Judges
                </TabsTrigger>
                <TabsTrigger value="invitations" disabled={pending}>
                  Pending invitations
                  <Badge>{invitations.pagination.totalItems}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <JudgeSearch
              key={`${track.id}:${data.search}`}
              initialSearch={data.search}
              disabled={pending}
              onSearch={(search) => onNavigate({ search, page: '1' })}
            />
          </div>
          {pending && (
            <p role="status" className="text-sm text-muted-foreground">
              Updating judges…
            </p>
          )}
          {data.view === 'judges' ? (
            <JudgeList
              judges={judges}
              tracks={data.tracks}
              categoryId={track.id}
              search={data.search}
              locked={data.locked}
              pending={pending}
              onReset={() => onNavigate({ search: '', page: '1' })}
            />
          ) : (
            <JudgeInvitations
              invitations={invitations}
              search={data.search}
              pending={pending}
              onReset={() => onNavigate({ page: '1', search: '' })}
            />
          )}
          <JudgePagination
            pagination={
              (data.view === 'judges' ? judges : invitations).pagination
            }
            disabled={pending}
            onNavigate={onNavigate}
          />
        </section>
      )}
    </>
  );
}
