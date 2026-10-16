'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RiUserLine } from '@remixicon/react';
import type { JudgesPageData } from '../queries';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/empty-state';
import { useUnsavedGuardContext } from '@/components/ui/unsaved-guard';
import { JudgeTrackPanel } from './judge-track-panel';

export function JudgesSection({
  data,
  emailEnabled,
}: {
  data: JudgesPageData;
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const guard = useUnsavedGuardContext();
  function navigate(changes: Record<string, string>) {
    startTransition(async () => {
      const params = new URLSearchParams({
        track: data.categoryId ?? '',
        search: data.search,
        view: data.view,
        page: String(
          (data.view === 'judges' ? data.judges : data.invitations)?.pagination
            .page ?? 1,
        ),
        size: String(data.judges?.pagination.pageSize ?? 25),
        ...changes,
      });
      router.push(`/admin/judges?${params}`);
    });
  }
  // Each track's invite form remains mounted while searching/paging its table.
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {data.locked && (
        <Alert>
          <AlertDescription>
            Judge setup is locked. Return the hackathon to draft before
            inviting, moving, or removing judges.
          </AlertDescription>
        </Alert>
      )}
      {data.tracks.length === 0 ? (
        <EmptyState
          icon={<RiUserLine />}
          title="No tracks yet"
          description="Create a track in Judging Categories before inviting judges."
        />
      ) : (
        <Tabs
          value={data.categoryId}
          onValueChange={(track) => {
            void (async () => {
              if (guard && !(await guard.confirmNavigation())) return;
              navigate({ track, page: '1', search: '' });
            })();
          }}
          className="gap-6"
        >
          <div className="overflow-x-auto">
            <TabsList aria-label="Judge tracks">
              {data.tracks.map((track) => (
                <TabsTrigger key={track.id} value={track.id} disabled={pending}>
                  {track.name}
                  <Badge>{track.judgeCount}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {data.tracks.map((track) => (
            <TabsContent
              key={track.id}
              value={track.id}
              className="flex min-w-0 flex-col gap-6"
            >
              <JudgeTrackPanel
                track={track}
                data={data}
                emailEnabled={emailEnabled}
                pending={pending}
                onNavigate={navigate}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
