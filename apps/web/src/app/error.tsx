'use client';

import { AppPage } from '@/components/app-page';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <AppPage>
      <Alert variant="destructive">
        <AlertTitle>We couldn’t open your workspace</AlertTitle>
        <AlertDescription>
          Your saved configuration has not changed. Please try again.
          <div className="mt-4">
            <Button variant="secondary" onClick={reset}>
              Try again
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </AppPage>
  );
}
