'use client';

import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>We couldn’t load your workspace</AlertTitle>
      <AlertDescription>
        Your saved setup is still there. Please try again.
        <div className="mt-4">
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
