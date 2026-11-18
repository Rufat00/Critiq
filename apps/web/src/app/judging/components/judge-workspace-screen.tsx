'use client';
import { useEffect, useRef, useState } from 'react';
import type { JudgeWorkspace } from '@critiq/core/judging';
import { RiArrowRightLine, RiTimeLine } from '@remixicon/react';
import { Button, LoadingButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/empty-state';
import { UnsavedGuardProvider } from '@/components/ui/unsaved-guard';
import { toast } from '@/components/ui/sonner';
import {
  getJudgeCurrentAssignmentAction,
  requestNextAssignmentAction,
  renewJudgingVisitAction,
} from '../actions';
import { ProjectVisit } from './project-visit';

export function JudgeWorkspaceScreen({ initial }: { initial: JudgeWorkspace }) {
  const [data, setData] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [stale, setStale] = useState(false);
  const [noAssignment, setNoAssignment] = useState(false);
  const [roomChanged, setRoomChanged] = useState(false);
  const previousRoom = useRef(initial.visit?.room.id ?? null);
  useEffect(() => {
    if (!data.visit) return;
    const roomId = data.visit.room.id;
    setRoomChanged(
      previousRoom.current !== null && previousRoom.current !== roomId,
    );
    previousRoom.current = roomId;
  }, [data.visit?.id]);
  const busy = useRef(false);
  const polling = useRef<Promise<void> | null>(null);
  const requestKey = useRef<string | null>(null);
  const visitRef = useRef(data.visit);
  const statusRef = useRef(data.event.status);
  useEffect(() => {
    visitRef.current = data.visit;
    statusRef.current = data.event.status;
  }, [data]);
  async function refresh() {
    if (polling.current) await polling.current;
    const request = (async () => {
      try {
        const result = await getJudgeCurrentAssignmentAction({});
        if (!result.ok) {
          setStale(true);
          return;
        }
        setData(result.data);
        setStale(false);
      } catch {
        setStale(true);
      }
    })();
    polling.current = request;
    try {
      await request;
    } finally {
      if (polling.current === request) polling.current = null;
    }
  }
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    const renewal = setInterval(async () => {
      const visit = visitRef.current;
      if (!visit || statusRef.current !== 'JUDGING' || document.hidden) return;
      try {
        const result = await renewJudgingVisitAction({ visitId: visit.id });
        if (!result.ok) setStale(true);
      } catch {
        setStale(true);
      }
    }, 120000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(interval);
      clearInterval(renewal);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  async function next() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    setNoAssignment(false);
    requestKey.current ??= crypto.randomUUID();
    try {
      const result = await requestNextAssignmentAction({
        requestKey: requestKey.current,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      requestKey.current = null;
      if (result.data.status !== 'RESERVED') {
        setNoAssignment(true);
        await refresh();
        return;
      }
      await refresh();
    } catch {
      setError('Unable to load your next project. Please try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const waiting = ['DRAFT', 'READY'].includes(data.event.status);
  const closed = ['DELIBERATION', 'COMPLETED'].includes(data.event.status);
  return (
    <UnsavedGuardProvider>
      {(!data.visit || !data.visit.timerStartedAt) && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">
              {data.tracks.map((t) => t.name).join(' · ') || 'Judging'}
            </h1>
            <Badge>{data.judgedCount} judged</Badge>
          </div>
        </section>
      )}
      {stale && (
        <Alert variant="warning">
          <AlertDescription>
            Updates couldn’t load. Your edits are still here.
            <Button variant="link" onClick={() => void refresh()}>
              Retry updates
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {waiting ? (
        <EmptyState
          icon={<RiTimeLine />}
          title="Judging hasn’t started yet"
          description="This screen updates automatically when judging opens."
          action={
            <Button
              variant="secondary"
              size="lg"
              onClick={() => void refresh()}
            >
              Check now
            </Button>
          }
        />
      ) : closed ? (
        <EmptyState
          icon={<RiTimeLine />}
          title="Judging has finished"
          description="Thank you. Your submitted evaluations have been saved."
        />
      ) : (
        <>
          {data.event.status === 'PAUSED' && (
            <Alert variant="warning">
              <AlertDescription>
                Judging is paused by the organizers. Your saved scores and
                current edits are kept. Wait here for judging to resume.
              </AlertDescription>
            </Alert>
          )}
          {data.visit ? (
            <ProjectVisit
              key={data.visit.id}
              workspace={data}
              roomChanged={roomChanged}
              refresh={refresh}
              onSaved={() => {
                toast.success('Evaluation saved.');
              }}
            />
          ) : (
            <div className="flex flex-col gap-5 py-6">
              {noAssignment && (
                <Alert variant="soft">
                  <AlertDescription>
                    No project is available for you right now. Projects may be
                    busy or coverage may be complete. Try again shortly.
                  </AlertDescription>
                </Alert>
              )}
              <LoadingButton
                size="lg"
                className="w-full"
                loading={pending}
                disabled={data.event.status !== 'JUDGING'}
                onClick={() => void next()}
              >
                Judge next project
                <RiArrowRightLine data-icon="inline-end" />
              </LoadingButton>
            </div>
          )}
        </>
      )}
    </UnsavedGuardProvider>
  );
}
