'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import {
  RiAddLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCloseLine,
} from '@remixicon/react';
import type { JudgingCategories } from '@critiq/core/categories';
import { judgingMethodLabels, rubricWeightOptions } from '@critiq/constants';
import { Button, LoadingButton } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { VideoCard } from '@/components/video-card';
import { videos } from '@/lib/constants/videos';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from '@/components/ui/input-group';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUnsavedGuard } from '@/components/ui/unsaved-guard';
import { RubricWeightDonut, rubricColors } from './rubric-weight-donut';
import { CategorySelectionPill } from './category-selection-pill';
import { cn } from '@/lib/utils';
import { createCategoryAction, updateCategoryAction } from '../actions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type Method = 'RELATIVE' | 'RATING_SCALE' | 'RUBRIC';
type RubricDraft = { id: string; name: string; weight: number };
type Screen = 'details' | 'method' | 'membership';

export function CategoryFormDialog({
  kind,
  categories,
  locked,
  onSaved,
  editCategoryId,
  editOpen,
  onEditOpenChange,
  onEditClosed,
}: {
  kind: 'track' | 'challenge';
  categories: JudgingCategories;
  locked: boolean;
  onSaved: (message: string) => void;
  editCategoryId?: string;
  editOpen?: boolean;
  onEditOpenChange?: (open: boolean) => void;
  onEditClosed?: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const editing = Boolean(editCategoryId);
  const open = editing ? Boolean(editOpen) : createOpen;
  const setOpen = editing ? onEditOpenChange! : setCreateOpen;
  const category =
    kind === 'track'
      ? categories.tracks.find((item) => item.id === editCategoryId)
      : categories.challenges.find((item) => item.id === editCategoryId);
  const challenge = categories.challenges.find(
    (item) => item.id === editCategoryId,
  );
  const [screen, setScreen] = useState<Screen>('details');
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string[]>>
  >({});
  const submitting = useRef(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const router = useRouter();
  const defaultMethod: Method = kind === 'track' ? 'RELATIVE' : 'RATING_SCALE';
  const trackOptions = categories.tracks.filter(
    (track) => track.trackId !== null,
  );
  const challengeOptions = categories.challenges.filter(
    (challenge) => challenge.challengeId !== null,
  );
  const hasMembershipScreen =
    kind === 'challenge' || challengeOptions.length > 0;
  const form = useForm({
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      method: (category?.method ?? defaultMethod) as Method,
      criteria: (category?.criteria ?? []) as RubricDraft[],
      includesOverall: challenge?.includesOverall ?? true,
      trackIds: categories.tracks
        .filter(
          (track) => track.trackId && challenge?.trackIds.includes(track.id),
        )
        .map((track) => track.trackId!),
      challengeIds: categories.challenges
        .filter(
          (item) =>
            editCategoryId &&
            item.trackIds.includes(editCategoryId) &&
            item.challengeId,
        )
        .map((item) => item.challengeId!),
    },
    onSubmit: async ({ value }) => {
      if (submitting.current || locked) return;
      submitting.current = true;
      clearErrors();
      try {
        const input = {
          kind: kind === 'track' ? ('TRACK' as const) : ('CHALLENGE' as const),
          name: value.name,
          description: value.description,
          method: value.method,
          criteria:
            value.method === 'RUBRIC'
              ? value.criteria.map((item) => ({
                  name: item.name,
                  weight: item.weight,
                }))
              : [],
          includesOverall: kind === 'challenge' ? value.includesOverall : true,
          trackIds: kind === 'challenge' ? value.trackIds : [],
          challengeIds: kind === 'track' ? value.challengeIds : [],
        };
        const result = editing
          ? await updateCategoryAction({
              ...input,
              categoryId: editCategoryId!,
            })
          : await createCategoryAction(input);
        if (!result.ok) {
          const errors = result.error.fieldErrors ?? {};
          setFieldErrors(errors);
          setError(result.error.message);
          toast.error(result.error.message);
          if (errors.name || errors.description) setScreen('details');
          else if (
            Object.keys(errors).some(
              (key) => key === 'method' || key.startsWith('criteria'),
            )
          )
            setScreen('method');
          else if (errors.trackIds || errors.challengeIds)
            setScreen('membership');
          return;
        }
        form.reset();
        setOpen(false);
        onSaved(`${result.data.name} was ${editing ? 'updated' : 'created'}.`);
        router.refresh();
      } catch {
        const message =
          'Unable to save. Your changes are still here. Please try again.';
        setError(message);
        toast.error(message);
      } finally {
        submitting.current = false;
      }
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const pending = useStore(form.store, (state) => state.isSubmitting);
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);
  const guard = useUnsavedGuard({ when: open && dirty });
  const rubric = values.method === 'RUBRIC';
  const total = values.criteria.reduce((sum, item) => sum + item.weight, 0);
  const normalizedNames = values.criteria.map((item) =>
    item.name.trim().replace(/\s+/g, ' ').toLowerCase(),
  );
  const validDetails =
    Boolean(values.name.trim()) &&
    values.name.trim().length <= 100 &&
    values.description.trim().length <= 2000;
  const validMethod =
    !rubric ||
    (values.criteria.length > 0 &&
      values.criteria.length <= 10 &&
      total === 100 &&
      new Set(normalizedNames).size === values.criteria.length &&
      values.criteria.every(
        (item) =>
          item.name.trim() &&
          item.name.trim().length <= 100 &&
          (rubricWeightOptions as readonly number[]).includes(item.weight),
      ));
  const validMembership =
    kind === 'track' || values.includesOverall || values.trackIds.length > 0;
  const isLastScreen =
    screen === 'membership' || (screen === 'method' && !hasMembershipScreen);
  const canContinue =
    screen === 'details'
      ? validDetails
      : screen === 'method'
        ? validMethod
        : validMembership;
  useEffect(() => {
    if (!open || editing) return;
    if (screen === 'details') document.getElementById(`${id}-name`)?.focus();
    else heading.current?.focus();
  }, [open, screen, id, editing]);
  function clearErrors() {
    setError(undefined);
    setFieldErrors({});
  }
  function requestClose() {
    if (submitting.current || form.state.isSubmitting) return;
    void guard(() => {
      form.reset();
      clearErrors();
      setOpen(false);
    });
  }
  function advance() {
    if (pending || locked || (editing && !dirty)) return;
    if (editing) {
      if (validDetails && validMethod && validMembership)
        void form.handleSubmit();
      return;
    }
    if (!canContinue) return;
    if (isLastScreen) {
      if (validDetails && validMethod && validMembership)
        void form.handleSubmit();
    } else setScreen(screen === 'details' ? 'method' : 'membership');
  }
  function addItem() {
    clearErrors();
    const itemId = crypto.randomUUID();
    form.pushFieldValue('criteria', { id: itemId, name: '', weight: 20 });
    requestAnimationFrame(() =>
      document.getElementById(`${id}-${itemId}-name`)?.focus(),
    );
  }
  const title =
    screen === 'details'
      ? editing
        ? `Edit ${kind}`
        : `Name your ${kind}`
      : screen === 'method'
        ? `How should this ${kind} be judged?`
        : kind === 'challenge'
          ? 'Which tracks can enter this challenge?'
          : 'Which challenges belong in this track?';
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) requestClose();
        else {
          form.reset();
          clearErrors();
          setScreen('details');
          setOpen(true);
        }
      }}
    >
      {!editing && (
        <DialogTrigger asChild>
          <Button type="button" size="sm" disabled={locked}>
            <RiAddLine data-icon="inline-start" />
            Create {kind}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className="flex h-[min(38rem,calc(100dvh-2rem))] flex-col overflow-hidden sm:max-w-5xl"
        aria-describedby={undefined}
        showCloseButton={!pending}
        onCloseAutoFocus={(event) => {
          if (editing) {
            event.preventDefault();
            onEditClosed?.();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <form
          className="flex min-h-0 flex-1 flex-col"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            advance();
          }}
        >
          <DialogBody className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-14 sm:px-10 sm:pt-14">
            <div
              className={cn(
                'my-auto flex w-full shrink-0 flex-col gap-6',
                !editing && screen === 'details' && 'mx-auto max-w-2xl',
              )}
            >
              <DialogTitle ref={heading} tabIndex={-1} className="outline-none">
                {title}
              </DialogTitle>
              <FormTabs
                editing={editing}
                screen={screen}
                onScreenChange={setScreen}
              >
                {editing && (
                  <TabsList aria-label={`Edit ${kind}`}>
                    <TabsTrigger value="details" disabled={pending}>
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="method" disabled={pending}>
                      Judging method
                    </TabsTrigger>
                    {hasMembershipScreen && (
                      <TabsTrigger value="membership" disabled={pending}>
                        {kind === 'challenge' ? 'Tracks' : 'Challenges'}
                      </TabsTrigger>
                    )}
                  </TabsList>
                )}
                <FormPanel editing={editing} screen={screen} value="details">
                  <FieldGroup>
                    <form.Field name="name">
                      {(field) => (
                        <Field
                          data-invalid={Boolean(fieldErrors.name)}
                          data-disabled={pending}
                        >
                          <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
                          <Input
                            id={`${id}-name`}
                            name={field.name}
                            required
                            maxLength={100}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              field.handleChange(event.target.value);
                              clearErrors();
                            }}
                            disabled={pending}
                            aria-invalid={Boolean(fieldErrors.name)}
                            aria-describedby={`${id}-name-error`}
                          />
                          <FieldError id={`${id}-name-error`}>
                            {fieldErrors.name?.[0]}
                          </FieldError>
                        </Field>
                      )}
                    </form.Field>
                    <form.Field name="description">
                      {(field) => (
                        <Field
                          data-invalid={Boolean(fieldErrors.description)}
                          data-disabled={pending}
                        >
                          <FieldLabel htmlFor={`${id}-description`}>
                            Description{' '}
                            <span className="text-muted-foreground">
                              (optional)
                            </span>
                          </FieldLabel>
                          <Textarea
                            id={`${id}-description`}
                            name={field.name}
                            maxLength={2000}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              field.handleChange(event.target.value);
                              clearErrors();
                            }}
                            disabled={pending}
                            aria-invalid={Boolean(fieldErrors.description)}
                            aria-describedby={`${id}-description-error`}
                          />
                          <FieldError id={`${id}-description-error`}>
                            {fieldErrors.description?.[0]}
                          </FieldError>
                        </Field>
                      )}
                    </form.Field>
                  </FieldGroup>
                </FormPanel>
                <FormPanel editing={editing} screen={screen} value="method">
                  <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_280px]">
                    <FieldGroup>
                      <form.Field name="method">
                        {(field) => (
                          <Field
                            data-invalid={Boolean(fieldErrors.method)}
                            data-disabled={pending}
                          >
                            <FieldLabel
                              className="sr-only"
                              htmlFor={`${id}-method`}
                            >
                              Judging method
                            </FieldLabel>
                            <Select
                              value={field.state.value}
                              disabled={pending}
                              onValueChange={(value) => {
                                field.handleChange(value as Method);
                                clearErrors();
                              }}
                            >
                              <SelectTrigger
                                id={`${id}-method`}
                                onBlur={field.handleBlur}
                                aria-invalid={Boolean(fieldErrors.method)}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {[defaultMethod, 'RUBRIC' as const].map(
                                    (method) => (
                                      <SelectItem
                                        key={method}
                                        value={method}
                                        textValue={judgingMethodLabels[method]}
                                      >
                                        <span>
                                          {judgingMethodLabels[method]}
                                        </span>
                                        {method === defaultMethod && (
                                          <Badge variant="info">
                                            Recommended
                                          </Badge>
                                        )}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FieldError>{fieldErrors.method?.[0]}</FieldError>
                          </Field>
                        )}
                      </form.Field>
                      {rubric && (
                        <FieldSet disabled={pending} className="gap-4">
                          <FieldLegend variant="label" className="sr-only">
                            Rubric items
                          </FieldLegend>
                          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_200px]">
                            <form.Field name="criteria" mode="array">
                              {(array) => (
                                <FieldGroup className="gap-3">
                                  {array.state.value.map((item, index) => {
                                    const nameError =
                                      fieldErrors[
                                        `criteria.${index}.name`
                                      ]?.[0] ??
                                      (item.name.trim() &&
                                      normalizedNames.filter(
                                        (name) =>
                                          name === normalizedNames[index],
                                      ).length > 1
                                        ? 'Use a distinct name for each item.'
                                        : undefined);
                                    const weightError =
                                      fieldErrors[
                                        `criteria.${index}.weight`
                                      ]?.[0];
                                    return (
                                      <Field
                                        key={item.id}
                                        data-invalid={Boolean(
                                          nameError || weightError,
                                        )}
                                        data-disabled={pending}
                                      >
                                        <FieldLabel
                                          className="sr-only"
                                          htmlFor={`${id}-${item.id}-name`}
                                        >
                                          Rubric item {index + 1}
                                        </FieldLabel>
                                        <div className="flex items-center gap-2">
                                          <span
                                            aria-hidden="true"
                                            className="size-2 shrink-0 rounded-full"
                                            style={{
                                              backgroundColor:
                                                rubricColors[
                                                  index % rubricColors.length
                                                ],
                                            }}
                                          />
                                          <InputGroup>
                                            <form.Field
                                              name={`criteria[${index}].name`}
                                            >
                                              {(field) => (
                                                <InputGroupInput
                                                  id={`${id}-${item.id}-name`}
                                                  name={field.name}
                                                  placeholder="Item name"
                                                  required
                                                  maxLength={100}
                                                  value={field.state.value}
                                                  onBlur={field.handleBlur}
                                                  disabled={pending}
                                                  aria-invalid={Boolean(
                                                    nameError,
                                                  )}
                                                  aria-describedby={`${id}-${item.id}-error`}
                                                  onChange={(event) => {
                                                    field.handleChange(
                                                      event.target.value,
                                                    );
                                                    clearErrors();
                                                  }}
                                                />
                                              )}
                                            </form.Field>
                                            <InputGroupAddon>
                                              <form.Field
                                                name={`criteria[${index}].weight`}
                                              >
                                                {(field) => (
                                                  <Select
                                                    value={String(
                                                      field.state.value,
                                                    )}
                                                    disabled={pending}
                                                    onValueChange={(value) => {
                                                      field.handleChange(
                                                        Number(value),
                                                      );
                                                      clearErrors();
                                                    }}
                                                  >
                                                    <SelectTrigger
                                                      aria-label={`Weight of rubric item ${index + 1}`}
                                                      aria-invalid={Boolean(
                                                        weightError,
                                                      )}
                                                    >
                                                      <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectGroup>
                                                        {rubricWeightOptions.map(
                                                          (weight) => (
                                                            <SelectItem
                                                              key={weight}
                                                              value={String(
                                                                weight,
                                                              )}
                                                            >
                                                              {weight}%
                                                            </SelectItem>
                                                          ),
                                                        )}
                                                      </SelectGroup>
                                                    </SelectContent>
                                                  </Select>
                                                )}
                                              </form.Field>
                                            </InputGroupAddon>
                                          </InputGroup>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={pending}
                                            aria-label={`Remove ${item.name || `rubric item ${index + 1}`}`}
                                            onClick={() => {
                                              void array.removeValue(index);
                                              clearErrors();
                                              requestAnimationFrame(() =>
                                                addButton.current?.focus(),
                                              );
                                            }}
                                          >
                                            <RiCloseLine />
                                          </Button>
                                        </div>
                                        <FieldError
                                          id={`${id}-${item.id}-error`}
                                        >
                                          {nameError ?? weightError}
                                        </FieldError>
                                      </Field>
                                    );
                                  })}
                                  {array.state.value.length < 10 && (
                                    <Button
                                      ref={addButton}
                                      type="button"
                                      variant="ghost"
                                      disabled={pending}
                                      className="w-full justify-start rounded-lg border border-dashed border-input"
                                      onClick={addItem}
                                    >
                                      <RiAddLine data-icon="inline-start" />
                                      Add rubric item
                                    </Button>
                                  )}
                                  <FieldError>
                                    {fieldErrors.criteria?.[0]}
                                  </FieldError>
                                </FieldGroup>
                              )}
                            </form.Field>
                            <div className="flex flex-col items-center gap-3 xl:sticky xl:top-0">
                              <RubricWeightDonut items={values.criteria} />
                              <p
                                role="status"
                                className="text-center text-sm text-muted-foreground"
                              >
                                {total < 100
                                  ? `${100 - total}% left to allocate`
                                  : total > 100
                                    ? `${total - 100}% over the limit`
                                    : 'All 100% allocated'}
                              </p>
                            </div>
                          </div>
                        </FieldSet>
                      )}
                    </FieldGroup>
                    <VideoCard
                      video={
                        kind === 'track'
                          ? videos.trackJudgingMethod
                          : videos.challengeJudgingMethod
                      }
                    />
                  </div>
                </FormPanel>
                <FormPanel editing={editing} screen={screen} value="membership">
                  <FieldSet disabled={pending} className="gap-5">
                    <FieldLegend className="sr-only">
                      {kind === 'challenge'
                        ? 'Included tracks'
                        : 'Included challenges'}
                    </FieldLegend>
                    {kind === 'challenge' ? (
                      <>
                        <FieldGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <form.Field name="includesOverall">
                            {(field) => (
                              <CategorySelectionPill
                                id={`${id}-overall`}
                                name={
                                  categories.tracks.find(
                                    (track) => track.isOverall,
                                  )?.name ?? 'Overall'
                                }
                                checked={field.state.value}
                                disabled={pending}
                                onCheckedChange={(checked) => {
                                  field.handleChange(checked);
                                  clearErrors();
                                }}
                              />
                            )}
                          </form.Field>
                          <form.Field name="trackIds">
                            {(field) => (
                              <>
                                {trackOptions.map((track) => (
                                  <CategorySelectionPill
                                    key={track.id}
                                    id={`${id}-${track.id}`}
                                    name={track.name}
                                    checked={field.state.value.includes(
                                      track.trackId!,
                                    )}
                                    disabled={pending}
                                    onCheckedChange={(checked) => {
                                      field.handleChange(
                                        checked
                                          ? [
                                              ...field.state.value,
                                              track.trackId!,
                                            ]
                                          : field.state.value.filter(
                                              (trackId) =>
                                                trackId !== track.trackId,
                                            ),
                                      );
                                      clearErrors();
                                    }}
                                  />
                                ))}
                              </>
                            )}
                          </form.Field>
                        </FieldGroup>
                        <FieldError>
                          {fieldErrors.trackIds?.[0] ??
                            (!validMembership
                              ? 'Choose at least one track.'
                              : undefined)}
                        </FieldError>
                      </>
                    ) : (
                      <>
                        <form.Field name="challengeIds">
                          {(field) => (
                            <FieldGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {challengeOptions.map((challenge) => (
                                <CategorySelectionPill
                                  key={challenge.id}
                                  id={`${id}-${challenge.id}`}
                                  name={challenge.name}
                                  checked={field.state.value.includes(
                                    challenge.challengeId!,
                                  )}
                                  disabled={pending}
                                  onCheckedChange={(checked) => {
                                    field.handleChange(
                                      checked
                                        ? [
                                            ...field.state.value,
                                            challenge.challengeId!,
                                          ]
                                        : field.state.value.filter(
                                            (challengeId) =>
                                              challengeId !==
                                              challenge.challengeId,
                                          ),
                                    );
                                    clearErrors();
                                  }}
                                />
                              ))}
                            </FieldGroup>
                          )}
                        </form.Field>
                        <FieldError>{fieldErrors.challengeIds?.[0]}</FieldError>
                      </>
                    )}
                  </FieldSet>
                </FormPanel>
              </FormTabs>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </DialogBody>
          <DialogFooter className="shrink-0 sm:justify-between sm:px-10 sm:py-4">
            <div className="flex gap-2">
              {!editing && screen !== 'details' && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    setScreen(screen === 'membership' ? 'method' : 'details')
                  }
                >
                  <RiArrowLeftLine data-icon="inline-start" />
                  Back
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={requestClose}
              >
                Cancel
              </Button>
            </div>
            {editing || isLastScreen ? (
              <LoadingButton
                type="submit"
                loading={pending}
                disabled={
                  !validDetails ||
                  !validMethod ||
                  !validMembership ||
                  locked ||
                  (editing && !dirty)
                }
              >
                {editing ? 'Save changes' : `Create ${kind}`}
              </LoadingButton>
            ) : (
              <Button
                type="submit"
                disabled={!canContinue || pending || locked}
              >
                Next
                <RiArrowRightLine data-icon="inline-end" />
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormTabs({
  editing,
  screen,
  onScreenChange,
  children,
}: {
  editing: boolean;
  screen: Screen;
  onScreenChange: (screen: Screen) => void;
  children: ReactNode;
}) {
  return editing ? (
    <Tabs
      value={screen}
      onValueChange={(value) => onScreenChange(value as Screen)}
      className="gap-6"
    >
      {children}
    </Tabs>
  ) : (
    <>{children}</>
  );
}

function FormPanel({
  editing,
  screen,
  value,
  children,
}: {
  editing: boolean;
  screen: Screen;
  value: Screen;
  children: ReactNode;
}) {
  return editing ? (
    <TabsContent value={value}>{children}</TabsContent>
  ) : screen === value ? (
    <>{children}</>
  ) : null;
}
