'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import type { AdminJudgingDashboard } from '@critiq/core/judging';
import {
  RiPauseLine,
  RiPlayFill,
  RiStopLine,
  RiFolderLine,
} from '@remixicon/react';
import { Button, LoadingButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogBody,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldError,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/ui/sonner';
import {
  getAdminJudgingDashboardAction,
  transitionJudgingAction,
} from '../../judging/actions';

export function LiveJudgingDashboard({
  initial,
}: {
  initial: AdminJudgingDashboard;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [now, setNow] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState(false);
  const [dialog, setDialog] = useState<'pause' | 'finish' | 'resume' | null>(
    null,
  );
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const polling = useRef<Promise<void> | null>(null);
  const form = useForm({
    defaultValues: { eventName: '' },
    onSubmit: async ({ value }) => {
      if (!dialog) return;
      if (dialog === 'finish' && value.eventName !== data.name) {
        setFieldError('Enter the exact hackathon name.');
        return;
      }
      setError(undefined);
      try {
        const result = await transitionJudgingAction({
          status:
            dialog === 'finish'
              ? 'DELIBERATION'
              : dialog === 'pause'
                ? 'PAUSED'
                : 'JUDGING',
          reason:
            dialog === 'finish'
              ? 'Organizer finished judging.'
              : dialog === 'pause'
                ? 'Organizer paused judging.'
                : 'Organizer resumed judging.',
          eventName: value.eventName,
        });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setDialog(null);
        toast.success(
          dialog === 'finish'
            ? 'Judging finished.'
            : dialog === 'pause'
              ? 'Judging paused.'
              : 'Judging resumed.',
        );
        router.refresh();
        if (dialog !== 'finish') await refresh();
      } catch {
        setError('Unable to change judging. Please try again.');
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);
  useEffect(() => setData(initial), [initial]);
  async function refresh() {
    if (polling.current) await polling.current;
    const request = (async () => {
      try {
        const result = await getAdminJudgingDashboardAction();
        if (!result.ok) {
          setRefreshError(true);
          return;
        }
        setData(result.data);
        setRefreshError(false);
        if (result.data.status === 'DELIBERATION') router.refresh();
      } catch {
        setRefreshError(true);
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
    const tick = () => setNow(Date.now());
    tick();
    const clock = setInterval(tick, 1000);
    const poll = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(clock);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  const seconds =
    data.startedAt && now
      ? Math.max(0, Math.floor((now - Date.parse(data.startedAt)) / 1000))
      : 0;
  const time = [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
  return (
    <>
      <section className="flex flex-col items-center gap-5 py-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
        <Badge variant={data.status === 'PAUSED' ? 'warning' : 'info'}>
          {data.status === 'PAUSED' ? 'Judging paused' : 'Judging in progress'}
        </Badge>
        <h1 className="text-xl font-semibold">{data.name}</h1>
        <p
          role="timer"
          aria-label={`Time since judging started: ${time}`}
          className="font-mono text-[clamp(3rem,12vw,6rem)] leading-none tabular-nums"
        >
          {time}
        </p>
        <p className="text-sm text-muted-foreground">Since judging started</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              setError(undefined);
              setDialog(data.status === 'PAUSED' ? 'resume' : 'pause');
            }}
          >
            {data.status === 'PAUSED' ? (
              <RiPlayFill data-icon="inline-start" />
            ) : (
              <RiPauseLine data-icon="inline-start" />
            )}
            {data.status === 'PAUSED' ? 'Resume judging' : 'Pause judging'}
          </Button>
          <Button
            size="lg"
            variant="destructive"
            onClick={() => {
              form.reset();
              setError(undefined);
              setFieldError(undefined);
              setDialog('finish');
            }}
          >
            <RiStopLine data-icon="inline-start" />
            Finish judging
          </Button>
        </div>
      </section>
      {refreshError && (
        <Alert variant="warning">
          <AlertDescription>
            Live updates couldn’t load. Showing the last received counts.
            <Button variant="link" onClick={() => void refresh()}>
              Retry now
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {data.tracks.length ? (
        <Tabs defaultValue={data.tracks[0]!.id}>
          <div className="overflow-x-auto">
            <TabsList aria-label="Judging tracks">
              {data.tracks.map((track) => (
                <TabsTrigger key={track.id} value={track.id}>
                  {track.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {data.tracks.map((track) => (
            <TabsContent
              key={track.id}
              value={track.id}
              className="flex flex-col gap-5 animate-in fade-in duration-200 motion-reduce:animate-none"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <p>
                  Minimum {track.minimum} · Calculated target {track.target} ·
                  Maximum {track.maximum}
                </p>
                <p>Updates every 30 seconds</p>
              </div>
              <div
                className="flex flex-wrap gap-2"
                aria-label="Coverage legend"
              >
                <Badge variant="destructive">Below minimum</Badge>
                <Badge variant="warning">Building coverage</Badge>
                <Badge variant="info">Target reached</Badge>
                <Badge variant="success">Near maximum</Badge>
              </div>
              {track.projects.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {track.projects.map((project) => {
                    const variant = {
                      BELOW_MINIMUM: 'destructive',
                      BELOW_TARGET: 'warning',
                      TARGET_REACHED: 'info',
                      NEAR_MAXIMUM: 'success',
                    }[project.coverageStatus] as
                      | 'destructive'
                      | 'warning'
                      | 'info'
                      | 'success';
                    return (
                      <Card key={project.id} className="flex min-h-32 flex-col">
                        <CardHeader className="flex-row items-start justify-between gap-3 p-3 pb-1 md:p-4 md:pb-1">
                          <div className="min-w-0 flex-1">
                            <CardTitle
                              className="truncate"
                              title={project.name}
                            >
                              {project.name}
                            </CardTitle>
                            {project.tableNumber !== null && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                Table {project.tableNumber}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-3xl font-bold leading-none tracking-tight tabular-nums">
                              {project.completed}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              eval
                            </p>
                          </div>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col justify-end gap-2 px-3 pb-3 md:px-4 md:pb-4">
                          <div className="flex min-h-5 items-end">
                            {(project.beingJudged || project.reserved > 0) && (
                              <Badge
                                variant={
                                  project.beingJudged ? 'info' : 'default'
                                }
                                className="min-w-0 max-w-full gap-1.5"
                                data-pulsing={
                                  project.beingJudged &&
                                  data.status !== 'PAUSED'
                                }
                              >
                                <span
                                  className="size-1.5 shrink-0 rounded-full bg-current"
                                  aria-hidden="true"
                                />
                                <span className="min-w-0 truncate">
                                  {data.status === 'PAUSED'
                                    ? 'Paused'
                                    : project.beingJudged
                                      ? 'Being judged'
                                      : 'Judge on the way'}
                                </span>
                              </Badge>
                            )}
                          </div>
                          <div className="relative">
                            <Progress
                              variant={variant}
                              value={Math.min(
                                100,
                                (project.completed / track.maximum) * 100,
                              )}
                              className="h-1.5"
                              aria-label={`${project.name}: ${project.completed} evaluations. Minimum ${track.minimum}, target ${track.target}, maximum ${track.maximum}.`}
                            />
                            <span
                              className="absolute -top-0.5 h-2.5 w-px bg-muted-foreground"
                              style={{
                                left: `${(track.minimum / track.maximum) * 100}%`,
                              }}
                              title={`Minimum: ${track.minimum} evaluations`}
                              aria-hidden="true"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<RiFolderLine />}
                  title="No projects"
                  description="There are no projects in this track."
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <EmptyState
          icon={<RiFolderLine />}
          title="No tracks"
          description="No judging tracks are available."
        />
      )}
      <AlertDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === 'finish'
                ? 'Finish judging?'
                : dialog === 'pause'
                  ? 'Pause judging?'
                  : 'Resume judging?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === 'finish'
                ? 'Submitted scores will be kept. Unfinished assignments will be released and the event will enter Deliberation. Judges cannot submit after this.'
                : dialog === 'pause'
                  ? 'New assignments and score submissions will pause. Active presentation timers will pause too.'
                  : 'Judges can request projects and submit scores again. They can resume their presentation timers.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <AlertDialogBody>
              {dialog === 'finish' && (
                <FieldGroup>
                  <form.Field name="eventName">
                    {(field) => (
                      <Field data-invalid={Boolean(fieldError)}>
                        <FieldLabel htmlFor="finish-event-name">
                          Type “{data.name}” to confirm
                        </FieldLabel>
                        <Input
                          id="finish-event-name"
                          value={field.state.value}
                          onChange={(e) => {
                            field.handleChange(e.target.value);
                            setFieldError(undefined);
                          }}
                          disabled={pending}
                          aria-invalid={Boolean(fieldError)}
                          aria-describedby="finish-name-error"
                        />
                        <FieldError id="finish-name-error">
                          {fieldError}
                        </FieldError>
                      </Field>
                    )}
                  </form.Field>
                </FieldGroup>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setDialog(null)}
              >
                Cancel
              </Button>
              <LoadingButton
                type="submit"
                variant={dialog === 'finish' ? 'destructive' : 'default'}
                loading={pending}
              >
                {dialog === 'finish'
                  ? 'Finish judging'
                  : dialog === 'pause'
                    ? 'Pause judging'
                    : 'Resume judging'}
              </LoadingButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
