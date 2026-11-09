'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import { RiArrowLeftLine, RiArrowRightLine } from '@remixicon/react';
import { toast } from 'sonner';
import type { RoomEditorData } from '@critiq/core/rooms';
import type { AppFieldErrors } from '@critiq/core/errors';
import {
  getRoomEditorAction,
  createRoomAction,
  updateRoomAction,
} from '../actions';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button, LoadingButton } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useUnsavedGuard,
  useUnsavedGuardContext,
} from '@/components/ui/unsaved-guard';
import { cn } from '@/lib/utils';
import { RoomRangesForm } from './room-ranges-form';

export function RoomFormDialog({
  roomId,
  locked,
  onClose,
  onSaved,
}: {
  roomId?: string;
  locked: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [data, setData] = useState<RoomEditorData | null>(null),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false),
    [attempt, setAttempt] = useState(0);
  const guard = useUnsavedGuardContext();
  useEffect(() => {
    let live = true;
    setError('');
    void getRoomEditorAction({ roomId })
      .then((result) => {
        if (!live) return;
        if (result.ok) setData(result.data);
        else setError(result.error.message);
      })
      .catch(() => {
        if (live)
          setError('The room form couldn’t be loaded. Please try again.');
      });
    return () => {
      live = false;
    };
  }, [roomId, attempt]);
  function close() {
    if (!pending)
      void guard.confirmNavigation().then((leave) => {
        if (leave) onClose();
      });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="flex h-[min(38rem,calc(100dvh-2rem))] flex-col overflow-hidden sm:max-w-5xl"
        aria-describedby={undefined}
        showCloseButton={!pending}
        onEscapeKeyDown={(e) => {
          if (pending) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        {data ? (
          <RoomConfigurationForm
            data={data}
            locked={locked || data.locked}
            onClose={close}
            onSaved={onSaved}
            onPendingChange={setPending}
          />
        ) : (
          <DialogBody className="flex flex-col gap-6 pt-14 sm:px-10">
            <DialogTitle>{roomId ? 'Edit room' : 'Add room'}</DialogTitle>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {error}
                  <Button
                    variant="secondary"
                    onClick={() => setAttempt((n) => n + 1)}
                  >
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <div
                className="flex flex-col gap-4"
                role="status"
                aria-label="Loading room form"
              >
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            )}
          </DialogBody>
        )}
      </DialogContent>
    </Dialog>
  );
}
function RoomConfigurationForm({
  data,
  locked,
  onClose,
  onSaved,
  onPendingChange,
}: {
  data: RoomEditorData;
  locked: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const id = useId(),
    router = useRouter(),
    heading = useRef<HTMLHeadingElement>(null);
  const [screen, setScreen] = useState<'details' | 'ranges'>('details'),
    [draft, setDraft] = useState(false),
    [error, setError] = useState(''),
    [errors, setErrors] = useState<AppFieldErrors>({});
  const editing = !!data.room;
  const initial = {
    name: data.room?.name ?? '',
    description: data.room?.description ?? '',
    isActive: data.room?.isActive ?? true,
    tracks:
      data.room?.trackRooms.map((link) => ({
        trackId: link.trackId,
        ranges: link.tableRanges,
      })) ?? [],
  };
  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      if (locked || draft) return;
      setError('');
      setErrors({});
      onPendingChange(true);
      try {
        const result = data.room
          ? await updateRoomAction({ ...value, roomId: data.room.id })
          : await createRoomAction(value);
        if (!result.ok) {
          setError(result.error.message);
          setErrors(result.error.fieldErrors ?? {});
          setScreen(
            Object.keys(result.error.fieldErrors ?? {}).some((key) =>
              key.startsWith('tracks'),
            )
              ? 'ranges'
              : 'details',
          );
          toast.error('Room couldn’t be saved.');
          return;
        }
        form.reset(value);
        toast.success(editing ? 'Room changes saved.' : 'Room created.');
        onSaved(result.data.id);
        router.refresh();
      } catch {
        setError(
          'Couldn’t connect. Your changes are still here. Please try again.',
        );
      } finally {
        onPendingChange(false);
      }
    },
  });
  const values = useStore(form.store, (s) => s.values),
    pending = useStore(form.store, (s) => s.isSubmitting);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useUnsavedGuard({ when: dirty || draft });
  function changeScreen(next: 'details' | 'ranges') {
    setScreen(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!editing && screen === 'details') changeScreen('ranges');
        else void form.handleSubmit();
      }}
    >
      <DialogBody
        className={cn(
          'flex min-h-0 flex-1 flex-col pt-14 sm:px-10 sm:pt-14',
          editing ? 'overflow-hidden' : 'overflow-y-auto',
        )}
      >
        <div
          className={cn(
            'flex w-full flex-col gap-6',
            editing ? 'min-h-0 flex-1' : 'my-auto shrink-0',
            !editing && screen === 'details' && 'mx-auto max-w-2xl',
          )}
        >
          <DialogTitle
            ref={heading}
            tabIndex={-1}
            className={cn('outline-none', editing && 'sr-only')}
          >
            {editing
              ? 'Edit room'
              : screen === 'details'
                ? 'Name your room'
                : 'Set up table ranges'}
          </DialogTitle>
          <RoomFormPanels
            editing={editing}
            screen={screen}
            onScreenChange={setScreen}
          >
            {editing && (
              <TabsList className="shrink-0" aria-label="Edit room">
                <TabsTrigger value="details" disabled={pending}>
                  Details
                </TabsTrigger>
                <TabsTrigger value="ranges" disabled={pending}>
                  Table ranges
                </TabsTrigger>
              </TabsList>
            )}
            <RoomFormPanel editing={editing} screen={screen} value="details">
              <FieldGroup>
                <form.Field name="name">
                  {(field) => (
                    <Field data-invalid={!!errors.name}>
                      <FieldLabel htmlFor={`${id}-name`}>Room name</FieldLabel>
                      <Input
                        id={`${id}-name`}
                        required
                        maxLength={100}
                        value={field.state.value}
                        disabled={locked || pending}
                        aria-invalid={!!errors.name}
                        aria-describedby={`${id}-name-error`}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                          setErrors({});
                        }}
                      />
                      <FieldError id={`${id}-name-error`}>
                        {errors.name?.[0]}
                      </FieldError>
                    </Field>
                  )}
                </form.Field>
                <form.Field name="description">
                  {(field) => (
                    <Field data-invalid={!!errors.description}>
                      <FieldLabel htmlFor={`${id}-description`}>
                        Description{' '}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </FieldLabel>
                      <Textarea
                        id={`${id}-description`}
                        rows={3}
                        maxLength={2000}
                        value={field.state.value}
                        disabled={locked || pending}
                        aria-invalid={!!errors.description}
                        aria-describedby={`${id}-description-error`}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                          setErrors({});
                        }}
                      />
                      <FieldError id={`${id}-description-error`}>
                        {errors.description?.[0]}
                      </FieldError>
                    </Field>
                  )}
                </form.Field>
                {editing && (
                  <form.Field name="isActive">
                    {(field) => (
                      <Field orientation="horizontal">
                        <div className="flex flex-1 flex-col gap-1">
                          <FieldLabel htmlFor={`${id}-active`}>
                            Active room
                          </FieldLabel>
                          <FieldDescription>
                            Available as a judging location.
                          </FieldDescription>
                        </div>
                        <Switch
                          id={`${id}-active`}
                          checked={field.state.value}
                          disabled={locked || pending}
                          onCheckedChange={field.handleChange}
                        />
                      </Field>
                    )}
                  </form.Field>
                )}
              </FieldGroup>
            </RoomFormPanel>
            <RoomFormPanel editing={editing} screen={screen} value="ranges">
              <form.Field name="tracks">
                {(field) => (
                  <RoomRangesForm
                    value={field.state.value}
                    onChange={(next) => {
                      field.handleChange(next);
                      setErrors({});
                    }}
                    options={data.tracks}
                    disabled={locked || pending}
                    errors={errors}
                    onDraftChange={setDraft}
                  />
                )}
              </form.Field>
            </RoomFormPanel>
          </RoomFormPanels>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </DialogBody>
      <DialogFooter className="shrink-0 sm:justify-between sm:px-10 sm:py-4">
        <div className="flex gap-2">
          {!editing && screen === 'ranges' && (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => changeScreen('details')}
            >
              <RiArrowLeftLine data-icon="inline-start" />
              Back
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
        {!editing && screen === 'details' ? (
          <Button
            type="submit"
            disabled={locked || pending || !values.name.trim()}
          >
            Next
            <RiArrowRightLine data-icon="inline-end" />
          </Button>
        ) : (
          <LoadingButton
            type="submit"
            loading={pending}
            disabled={
              locked || draft || !values.name.trim() || (editing && !dirty)
            }
          >
            {editing ? 'Save changes' : 'Create room'}
          </LoadingButton>
        )}
      </DialogFooter>
    </form>
  );
}

function RoomFormPanels({
  editing,
  screen,
  onScreenChange,
  children,
}: {
  editing: boolean;
  screen: 'details' | 'ranges';
  onScreenChange: (screen: 'details' | 'ranges') => void;
  children: ReactNode;
}) {
  return editing ? (
    <Tabs
      value={screen}
      onValueChange={(value) => onScreenChange(value as 'details' | 'ranges')}
      className="min-h-0 flex-1 gap-6"
    >
      {children}
    </Tabs>
  ) : (
    <>{children}</>
  );
}
function RoomFormPanel({
  editing,
  screen,
  value,
  children,
}: {
  editing: boolean;
  screen: 'details' | 'ranges';
  value: 'details' | 'ranges';
  children: ReactNode;
}) {
  return editing ? (
    <TabsContent
      value={value}
      forceMount
      className="min-h-0 overflow-y-auto overscroll-contain pb-1 data-[state=inactive]:hidden"
    >
      {children}
    </TabsContent>
  ) : (
    <div className={cn(screen !== value && 'hidden')}>{children}</div>
  );
}
