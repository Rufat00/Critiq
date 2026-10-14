'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { RiArrowLeftLine, RiMailLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';

type CodeOutcome = { ok: boolean; error?: string };

export function VerificationCodeForm({
  email,
  onVerify,
  onResend,
  onBack,
}: {
  email: string;
  onVerify(code: string): Promise<CodeOutcome>;
  onResend(): Promise<CodeOutcome>;
  onBack(): void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [error, setError] = useState<string>();
  const [resending, setResending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(
    () => Date.now() + 60_000,
  );
  const [resendSeconds, setResendSeconds] = useState(60);
  const form = useForm({
    defaultValues: { code: '' },
    onSubmit: async ({ value }) => {
      if (!/^\d{6}$/.test(value.code)) return;
      setError(undefined);
      try {
        const result = await onVerify(value.code);
        if (!result.ok) {
          setError(result.error || 'Please try again.');
          form.setFieldValue('code', '');
        }
      } catch {
        setError('Unable to connect. Please try again.');
        form.setFieldValue('code', '');
      }
    },
  });
  const verifying = useStore(form.store, (state) => state.isSubmitting);
  const pending = verifying || resending;

  useEffect(() => {
    const remaining = () =>
      Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
    setResendSeconds(remaining());
    const timer = setInterval(() => {
      const seconds = remaining();
      setResendSeconds(seconds);
      if (seconds === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAvailableAt]);

  // The input is enabled before restoring focus after a failed check or resend.
  useEffect(() => {
    if (pending) return;
    const frame = requestAnimationFrame(() =>
      inputRef.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [pending]);

  async function verify(completedCode: string) {
    if (inFlight.current || form.state.isSubmitting || resending) return;
    inFlight.current = true;
    form.setFieldValue('code', completedCode);
    try {
      await form.handleSubmit();
    } catch {
      form.reset();
      setError('We could not check your code. Please try again.');
    } finally {
      inFlight.current = false;
    }
  }

  async function resend() {
    if (inFlight.current || pending || Date.now() < resendAvailableAt) return;
    inFlight.current = true;
    setResending(true);
    setError(undefined);
    try {
      const result = await onResend();
      if (!result.ok) setError(result.error || 'Please try again.');
      else {
        setResendSeconds(60);
        setResendAvailableAt(Date.now() + 60_000);
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      form.setFieldValue('code', '');
      setResending(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-7 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <RiMailLine aria-hidden className="size-5" />
      </div>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="text-base leading-6 text-muted-foreground">
          Enter the 6-digit code sent to{' '}
          <span className="break-all font-medium">{email}</span>
        </p>
      </header>
      <form
        autoComplete="off"
        className="w-full"
        onSubmit={(event) => {
          event.preventDefault();
          if (form.state.values.code.length === 6)
            void verify(form.state.values.code);
        }}
      >
        <FieldGroup>
          <form.Field name="code">
            {(field) => (
              <Field data-invalid={Boolean(error)} data-disabled={pending}>
                <FieldLabel htmlFor="verification-code" className="sr-only">
                  Verification code
                </FieldLabel>
                <InputOTP
                  ref={inputRef}
                  id="verification-code"
                  name={field.name}
                  autoFocus
                  maxLength={6}
                  value={field.state.value}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  pasteTransformer={(text) => text.replace(/\D/g, '')}
                  disabled={pending}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'code-error' : undefined}
                  containerClassName="max-w-full justify-center"
                  onBlur={field.handleBlur}
                  onChange={(value) => {
                    field.handleChange(value.replace(/\D/g, ''));
                    setError(undefined);
                  }}
                  onComplete={(value) => void verify(value)}
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2].map((index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        slotSize="lg"
                        aria-invalid={Boolean(error)}
                      />
                    ))}
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup className="gap-2">
                    {[3, 4, 5].map((index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        slotSize="lg"
                        aria-invalid={Boolean(error)}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </Field>
            )}
          </form.Field>
        </FieldGroup>
      </form>
      {verifying && <Spinner aria-label="Checking verification code" />}
      {error && <FieldError id="code-error">{error}</FieldError>}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onBack}
        >
          <RiArrowLeftLine data-icon="inline-start" />
          Go back
        </Button>
        <Button
          type="button"
          variant="link"
          ripple={false}
          disabled={pending || resendSeconds > 0}
          aria-label={
            resendSeconds > 0
              ? `Resend code available in ${resendSeconds} seconds`
              : 'Resend code'
          }
          onClick={() => void resend()}
        >
          {resending && <Spinner data-icon="inline-start" />}Resend code
          {resendSeconds > 0 && (
            <span role="timer" aria-live="off" className="tabular-nums">
              {Math.floor(resendSeconds / 60)}:
              {String(resendSeconds % 60).padStart(2, '0')}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
