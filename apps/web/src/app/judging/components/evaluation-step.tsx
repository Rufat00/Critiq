'use client';
import { useEffect, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import type { JudgeWorkspace } from '@critiq/core/judging';
import { DraggableList } from '@/components/ui/draggable-list';
import { ScoreField, type ScoreFieldVariant } from '@/components/score-field';
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldError,
} from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button, LoadingButton } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUnsavedGuard } from '@/components/ui/unsaved-guard';
import {
  getJudgeRelativeRankingAction,
  updateRelativeRankingAction,
  submitRubricEvaluationAction,
  submitRatingVoteAction,
} from '../actions';
type Assignment = NonNullable<JudgeWorkspace['visit']>['assignments'][number];
type Ranking = { revision: number; projects: { id: string; name: string }[] };
const colors: ScoreFieldVariant[] = [
  'primary',
  'info',
  'success',
  'warning',
  'destructive',
];
export function EvaluationStep(props: {
  assignment: Assignment;
  workspace: JudgeWorkspace;
  disabled: boolean;
  onSubmitted: () => Promise<void>;
}) {
  const [ranking, setRanking] = useState<Ranking>();
  const [error, setError] = useState<string>();
  const relative = props.assignment.category.method === 'RELATIVE';
  async function load() {
    setError(undefined);
    try {
      const result = await getJudgeRelativeRankingAction({
        categoryId: props.assignment.categoryId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setRanking(result.data);
    } catch {
      setError('Unable to load your ranking. Please retry.');
    }
  }
  useEffect(() => {
    if (relative) void load();
  }, []);
  if (relative && !ranking)
    return error ? (
      <Alert variant="destructive">
        <AlertDescription>
          {error}
          <Button variant="link" onClick={() => void load()}>
            Retry ranking
          </Button>
        </AlertDescription>
      </Alert>
    ) : (
      <div aria-label="Loading your ranking" className="flex flex-col gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  return <EvaluationForm {...props} ranking={ranking} />;
}
function EvaluationForm({
  assignment,
  workspace,
  disabled,
  onSubmitted,
  ranking,
}: {
  assignment: Assignment;
  workspace: JudgeWorkspace;
  disabled: boolean;
  onSubmitted: () => Promise<void>;
  ranking?: Ranking;
}) {
  const visit = workspace.visit!;
  const rubric =
    workspace.rubrics.find((r) => r.categoryId === assignment.categoryId)
      ?.rubric ?? [];
  const initialProjects = ranking
    ? [
        ...ranking.projects.filter((p) => p.id !== visit.project.id),
        { id: visit.project.id, name: visit.project.name },
      ]
    : [];
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string[]>>
  >({});
  const [saved, setSaved] = useState(false);
  const [ratingError, setRatingError] = useState<string>();
  const form = useForm({
    defaultValues: {
      projects: initialProjects,
      rating: 0,
      marks: rubric.map((c) => ({ criterionId: c.id, value: c.lower })),
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      setFieldErrors({});
      setRatingError(undefined);
      if (assignment.category.method === 'RATING_SCALE' && !value.rating) {
        setRatingError('Choose a rating before submitting.');
        return;
      }
      try {
        const result =
          assignment.category.method === 'RELATIVE'
            ? await updateRelativeRankingAction({
                categoryId: assignment.categoryId,
                expectedRevision: ranking!.revision,
                orderedProjectIds: value.projects.map((p) => p.id),
                visitId: visit.id,
                assignmentId: assignment.id,
              })
            : assignment.category.method === 'RUBRIC'
              ? await submitRubricEvaluationAction({
                  visitId: visit.id,
                  assignmentId: assignment.id,
                  marks: value.marks,
                })
              : await submitRatingVoteAction({
                  visitId: visit.id,
                  assignmentId: assignment.id,
                  rating: value.rating,
                });
        if (!result.ok) {
          setError(result.error.message);
          setFieldErrors(result.error.fieldErrors ?? {});
          return;
        }
        setSaved(true);
        await onSubmitted();
      } catch {
        setError(
          'Unable to submit. Your choices are still here. Please retry.',
        );
      }
    },
  });
  const pending = useStore(form.store, (s) => s.isSubmitting);
  useUnsavedGuard({ when: !saved });
  const challenge = assignment.category.kind === 'CHALLENGE';
  return (
    <form
      className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-2 duration-200 motion-reduce:animate-none"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && !saved) void form.handleSubmit();
      }}
    >
      <h2 className="text-2xl font-semibold">
        {assignment.category.method === 'RATING_SCALE'
          ? `Should it win “${assignment.category.name}”?`
          : challenge
            ? `Rate this project for “${assignment.category.name}”`
            : assignment.category.method === 'RELATIVE'
              ? 'Where does this project belong?'
              : 'Rate this project'}
      </h2>
      <FieldGroup>
        {assignment.category.method === 'RELATIVE' && (
          <form.Field name="projects">
            {(field) => (
              <Field>
                <FieldLabel>Rank your projects, best first</FieldLabel>
                <DraggableList
                  items={field.state.value}
                  getItemLabel={(p) => p.name}
                  onOrderChange={field.handleChange}
                  renderItem={(p, rank) => (
                    <p className="font-medium">
                      {rank}. {p.name}
                      {p.id === visit.project.id && (
                        <span className="ml-2 rounded-full bg-soft px-2 py-0.5 text-xs text-soft-foreground">
                          Just judged
                        </span>
                      )}
                    </p>
                  )}
                  label={`Your ${assignment.category.name} ranking`}
                  disabled={pending || disabled || saved}
                />
                <FieldError>
                  {fieldErrors.orderedProjectIds?.join(' ')}
                </FieldError>
              </Field>
            )}
          </form.Field>
        )}
        {assignment.category.method === 'RUBRIC' &&
          rubric.map((criterion, index) => (
            <form.Field key={criterion.id} name={`marks[${index}].value`}>
              {(field) => (
                <Field data-invalid={Boolean(fieldErrors.marks)}>
                  <ScoreField
                    id={`score-${criterion.id}`}
                    label={criterion.name ?? `Criterion ${index + 1}`}
                    description={criterion.description ?? undefined}
                    min={criterion.lower}
                    max={criterion.upper}
                    value={field.state.value}
                    variant={colors[index % colors.length]}
                    disabled={pending || disabled || saved}
                    onValueChange={field.handleChange}
                  />
                  <FieldError>
                    {fieldErrors[`marks.${index}.value`]?.join(' ')}
                  </FieldError>
                </Field>
              )}
            </form.Field>
          ))}
        {assignment.category.method === 'RATING_SCALE' && (
          <form.Field name="rating">
            {(field) => (
              <FieldSet
                data-invalid={Boolean(ratingError || fieldErrors.rating)}
              >
                <FieldLegend className="sr-only">
                  Should this project win?
                </FieldLegend>
                <RadioGroup
                  value={String(field.state.value)}
                  onValueChange={(value) => {
                    field.handleChange(Number(value));
                    setRatingError(undefined);
                  }}
                  disabled={pending || disabled || saved}
                  aria-invalid={Boolean(ratingError)}
                  aria-describedby="vote-error"
                  className="gap-3"
                >
                  {workspace.ratingLabels.map((option) => (
                    <Field
                      key={option.value}
                      orientation="horizontal"
                      className="rounded-xl border px-4 py-2"
                    >
                      <RadioGroupItem
                        id={`vote-${option.value}`}
                        value={String(option.value)}
                      />
                      <FieldLabel
                        htmlFor={`vote-${option.value}`}
                        className="min-h-11 flex-1"
                      >
                        {option.label}
                      </FieldLabel>
                    </Field>
                  ))}
                </RadioGroup>
                <FieldError id="vote-error">
                  {ratingError || fieldErrors.rating?.join(' ')}
                </FieldError>
              </FieldSet>
            )}
          </form.Field>
        )}
      </FieldGroup>
      {fieldErrors.marks && (
        <FieldError>{fieldErrors.marks.join(' ')}</FieldError>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {saved ? (
        <Alert variant="success">
          <AlertDescription>
            Evaluation saved.
            <Button
              type="button"
              variant="link"
              onClick={() => void onSubmitted()}
            >
              Continue
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Your evaluation is not saved until you submit.
          </p>
          <LoadingButton
            size="lg"
            type="submit"
            className="w-full"
            loading={pending}
            disabled={disabled}
          >
            Submit evaluation
          </LoadingButton>
        </>
      )}
    </form>
  );
}
