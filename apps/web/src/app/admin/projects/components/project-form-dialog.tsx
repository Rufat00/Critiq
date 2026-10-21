'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import type { JudgingCategories } from '@critiq/core/categories';
import type { ProjectList } from '@critiq/core/projects';
import { RiArrowLeftLine, RiArrowRightLine } from '@remixicon/react';
import { Button, LoadingButton } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';
import { useUnsavedGuard } from '@/components/ui/unsaved-guard';
import { CategorySelectionPill } from '../../categories/components/category-selection-pill';
import { createProjectAction, updateProjectAction } from '../actions';

type Project = ProjectList['items'][number];
export function ProjectFormDialog({
  categories,
  project,
  mode = 'edit',
  locked,
  defaultTrackId,
  children,
}: {
  categories: JudgingCategories;
  project?: Project;
  mode?: 'edit' | 'move';
  locked: boolean;
  defaultTrackId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<'details' | 'membership'>('details');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Partial<Record<string, string[]>>>({});
  const busy = useRef(false),
    id = useId(),
    router = useRouter();
  const moving = Boolean(project && mode === 'move');
  const form = useForm({
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      submissionUrl: project?.submissionUrl ?? '',
      repositoryUrl: project?.repositoryUrl ?? '',
      demoUrl: project?.demoUrl ?? '',
      trackId: project?.trackId ?? defaultTrackId,
      challengeIds:
        project?.challenges.map((c) => c.challengeId) ?? ([] as string[]),
    },
    onSubmit: async ({ value }) => {
      if (busy.current || locked) return;
      if (!project && screen === 'details') {
        setScreen('membership');
        return;
      }
      busy.current = true;
      setError('');
      setErrors({});
      try {
        const result = project
          ? await updateProjectAction({ ...value, projectId: project.id })
          : await createProjectAction(value);
        if (!result.ok) {
          setErrors(result.error.fieldErrors ?? {});
          setError(result.error.message);
          if (
            Object.keys(result.error.fieldErrors ?? {}).some(
              (k) => !['trackId', 'challengeIds'].includes(k),
            )
          )
            setScreen('details');
          toast.error(result.error.message);
          return;
        }
        setOpen(false);
        form.reset();
        toast.success(
          moving
            ? `${value.name} moved. Location cleared for reassignment.`
            : `${value.name} ${project ? 'updated' : 'added'}.`,
        );
        router.refresh();
      } catch {
        setError(
          'Unable to save. Your changes are still here. Please try again.',
        );
      } finally {
        busy.current = false;
      }
    },
  });
  const pending = useStore(form.store, (s) => s.isSubmitting),
    dirty = useStore(form.store, (s) => !s.isDefaultValue),
    values = useStore(form.store, (s) => s.values);
  const guard = useUnsavedGuard({ when: open && dirty });
  function close() {
    if (!pending && !busy.current)
      void guard(() => {
        setOpen(false);
        form.reset();
        setError('');
        setErrors({});
        setScreen('details');
      });
  }
  const selected = categories.tracks.find((t) => t.trackId === values.trackId);
  const eligible = categories.challenges.filter(
    (c) => c.challengeId && selected && c.trackIds.includes(selected.id),
  );
  const details = !moving && screen === 'details';
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(`${id}-${screen === 'details' ? 'name' : 'track'}`)
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, screen, id]);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          form.reset();
          setScreen(moving ? 'membership' : 'details');
          setErrors({});
          setError('');
          setOpen(true);
        } else close();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="max-w-2xl"
        aria-describedby={undefined}
        showCloseButton={!pending}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {moving
                ? `Move ${project?.name}`
                : project
                  ? 'Edit project'
                  : 'Add project'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Tabs
              value={screen}
              onValueChange={(value) => {
                if (!pending) setScreen(value as typeof screen);
              }}
              className="gap-6"
            >
              {project && !moving && (
                <TabsList aria-label="Project details">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="membership">
                    Track & challenges
                  </TabsTrigger>
                </TabsList>
              )}
              {!project && (
                <p className="text-sm text-muted-foreground">
                  Step{' '}
                  {details
                    ? '1 of 2 · Project details'
                    : '2 of 2 · Track & challenges'}
                </p>
              )}
              <TabsContent value={screen}>
                {details ? (
                  <FieldGroup>
                    {(
                      [
                        'name',
                        'description',
                        'submissionUrl',
                        'repositoryUrl',
                        'demoUrl',
                      ] as const
                    ).map((name) => (
                      <form.Field key={name} name={name}>
                        {(field) => {
                          const label = {
                            name: 'Project title',
                            description: 'About the project',
                            submissionUrl: 'Submission URL',
                            repositoryUrl: 'GitHub repository URL',
                            demoUrl: 'Video demo URL',
                          }[name];
                          const props = {
                            id: `${id}-${name}`,
                            name: field.name,
                            value: field.state.value,
                            disabled: pending,
                            required: name === 'name',
                            maxLength:
                              name === 'description'
                                ? 20000
                                : name === 'name'
                                  ? 200
                                  : 2000,
                            onBlur: field.handleBlur,
                            onChange: (
                              event: React.ChangeEvent<
                                HTMLInputElement | HTMLTextAreaElement
                              >,
                            ) => {
                              field.handleChange(event.target.value);
                              setErrors((e) => ({ ...e, [name]: undefined }));
                              setError('');
                            },
                            'aria-invalid': Boolean(errors[name]?.length),
                            'aria-describedby': `${id}-${name}-error`,
                          };
                          return (
                            <Field
                              data-disabled={pending}
                              data-invalid={Boolean(errors[name]?.length)}
                            >
                              <FieldLabel htmlFor={`${id}-${name}`}>
                                {label}
                                {name !== 'name' && ' (optional)'}
                              </FieldLabel>
                              {name === 'description' ? (
                                <Textarea {...props} rows={4} />
                              ) : (
                                <Input
                                  {...props}
                                  type={name === 'name' ? 'text' : 'url'}
                                />
                              )}
                              <FieldError id={`${id}-${name}-error`}>
                                {errors[name]?.[0]}
                              </FieldError>
                            </Field>
                          );
                        }}
                      </form.Field>
                    ))}
                  </FieldGroup>
                ) : (
                  <FieldGroup>
                    <form.Field name="trackId">
                      {(field) => (
                        <Field data-invalid={Boolean(errors.trackId?.length)}>
                          <FieldLabel htmlFor={`${id}-track`}>Track</FieldLabel>
                          <Select
                            value={field.state.value}
                            disabled={pending}
                            onValueChange={(value) => {
                              const trackId = value;
                              field.handleChange(trackId);
                              const track = categories.tracks.find(
                                (t) => t.trackId === trackId,
                              );
                              form.setFieldValue(
                                'challengeIds',
                                values.challengeIds.filter((challengeId) =>
                                  categories.challenges.some(
                                    (c) =>
                                      c.challengeId === challengeId &&
                                      track &&
                                      c.trackIds.includes(track.id),
                                  ),
                                ),
                              );
                              setErrors({});
                              setError('');
                            }}
                          >
                            <SelectTrigger
                              id={`${id}-track`}
                              aria-invalid={Boolean(errors.trackId?.length)}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {categories.tracks.map((track) => (
                                  <SelectItem
                                    key={track.id}
                                    value={track.trackId}
                                  >
                                    {track.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FieldError>{errors.trackId?.[0]}</FieldError>
                        </Field>
                      )}
                    </form.Field>
                    <p className="text-sm text-muted-foreground">
                      Projects in specialized tracks are excluded from Overall.
                    </p>
                    {project && values.trackId !== project.trackId && (
                      <Alert>
                        <AlertDescription>
                          Moving a project clears its room and table. Challenges
                          unavailable in the new track are removed. Review the
                          selection below before saving.
                        </AlertDescription>
                      </Alert>
                    )}
                    <FieldSet disabled={pending}>
                      <FieldLegend variant="label">
                        Opt-in challenges
                      </FieldLegend>
                      <form.Field name="challengeIds">
                        {(field) => (
                          <FieldGroup className="grid gap-3 sm:grid-cols-2">
                            {eligible.map((challenge) => (
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
                                          (value) =>
                                            value !== challenge.challengeId,
                                        ),
                                  );
                                  setErrors({});
                                  setError('');
                                }}
                              />
                            ))}
                          </FieldGroup>
                        )}
                      </form.Field>
                      {!eligible.length && (
                        <p className="text-sm text-muted-foreground">
                          No challenges are available for this track.
                        </p>
                      )}
                      <FieldError>{errors.challengeIds?.[0]}</FieldError>
                    </FieldSet>
                  </FieldGroup>
                )}
              </TabsContent>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </Tabs>
          </DialogBody>
          <DialogFooter className="sm:justify-between">
            <div className="flex gap-2">
              {!project && !details && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setScreen('details')}
                >
                  <RiArrowLeftLine data-icon="inline-start" />
                  Back
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={close}
              >
                Cancel
              </Button>
            </div>
            <LoadingButton
              type="submit"
              loading={pending}
              disabled={
                locked ||
                !values.name.trim() ||
                (Boolean(project) && !dirty) ||
                (moving && values.trackId === project?.trackId)
              }
            >
              {!project && details ? (
                <>
                  Next
                  <RiArrowRightLine data-icon="inline-end" />
                </>
              ) : moving ? (
                'Move project'
              ) : project ? (
                'Save changes'
              ) : (
                'Add project'
              )}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
