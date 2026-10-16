'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { RegistrationForm } from '@/components/auth/registration-form';
import { acceptInvitationAction } from './actions';

export function InvitationLanding({
  mode,
  name,
}: {
  mode: 'otp' | 'password';
  name: string;
}) {
  const token = useRef<string | undefined>(undefined);
  const started = useRef(false);
  const busy = useRef(false);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const [access, setAccess] = useState<{ email: string | null } | null>(null);

  async function loadInvitation() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const result = await acceptInvitationAction(token.current);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAccess({ email: result.email });
      token.current = undefined;
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fragmentToken = new URLSearchParams(
      window.location.hash.slice(1),
    ).get('token');
    if (fragmentToken !== null) token.current = fragmentToken;
    window.history.replaceState(window.history.state, '', '/invite');
    void loadInvitation();
  }, []);

  return (
    <AuthPageShell name={name}>
      {access ? (
        <RegistrationForm
          mode={mode}
          setup={false}
          invitedEmail={access.email}
        />
      ) : pending ? (
        <div role="status" className="flex items-center justify-center gap-3">
          <Spinner />
          <span>Checking your invitation…</span>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl font-semibold">Invitation unavailable</h1>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => void loadInvitation()}>Try again</Button>
          <Button asChild variant="secondary">
            <Link href="/">Back to sign in</Link>
          </Button>
        </div>
      )}
    </AuthPageShell>
  );
}
