'use client';

import { useRef, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import type { HackathonSettings } from '@critiq/core/hackathon';
import { AdminHeading } from '@/components/admin-heading';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button, LoadingButton } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FieldGroup, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/components/ui/sonner';
import { useUnsavedGuard } from '@/components/ui/unsaved-guard';
import { updateHackathonSettingsAction } from '../actions';
import { ResetDataActions } from './reset-data-actions';
import { SettingItem } from './setting-item';
import { FormatEventAction } from './format-event-action';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function SettingsForm({ settings }: { settings: HackathonSettings }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string[]>>
  >({});
  const locked = settings.status !== 'DRAFT';
  const form = useForm({
    defaultValues: {
      name: settings.name ?? '',
      scoreScale: settings.scoreScale as 5 | 10,
      roomSwitchPercent: settings.roomSwitchPercent,
    },
    onSubmit: async ({ value }) => {
      if (locked || submitting.current) return;
      submitting.current = true;
      clearErrors();
      try {
        const result = await updateHackathonSettingsAction(value);
        if (!result.ok) {
          setError(result.error.message);
          setFieldErrors(result.error.fieldErrors ?? {});
          toast.error(result.error.message);
          return;
        }
        const saved = result.data.settings;
        form.reset({
          name: saved.name ?? '',
          scoreScale: saved.scoreScale as 5 | 10,
          roomSwitchPercent: saved.roomSwitchPercent,
        });
        toast.success('Settings saved.');
        router.refresh();
      } catch {
        const message =
          'Unable to save settings. Your changes are still here. Please try again.';
        setError(message);
        toast.error(message);
      } finally {
        submitting.current = false;
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);
  useUnsavedGuard({ when: dirty });
  function clearErrors() {
    setError(undefined);
    setFieldErrors({});
  }
  const disabled = locked || pending;
  return (
    <>
      <AdminHeading title="Settings" />
      <Tabs defaultValue="overall">
        <TabsList aria-label="Settings">
          <TabsTrigger value="overall">Overall</TabsTrigger>
          {settings.canResetData && (
            <TabsTrigger value="danger">Danger zone</TabsTrigger>
          )}
        </TabsList>
        <TabsContent
          value="overall"
          forceMount
          className="flex flex-col gap-6 data-[state=inactive]:hidden"
        >
          {locked && (
            <Alert>
              <AlertTitle>Settings are read-only</AlertTitle>
              <AlertDescription>
                {settings.status === 'READY'
                  ? 'Return to draft from Home to change configuration.'
                  : 'Competition settings are locked after judging starts.'}
              </AlertDescription>
            </Alert>
          )}
          <form
            autoComplete="off"
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup className="gap-0">
              <form.Field name="name">
                {(field) => (
                  <SettingItem
                    title="Hackathon name"
                    description="The event name shown to organizers and judges."
                    htmlFor="hackathon-name"
                    descriptionId="hackathon-name-description"
                    invalid={Boolean(fieldErrors.name)}
                    disabled={disabled}
                  >
                    <Input
                      id="hackathon-name"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                        clearErrors();
                      }}
                      required
                      maxLength={100}
                      disabled={disabled}
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby="hackathon-name-description hackathon-name-error"
                    />
                    <FieldError id="hackathon-name-error">
                      {fieldErrors.name?.join(' ')}
                    </FieldError>
                  </SettingItem>
                )}
              </form.Field>
              <Separator />
              <form.Field name="scoreScale">
                {(field) => (
                  <SettingItem
                    title="Scoring system"
                    description="Choose the point scale judges use to score projects. A 5-point scale keeps scoring simple, while a 10-point scale gives judges more room to distinguish similar projects."
                    labelId="score-scale-label"
                    descriptionId="score-scale-description"
                    invalid={Boolean(fieldErrors.scoreScale)}
                    disabled={disabled}
                  >
                    <ToggleGroup
                      type="single"
                      value={String(field.state.value)}
                      onValueChange={(value) => {
                        if (!value) return;
                        field.handleChange(Number(value) as 5 | 10);
                        clearErrors();
                      }}
                      onBlur={field.handleBlur}
                      disabled={disabled}
                      aria-labelledby="score-scale-label"
                      aria-invalid={Boolean(fieldErrors.scoreScale)}
                      aria-describedby="score-scale-description score-scale-error"
                      className="grid-cols-2"
                    >
                      <ToggleGroupItem value="5">5-point scale</ToggleGroupItem>
                      <ToggleGroupItem value="10">
                        10-point scale
                      </ToggleGroupItem>
                    </ToggleGroup>
                    <FieldError id="score-scale-error">
                      {fieldErrors.scoreScale?.join(' ')}
                    </FieldError>
                  </SettingItem>
                )}
              </form.Field>
              <Separator />
              <form.Field name="roomSwitchPercent">
                {(field) => (
                  <SettingItem
                    title="When judges change rooms"
                    description={
                      <>
                        {field.state.value === 0
                          ? 'Judges stay in their current room and will not be moved to another room automatically.'
                          : field.state.value === 100
                            ? 'Automatically move judges to another room once they have judged all projects available to them in their current room.'
                            : `Automatically move judges to another room after they have judged ${field.state.value}% of the projects available to them in their current room.`}{' '}
                        Applies to all tracks.
                      </>
                    }
                    labelId="room-switch-label"
                    descriptionId="room-switch-description"
                    invalid={Boolean(fieldErrors.roomSwitchPercent)}
                    disabled={disabled}
                  >
                    <output
                      className="text-sm font-medium tabular-nums"
                      aria-live="polite"
                    >
                      {field.state.value === 0
                        ? 'Never'
                        : `${field.state.value}%`}
                    </output>
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[field.state.value]}
                      onValueChange={([value]) => {
                        if (value !== undefined) field.handleChange(value);
                        clearErrors();
                      }}
                      onBlur={field.handleBlur}
                      disabled={disabled}
                      thumbLabels={['When judges change rooms']}
                      aria-labelledby="room-switch-label"
                      aria-describedby="room-switch-description room-switch-error"
                      aria-invalid={Boolean(fieldErrors.roomSwitchPercent)}
                      showThumbValues
                      className="my-1"
                    />
                    <div
                      className="flex justify-between text-xs text-muted-foreground"
                      aria-hidden="true"
                    >
                      <span>Never · 0%</span>
                      <span>All · 100%</span>
                    </div>
                    <FieldError id="room-switch-error">
                      {fieldErrors.roomSwitchPercent?.join(' ')}
                    </FieldError>
                  </SettingItem>
                )}
              </form.Field>
            </FieldGroup>
            <Separator />
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Settings couldn’t be saved</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={disabled || !dirty}
                onClick={() => {
                  form.reset();
                  clearErrors();
                }}
              >
                Discard changes
              </Button>
              <LoadingButton
                type="submit"
                loading={pending}
                disabled={locked || !dirty}
              >
                Save changes
              </LoadingButton>
            </div>
          </form>
        </TabsContent>
        {settings.canResetData && (
          <TabsContent value="danger">
            {locked && (
              <p className="py-4 text-sm text-muted-foreground">
                Individual resets are available only in draft. Formatting
                permanently erases the entire event at any stage.
              </p>
            )}
            <ResetDataActions locked={locked || pending} unsaved={dirty} />
            <FormatEventAction
              eventName={settings.name ?? ''}
              disabled={pending || dirty}
            />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
