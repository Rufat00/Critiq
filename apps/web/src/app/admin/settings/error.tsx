'use client';
import { AdminHeading } from '@/components/admin-heading';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <>
      <AdminHeading title="Settings" />
      <Alert variant="destructive">
        <AlertTitle>Settings couldn’t be loaded</AlertTitle>
        <AlertDescription>
          Please try again. Your saved settings have not changed.
        </AlertDescription>
      </Alert>
      <div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </>
  );
}
