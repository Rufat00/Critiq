'use client';
import { useRef, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RiArrowGoBackLine, RiPlayFill, RiTimeLine } from '@remixicon/react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { HackathonSetupSummary } from '@critiq/core/hackathon';
import type { JudgingSetup } from '@critiq/core/judging';
import { Button, LoadingButton } from '@/components/ui/button';
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldError,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import { useUnsavedGuard } from '@/components/ui/unsaved-guard';
import { toast } from '@/components/ui/sonner';
import { ExportRoomsButton } from '../../rooms/components/export-rooms-button';
import { configureJudgingAction } from '../../judging/actions';
import {
  startHackathonJudgingAction,
  returnHackathonToDraftAction,
} from '../actions';

function ReadyJudgingTimer() {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <RiTimeLine className="size-4" aria-hidden="true" />
        Your judging timer
      </p>
      <p
        role="timer"
        aria-label="Judging time elapsed: 00:00:00"
        className="font-mono text-[clamp(2.75rem,10vw,6rem)] leading-none font-medium tracking-tight tabular-nums"
      >
        00:00:00
      </p>
    </div>
  );
}

export function JudgingStageHome({
  summary,
  setup,
}: {
  summary: HackathonSetupSummary;
  setup: JudgingSetup;
}) {
  const router = useRouter();
  const [revision, setRevision] = useState(setup.revision);
  const [plannedValues, setPlannedValues] = useState<string>();
  const [plan, setPlan] = useState<{
    feasible: boolean;
    targets: Record<string, number>;
  }>();
  const [dialog, setDialog] = useState<'start' | 'draft' | null>(null);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string[]>>
  >({});
  const [changing, setChanging] = useState(false);
  const busy = useRef(false);
  const form = useForm({
    defaultValues: {
      categories: setup.categories.map((c) => ({
        categoryId: c.id,
        minimumEvaluations: c.minimum,
        maximumEvaluations: c.maximum,
      })),
      feasibilityOverrideReason: '',
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      setFieldErrors({});
      try {
        const result = await configureJudgingAction({
          expectedRevision: revision,
          categories: value.categories.map((c) => ({
            ...c,
            desiredEvaluations: c.maximumEvaluations,
          })),
          judges: setup.judgeIds.map((judgeId) => ({ judgeId })),
          minRoomCompletionPercent: setup.roomSwitchPercent,
        });
        if (!result.ok) {
          setError(
            result.error.fieldErrors?.judges?.join(' ') ?? result.error.message,
          );
          setFieldErrors(result.error.fieldErrors ?? {});
          return;
        }
        setRevision(result.data.revision);
        setPlan(result.data.plan);
        setPlannedValues(JSON.stringify(value.categories));
        form.reset(value);
        toast.success('Judging plan calculated. Review your coverage targets.');
      } catch {
        setError('Unable to calculate the plan. Please try again.');
      }
    },
  });
  const pending = useStore(form.store, (s) => s.isSubmitting);
  const dirty = useStore(form.store, (s) => !s.isDefaultValue);
  const guard = useUnsavedGuard({ when: dirty && !changing });
  const currentValues = useStore(form.store, (s) =>
    JSON.stringify(s.values.categories),
  );
  const currentPlan = plan && plannedValues === currentValues;
  async function confirm() {
    if (busy.current) return;
    busy.current = true;
    setChanging(true);
    setError(undefined);
    try {
      const result =
        dialog === 'start'
          ? await startHackathonJudgingAction({
              feasibilityOverrideReason:
                form.state.values.feasibilityOverrideReason || undefined,
            })
          : await returnHackathonToDraftAction();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setDialog(null);
      toast.success(
        dialog === 'start' ? 'Judging has started.' : 'Returned to draft.',
      );
      router.refresh();
    } catch {
      setError('Unable to change the stage. Please try again.');
    } finally {
      setChanging(false);
      busy.current = false;
    }
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
      editable: true,
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
  const lastDialog = useRef<'start' | 'draft'>('start');
  function openDialog(value: 'start' | 'draft') {
    lastDialog.current = value;
    setError(undefined);
    setDialog(value);
  }
  const startTrigger = useRef<HTMLButtonElement>(null);
  const draftTrigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <section aria-label="Ready for judging" className="relative isolate grid">
        <div className="absolute inset-x-4 top-10 translate-y-5 opacity-25 blur-[2px] transition-[opacity,filter,transform] duration-700 motion-reduce:transition-none sm:top-12">
          <ReadyJudgingTimer />
        </div>
        <div className="col-start-1 row-start-1 flex flex-col items-center gap-5 bg-gradient-to-t from-background via-background/90 to-transparent px-5 pt-48 pb-10 text-center transition-[opacity,filter,transform] duration-700 motion-reduce:transition-none sm:px-10 sm:pt-56">
          <Badge variant="success">Ready for judging</Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything’s in place.
          </h1>
          <Button
            ref={startTrigger}
            size="lg"
            className="min-w-56"
            disabled={pending || changing}
            onClick={() => openDialog('start')}
          >
            <RiPlayFill data-icon="inline-start" />
            Start judging
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              ref={draftTrigger}
              variant="ghost"
              disabled={pending || changing}
              onClick={() => openDialog('draft')}
            >
              <RiArrowGoBackLine data-icon="inline-start" />
              Return to draft
            </Button>
            <ExportRoomsButton
              search=""
              disabled={pending || changing}
              label="Export rooms"
            />
          </div>
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
      <ResponsiveDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !changing && !pending)
            void guard(() => {
              form.reset();
              setDialog(null);
            });
        }}
      >
        <ResponsiveDialogContent
          className="sm:max-w-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (lastDialog.current === 'start'
              ? startTrigger
              : draftTrigger
            ).current?.focus({ preventScroll: true });
          }}
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {dialog === 'start' ? 'Start judging' : 'Return to draft?'}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {dialog === 'start'
                ? 'Set minimum and maximum assignments per project for each track. Calculate coverage targets, review the plan, then start.'
                : 'Your setup will become editable again.'}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {dialog === 'start' ? (
            <ResponsiveDialogBody>
              {setup.judgeIds.length === 0 && (
                <Alert variant="warning" className="mb-5">
                  <AlertDescription>
                    No active judges have track access yet. Assign a judge to a
                    track before calculating the judging plan.
                    <Button asChild variant="link">
                      <Link href="/admin/judges">Manage judges</Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <form
                className="flex flex-col gap-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  void form.handleSubmit();
                }}
              >
                <FieldGroup>
                  {setup.categories.map((category, index) =>
                    category.kind === 'CHALLENGE' ? null : (
                      <FieldSet
                        key={category.id}
                        className="rounded-xl border p-4"
                      >
                        <FieldLegend>{category.name}</FieldLegend>
                        <FieldGroup className="grid gap-4 sm:grid-cols-2">
                          {(
                            [
                              'minimumEvaluations',
                              'maximumEvaluations',
                            ] as const
                          ).map((name, i) => (
                            <form.Field
                              key={name}
                              name={`categories[${index}].${name}`}
                            >
                              {(field) => (
                                <Field
                                  data-invalid={Boolean(
                                    fieldErrors[`categories.${index}.${name}`],
                                  )}
                                >
                                  <FieldLabel
                                    htmlFor={`${category.id}-${name}`}
                                  >
                                    {
                                      [
                                        'Minimum assignments',
                                        'Maximum assignments',
                                      ][i]
                                    }
                                  </FieldLabel>
                                  <Input
                                    id={`${category.id}-${name}`}
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={field.state.value}
                                    aria-invalid={Boolean(
                                      fieldErrors[
                                        `categories.${index}.${name}`
                                      ],
                                    )}
                                    aria-describedby={`${category.id}-${name}-error`}
                                    onChange={(e) =>
                                      field.handleChange(Number(e.target.value))
                                    }
                                    disabled={pending || changing}
                                    required
                                  />
                                  <FieldError
                                    id={`${category.id}-${name}-error`}
                                  >
                                    {fieldErrors[
                                      `categories.${index}.${name}`
                                    ]?.join(' ')}
                                  </FieldError>
                                </Field>
                              )}
                            </form.Field>
                          ))}
                        </FieldGroup>
                        {currentPlan && (
                          <p className="text-sm text-info">
                            Calculated target: {plan.targets[category.id]}{' '}
                            evaluations per project
                          </p>
                        )}
                      </FieldSet>
                    ),
                  )}
                </FieldGroup>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {currentPlan && (
                  <Alert variant={plan.feasible ? 'info' : 'warning'}>
                    <AlertDescription>
                      {plan.feasible
                        ? 'Minimum coverage is estimated feasible. Targets account for available judges and project eligibility.'
                        : 'There is an estimated minimum coverage shortfall. Add judges, lower requirements, or explicitly acknowledge it when starting.'}
                    </AlertDescription>
                  </Alert>
                )}
                {plan && !plan.feasible && (
                  <FieldGroup>
                    <form.Field name="feasibilityOverrideReason">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor="shortfall-reason">
                            Why proceed with the coverage shortfall?
                          </FieldLabel>
                          <Input
                            id="shortfall-reason"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            minLength={10}
                            maxLength={2000}
                            disabled={changing || pending}
                          />
                        </Field>
                      )}
                    </form.Field>
                  </FieldGroup>
                )}
                <LoadingButton
                  type="submit"
                  loading={pending}
                  disabled={changing || setup.judgeIds.length === 0}
                >
                  {plan ? 'Recalculate plan' : 'Calculate judging plan'}
                </LoadingButton>
              </form>
            </ResponsiveDialogBody>
          ) : (
            <ResponsiveDialogBody>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </ResponsiveDialogBody>
          )}
          <ResponsiveDialogFooter>
            <Button
              variant="secondary"
              disabled={changing || pending}
              onClick={() =>
                void guard(() => {
                  form.reset();
                  setDialog(null);
                })
              }
            >
              Cancel
            </Button>
            <LoadingButton
              loading={changing}
              disabled={pending || (dialog === 'start' && !currentPlan)}
              onClick={() => void confirm()}
            >
              {dialog === 'start' ? 'Start judging' : 'Return to draft'}
            </LoadingButton>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
