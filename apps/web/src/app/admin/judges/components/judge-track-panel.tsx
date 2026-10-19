'use client';

import type { JudgeTracks } from '@critiq/core/judges';
import type { JudgesPageData } from '../queries';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { InviteControls } from './invite-controls';
import { SearchForm } from '@/components/search-form';
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
  onNavigate: (changes: Record<string, string>, replace?: boolean) => void;
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              className="min-w-0 lg:shrink-0"
              value={data.view}
              onValueChange={(view) => onNavigate({ view, page: '1' })}
            >
              <TabsList variant="default" aria-label="Judge records">
                <TabsTrigger value="judges" disabled={pending}>
                  Judges
                </TabsTrigger>
                <TabsTrigger value="invitations" disabled={pending}>
                  Pending invitations
                  <Badge>{invitations.pagination.totalItems}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <SearchForm
              id="judge-search"
              label="Search judges and invitations"
              placeholder="Search name or email"
              className="lg:w-80 lg:shrink-0"
              key={track.id}
              initialSearch={data.search}
              pending={pending}
              onSearch={(search) => onNavigate({ search, page: '1' }, true)}
            />
          </div>
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
