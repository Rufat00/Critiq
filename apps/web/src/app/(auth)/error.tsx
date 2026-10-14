'use client';
import { Button } from '@/components/ui/button';
export default function EntryError({ reset }: { reset(): void }) {
  return (
    <main className="flex min-h-svh items-center justify-center px-5">
      <div className="max-w-md flex flex-col gap-5 text-center">
        <h1 className="text-3xl font-semibold">Unable to load this page</h1>
        <p className="text-muted-foreground">
          Please try again. If this continues, contact the hackathon organizer.
        </p>
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
