'use client';
import { useRef, useState, useTransition, useEffect } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import { RiQrCodeLine, RiMailSendLine, RiFileCopyLine } from '@remixicon/react';
import { Input } from '@/components/ui/input';
import { ActionTile } from '@/components/action-tile';
import { Spinner } from '@/components/ui/spinner';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from '@/components/ui/field';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/sonner';
import { useUnsavedGuard } from '@/components/ui/unsaved-guard';
import { inviteJudgeAction, revokeJudgeInvitationAction } from '../actions';
import { InvitationQrCode } from './invitation-qr-code';

type Invitation = { id: string; url: string | null; expiresAt: string };

export function InviteControls({
  categoryId,
  trackName,
  emailEnabled,
  disabled,
}: {
  categoryId: string;
  trackName: string;
  emailEnabled: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [emailOpen, setEmailOpen] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const [expired, setExpired] = useState(false);
  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      if (!emailEnabled || disabled || busy.current) return;
      busy.current = true;
      setError('');
      try {
        const result = await inviteJudgeAction({
          categoryId,
          email: value.email.trim().toLowerCase(),
        });
        if (!result.ok) {
          const message = result.error.fieldErrors?.email?.[0];
          if (message)
            form.setFieldMeta('email', (meta) => ({
              ...meta,
              errorMap: { ...meta.errorMap, onServer: { message } },
            }));
          setError(result.error.message);
          return;
        }
        toast.success(
          `Invitation sent to ${value.email.trim()}. It expires in 24 hours.`,
        );
        form.reset();
        setEmailOpen(false);
        router.refresh();
      } catch {
        setError('Unable to connect. Please try again.');
      } finally {
        busy.current = false;
      }
    },
  });
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const dirty = useStore(form.store, (state) => state.isDirty);
  const guardEmailClose = useUnsavedGuard({
    when: emailOpen && dirty && emailEnabled,
    description:
      'Your invitation email has not been sent. Leaving will discard it.',
  });
  useEffect(() => {
    setExpired(false);
    if (!invitation) return;
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, new Date(invitation.expiresAt).getTime() - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [invitation]);
  function generate() {
    if (busy.current) return;
    busy.current = true;
    setError('');
    startTransition(async () => {
      try {
        const result = await inviteJudgeAction({ categoryId });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setInvitation(result.data);
        setCopied(false);
        router.refresh();
      } catch {
        setError('Unable to connect. Please try again.');
      } finally {
        busy.current = false;
      }
    });
  }
  function revoke() {
    if (!invitation || busy.current) return;
    busy.current = true;
    setError('');
    startTransition(async () => {
      try {
        const result = await revokeJudgeInvitationAction({
          invitationId: invitation.id,
        });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setInvitation(null);
        toast.success('Invitation revoked.');
        router.refresh();
      } catch {
        setError('Unable to connect. Please try again.');
      } finally {
        busy.current = false;
      }
    });
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
        <Dialog
          open={emailOpen}
          onOpenChange={(open) => {
            if (open) {
              setError('');
              setEmailOpen(true);
              return;
            }
            if (submitting || busy.current) return;
            void guardEmailClose(() => {
              form.reset();
              setError('');
              setEmailOpen(false);
            });
          }}
        >
          <DialogTrigger asChild>
            <ActionTile
              icon={<RiMailSendLine />}
              disabled={!emailEnabled || disabled || pending || submitting}
              aria-describedby={
                !emailEnabled ? 'judge-email-disabled' : undefined
              }
            >
              Invite by email
            </ActionTile>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <DialogHeader>
                <DialogTitle>
                  Invite a judge by email to {trackName}
                </DialogTitle>
              </DialogHeader>
              <DialogBody>
                <FieldGroup>
                  <form.Field
                    name="email"
                    validators={{
                      onSubmit: ({ value }) =>
                        /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim())
                          ? undefined
                          : { message: 'Enter a valid email address.' },
                    }}
                  >
                    {(field) => (
                      <Field
                        data-disabled={disabled || submitting}
                        data-invalid={!field.state.meta.isValid}
                      >
                        <FieldLabel htmlFor="judge-invite-email">
                          Email address
                        </FieldLabel>
                        <Input
                          id="judge-invite-email"
                          type="email"
                          maxLength={254}
                          placeholder="judge@example.com"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            field.handleChange(event.target.value);
                            form.setFieldMeta('email', (meta) => ({
                              ...meta,
                              errorMap: {
                                ...meta.errorMap,
                                onServer: undefined,
                              },
                            }));
                            setError('');
                          }}
                          disabled={
                            !emailEnabled || disabled || submitting || pending
                          }
                          aria-invalid={!field.state.meta.isValid}
                          aria-describedby="judge-email-error"
                        />
                        <FieldError
                          id="judge-email-error"
                          errors={field.state.meta.errors}
                        />
                      </Field>
                    )}
                  </form.Field>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </FieldGroup>
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => {
                    if (!busy.current)
                      void guardEmailClose(() => {
                        form.reset();
                        setError('');
                        setEmailOpen(false);
                      });
                  }}
                >
                  Cancel
                </Button>
                <LoadingButton
                  type="submit"
                  loading={submitting}
                  disabled={!emailEnabled || disabled || pending}
                >
                  <RiMailSendLine data-icon="inline-start" />
                  Send invite
                </LoadingButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <ActionTile
          icon={pending && !invitation ? <Spinner /> : <RiQrCodeLine />}
          disabled={disabled || submitting || pending}
          aria-busy={pending && !invitation}
          onClick={generate}
        >
          {pending && !invitation
            ? 'Preparing QR invitation…'
            : 'Invite by QR code'}
        </ActionTile>
      </div>
      {!emailEnabled && (
        <p id="judge-email-disabled" className="text-sm text-muted-foreground">
          Email invitations are disabled in no-email mode. Use a QR invitation.
        </p>
      )}
      {error && !invitation && !emailOpen && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Dialog
        open={invitation !== null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setInvitation(null);
            setError('');
          }
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Invite a judge to {trackName}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4">
              {expired && (
                <Alert>
                  <AlertDescription>
                    This invitation has expired. Generate a new one to continue.
                  </AlertDescription>
                </Alert>
              )}
              {invitation?.url && !expired && (
                <InvitationQrCode
                  key={invitation.id}
                  url={invitation.url}
                  trackName={trackName}
                />
              )}
              {expired && (
                <LoadingButton
                  loading={pending}
                  disabled={disabled}
                  onClick={generate}
                >
                  Generate new QR invitation
                </LoadingButton>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                variant="secondary"
                disabled={pending || expired}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invitation?.url ?? '');
                    setCopied(true);
                  } catch {
                    setError(
                      'Copy failed. Please check clipboard permissions and try again.',
                    );
                  }
                }}
              >
                <RiFileCopyLine data-icon="inline-start" />
                {copied ? 'Link copied' : 'Copy invitation link'}
              </Button>
              <span role="status" className="sr-only">
                {copied ? 'Invitation link copied.' : ''}
              </span>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setInvitation(null)}
            >
              Close
            </Button>
            <LoadingButton
              variant="destructive"
              loading={pending}
              onClick={revoke}
            >
              Revoke invitation
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
