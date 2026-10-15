'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/auth-client';
import { LoadingButton, type ButtonProps } from '@/components/ui/button';
export function SignOutButton({
  variant = 'ghost',
  size,
}: Pick<ButtonProps, 'variant' | 'size'> = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <LoadingButton
        variant={variant}
        size={size}
        loading={pending}
        onClick={async () => {
          setPending(true);
          setError('');
          try {
            const result = await authClient.signOut();
            if (result.error) setError('Unable to sign out. Please try again.');
            else {
              router.replace('/');
              router.refresh();
            }
          } catch {
            setError('Unable to connect. Please try again.');
          } finally {
            setPending(false);
          }
        }}
      >
        Sign out
      </LoadingButton>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
