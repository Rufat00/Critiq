'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RiArrowGoBackLine, RiPlayFill, RiTimeLine } from '@remixicon/react';
import type { HackathonSetupSummary } from '@critiq/core/hackathon';
import { Button, LoadingButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { ExportRoomsButton } from '../../rooms/components/export-rooms-button';
import {
  returnHackathonToDraftAction,
  startHackathonJudgingAction,
} from '../actions';

function JudgingTimer({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  const seconds =
    startedAt && now !== null
      ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
      : 0;
  const time = [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <RiTimeLine className="size-4" aria-hidden="true" />
        {startedAt ? 'Judging time elapsed' : 'Your judging timer'}
      </p>
      <p
        role="timer"
        aria-label={`Judging time elapsed: ${time}`}
        className="font-mono text-[clamp(2.75rem,10vw,6rem)] leading-none font-medium tracking-tight tabular-nums"
      >
        {time}
      </p>
    </div>
  );
}

export function JudgingStageHome({
  summary,
}: {
  summary: HackathonSetupSummary;
}) {
  const router = useRouter();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'start' | 'draft' | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const liveHeading = useRef<HTMLHeadingElement>(null);
  const startTrigger = useRef<HTMLButtonElement>(null);
  const draftTrigger = useRef<HTMLButtonElement>(null);
  const lastDialog = useRef<'start' | 'draft'>('start');
  const live = summary.status === 'JUDGING' || startedAt !== null;
  const timerStartedAt = summary.judgingStartedAt ?? startedAt;
  useEffect(() => {
    if (startedAt) liveHeading.current?.focus({ preventScroll: true });
  }, [startedAt]);

  function confirm() {
    if (submitting.current || !dialog) return;
    submitting.current = true;
    setError(undefined);
    const action = dialog;
    startTransition(async () => {
      try {
        if (action === 'start') {
          const result = await startHackathonJudgingAction();
          if (!result.ok) {
            setError(result.error.message);
            return;
          }
          setDialog(null);
          setStartedAt(result.data.startedAt);
          toast.success('Judging has started.');
        } else {
          const result = await returnHackathonToDraftAction();
          if (!result.ok) {
            setError(result.error.message);
            return;
          }
          setDialog(null);
          toast.success('Returned to draft. Your setup is editable again.');
        }
        router.refresh();
      } catch {
        setError('Unable to change the stage. Please try again.');
      } finally {
        submitting.current = false;
      }
    });
  }
  const stats = [
    {
      title: 'Projects',
      count: summary.counts.projects,
      href: '/admin/projects',
      editable: false,
    },
    {
      title: 'Judges',
      count: summary.counts.judges,
      href: '/admin/judges',
      editable: !live,
    },
    {
      title: 'Rooms',
      count: summary.counts.rooms,
      href: '/admin/rooms',
      editable: false,
    },
    {
      title: 'Tracks · Challenges',
      count: `${summary.counts.tracks} · ${summary.counts.challenges}`,
      href: '/admin/categories',
      editable: false,
    },
  ];
  function openDialog(value: 'start' | 'draft') {
    lastDialog.current = value;
    setError(undefined);
    setDialog(value);
  }
  return (
    <>
      {live && (
        <div className="flex justify-end">
          <ExportRoomsButton
            search=""
            disabled={pending}
            label="Export rooms"
          />
        </div>
      )}
      <section
        aria-label={live ? 'Judging in progress' : 'Ready for judging'}
        className="relative isolate grid"
      >
        <div
          className={cn(
            'absolute inset-x-4 top-10 transition-[opacity,filter,transform] duration-700 motion-reduce:transition-none sm:top-12',
            live
              ? 'translate-y-0 opacity-100 blur-none'
              : 'translate-y-5 opacity-25 blur-[2px]',
          )}
        >
          <JudgingTimer startedAt={timerStartedAt} />
        </div>
        <div
          inert={live}
          aria-hidden={live}
          className={cn(
            'col-start-1 row-start-1 flex flex-col items-center gap-5 bg-gradient-to-t from-background via-background/90 to-transparent px-5 pt-48 pb-10 text-center transition-[opacity,filter,transform] duration-700 motion-reduce:transition-none sm:px-10 sm:pt-56',
            live && 'pointer-events-none translate-y-6 opacity-0 blur-md',
          )}
        >
          <Badge variant="success">Ready for judging</Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything’s in place.
          </h1>
          <Button
            ref={startTrigger}
            size="lg"
            className="min-w-56"
            disabled={pending}
            onClick={() => openDialog('start')}
          >
            <RiPlayFill data-icon="inline-start" />
            Start judging
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              ref={draftTrigger}
              variant="ghost"
              disabled={pending}
              onClick={() => openDialog('draft')}
            >
              <RiArrowGoBackLine data-icon="inline-start" />
              Return to draft
            </Button>
            <ExportRoomsButton
              search=""
              disabled={pending}
              label="Export rooms"
            />
          </div>
        </div>
        <div
          inert={!live}
          aria-hidden={!live}
          className={cn(
            'col-start-1 row-start-1 flex flex-col items-center justify-end gap-4 px-5 pt-56 pb-10 text-center transition-[opacity,transform] duration-700 motion-reduce:transition-none sm:px-10',
            live
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-6 opacity-0',
          )}
        >
          <Badge variant="success">Judging in progress</Badge>
          <h1
            ref={liveHeading}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight outline-none"
          >
            Judging has started.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Your event setup is locked. Review projects, judges, and room
            locations below.
          </p>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.href}>
            <CardHeader>
              <CardTitle>{stat.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <p className="text-3xl font-semibold tabular-nums">
                {stat.count}
              </p>
              <Button asChild variant="secondary" size="sm">
                <Link
                  href={stat.href}
                  aria-label={`${stat.editable ? 'Manage' : 'View'} ${stat.title.toLowerCase()}`}
                >
                  {stat.editable ? 'Manage' : 'View'}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <AlertDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!submitting.current && !open) setDialog(null);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (live) liveHeading.current?.focus({ preventScroll: true });
            else
              (lastDialog.current === 'start'
                ? startTrigger
                : draftTrigger
              ).current?.focus({ preventScroll: true });
          }}
          onEscapeKeyDown={(event) => {
            if (submitting.current) event.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === 'start' ? 'Start judging now?' : 'Return to draft?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === 'start'
                ? 'This starts the elapsed timer and all enabled judging categories. Judges and configuration will be locked, and you can no longer return to draft.'
                : 'Your setup will be kept and become editable again. You’ll need to mark the event ready again before starting judging.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <AlertDialogBody>
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </AlertDialogBody>
          )}
          <AlertDialogFooter>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setDialog(null)}
            >
              Cancel
            </Button>
            <LoadingButton loading={pending} onClick={confirm}>
              {dialog === 'start' ? 'Start judging' : 'Return to draft'}
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
