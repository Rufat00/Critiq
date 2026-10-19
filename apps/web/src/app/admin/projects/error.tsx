'use client';
import { AdminHeading } from '@/components/admin-heading';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <>
      <AdminHeading title="Projects" />
      <Alert variant="destructive">
        <AlertTitle>Projects couldn’t be loaded</AlertTitle>
        <AlertDescription>
          Please try again to load your saved projects.
        </AlertDescription>
      </Alert>
      <div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </>
  );
}
