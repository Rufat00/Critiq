'use client';

import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <AuthPageShell name="Critiq">
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertTitle>Invitation couldn’t be loaded</AlertTitle>
          <AlertDescription>
            Please try again to open your invitation.
          </AlertDescription>
        </Alert>
        <Button onClick={reset}>Try again</Button>
      </div>
    </AuthPageShell>
  );
}
