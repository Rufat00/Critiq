'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { JudgeWorkspace } from '@critiq/core/judging';
import { RiMapPinLine, RiPauseLine, RiPlayFill } from '@remixicon/react';
import { Button, LoadingButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  controlJudgingTimerAction,
  completeJudgingVisitAction,
} from '../actions';
import { SkipVisitDialog } from './skip-visit-dialog';
import { EvaluationStep } from './evaluation-step';

export function ProjectVisit({
  workspace,
  refresh,
  onSaved,
  roomChanged = false,
}: {
  workspace: JudgeWorkspace;
  refresh: () => Promise<void>;
  onSaved: () => void;
  roomChanged?: boolean;
}) {
  const visit = workspace.visit!;
  const [now, setNow] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [skip, setSkip] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const descriptionId = useId();
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const paused = workspace.event.status !== 'JUDGING';
  const assignments = [...visit.assignments].sort(
    (a, b) =>
      Number(a.category.kind === 'CHALLENGE') -
        Number(b.category.kind === 'CHALLENGE') ||
      a.category.name.localeCompare(b.category.name) ||
      a.id.localeCompare(b.id),
  );
  const assignment = assignments.find(
    (a) => !['COMPLETED', 'SKIPPED'].includes(a.status),
  );
  const phase = !visit.timerStartedAt
    ? 'details'
    : !visit.presentationFinishedAt
      ? 'presentation'
      : assignment
        ? 'evaluation'
        : 'complete';
  const stepKey = phase === 'evaluation' ? assignment!.id : phase;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [stepKey]);
  useEffect(() => {
    if (phase !== 'presentation') return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [phase]);
  const elapsed =
    visit.timerElapsedSeconds +
    (visit.timerRunningSince && now
      ? Math.max(
          0,
          Math.floor(
            (now - new Date(visit.timerRunningSince).getTime()) / 1000,
          ),
        )
      : 0);
  const remaining = workspace.event.judgingSeconds - elapsed;
  const overtime = remaining <= 0;
  const time = `${overtime ? '+' : ''}${String(Math.floor(Math.abs(remaining) / 60)).padStart(2, '0')}:${String(Math.abs(remaining) % 60).padStart(2, '0')}`;
  async function control(action: 'START' | 'PAUSE' | 'RESUME' | 'FINISH') {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      const result = await controlJudgingTimerAction({
        visitId: visit.id,
        action,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      await refresh();
    } catch {
      setError('Unable to update the timer. Please try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function complete() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      const result = await completeJudgingVisitAction({ visitId: visit.id });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      await refresh();
    } catch {
      setError(
        'Scores are saved, but the visit could not be completed. Please retry.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <section
      key={stepKey}
      className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-2 duration-200 motion-reduce:animate-none"
    >
      {phase === 'details' ? (
        <>
          <Card
            variant="soft"
            className={cn(
              'origin-center',
              roomChanged && 'motion-safe:animate-room-change',
            )}
          >
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <RiMapPinLine
                  className="mt-1 size-6 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="mb-1 text-sm">
                    {roomChanged ? 'Your new room' : 'Your room'}
                  </p>
                  <CardTitle>{visit.room.name}</CardTitle>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="mb-1 text-sm">Table</p>
                <p className="text-4xl font-bold leading-none tabular-nums">
                  {visit.project.tableNumber ?? '—'}
                </p>
              </div>
            </CardHeader>
            {visit.room.description && (
              <CardContent>
                <p className="line-clamp-2 text-sm">{visit.room.description}</p>
              </CardContent>
            )}
          </Card>
          <Card>
            <CardHeader>
              <h2
                ref={heading}
                tabIndex={-1}
                className="text-xl font-semibold outline-none"
              >
                {visit.project.name}
              </h2>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {visit.project.description && (
                <div className="flex flex-col items-start gap-1">
                  <p
                    id={descriptionId}
                    className={cn(
                      'whitespace-pre-line text-sm leading-relaxed text-muted-foreground',
                      !expanded && 'line-clamp-3',
                    )}
                  >
                    {visit.project.description}
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    aria-expanded={expanded}
                    aria-controls={descriptionId}
                    onClick={() => setExpanded((value) => !value)}
                  >
                    {expanded ? 'Show less' : 'Read more'}
                  </Button>
                </div>
              )}
              {visit.project.challenges.length > 0 && (
                <div
                  className="flex flex-wrap gap-2"
                  aria-label="Project challenges"
                >
                  {visit.project.challenges.map((challenge) => (
                    <Badge key={challenge.id} className="max-w-full">
                      <span className="truncate">{challenge.name}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              variant="secondary"
              disabled={pending || paused}
              onClick={() => setSkip(true)}
            >
              Skip
            </Button>
            <LoadingButton
              size="lg"
              loading={pending}
              disabled={paused}
              onClick={() => void control('START')}
            >
              <RiPlayFill data-icon="inline-start" />
              Start
            </LoadingButton>
          </div>
        </>
      ) : (
        <>
          <header className="flex flex-col items-center gap-2 text-center">
            <h1
              ref={heading}
              tabIndex={-1}
              className="text-2xl font-semibold outline-none"
            >
              {visit.project.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Table {visit.project.tableNumber ?? '—'} · {visit.room.name}
            </p>
          </header>
          {phase === 'presentation' ? (
            <>
              <div
                className={cn(
                  'flex flex-col items-center gap-4 rounded-3xl px-5 py-12 transition-colors duration-300 motion-reduce:transition-none',
                  overtime
                    ? 'bg-destructive-subtle text-destructive'
                    : remaining <= 60
                      ? 'bg-warning-subtle text-warning'
                      : 'bg-soft text-soft-foreground',
                )}
              >
                <p
                  role="timer"
                  aria-label={`${overtime ? 'Over time' : 'Remaining'} ${time}`}
                  className={cn(
                    'font-mono text-[clamp(4rem,18vw,6rem)] leading-none tabular-nums',
                    remaining <= 30 &&
                      !paused &&
                      visit.timerRunningSince &&
                      'motion-safe:animate-pulse',
                  )}
                >
                  {time}
                </p>
                <p className="text-center text-sm">
                  {paused || !visit.timerRunningSince
                    ? 'Timer paused'
                    : overtime
                      ? 'Time is up — finish when you’re ready.'
                      : remaining <= 60
                        ? 'One minute or less remaining'
                        : 'Presentation time'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <LoadingButton
                  size="lg"
                  variant="secondary"
                  loading={pending}
                  disabled={paused}
                  onClick={() =>
                    void control(visit.timerRunningSince ? 'PAUSE' : 'RESUME')
                  }
                >
                  {visit.timerRunningSince ? (
                    <RiPauseLine data-icon="inline-start" />
                  ) : (
                    <RiPlayFill data-icon="inline-start" />
                  )}
                  {visit.timerRunningSince ? 'Pause' : 'Resume'}
                </LoadingButton>
                <LoadingButton
                  size="lg"
                  loading={pending}
                  disabled={paused}
                  onClick={() => void control('FINISH')}
                >
                  Finish
                </LoadingButton>
              </div>
            </>
          ) : phase === 'evaluation' && assignment ? (
            <>
              <Badge className="w-fit">
                {assignment.category.kind === 'CHALLENGE'
                  ? `Challenge ${assignments.filter((a) => a.category.kind === 'CHALLENGE').findIndex((a) => a.id === assignment.id) + 1} of ${assignments.filter((a) => a.category.kind === 'CHALLENGE').length}`
                  : 'Track evaluation'}
              </Badge>
              <EvaluationStep
                key={assignment.id}
                assignment={assignment}
                workspace={workspace}
                disabled={paused || pending}
                onSubmitted={async () => {
                  onSaved();
                  if (
                    assignments.filter(
                      (a) => !['COMPLETED', 'SKIPPED'].includes(a.status),
                    ).length === 1
                  )
                    await complete();
                  else await refresh();
                }}
              />
            </>
          ) : (
            <>
              <Alert variant="success">
                <AlertDescription>All evaluations are saved.</AlertDescription>
              </Alert>
              <LoadingButton
                size="lg"
                loading={pending}
                disabled={paused}
                onClick={() => void complete()}
              >
                Complete project
              </LoadingButton>
            </>
          )}
        </>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <SkipVisitDialog
        open={skip}
        onOpenChange={setSkip}
        visitId={visit.id}
        projectId={visit.projectId}
        onSkipped={refresh}
      />
    </section>
  );
}
