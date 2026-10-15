'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  HackathonSetupSummary,
  SetupSection,
} from '@critiq/core/hackathon';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { setSetupCompletionAction } from '../actions';
import { SetupChecklistProgress } from './setup-checklist-progress';
import { SetupChecklistItem } from './setup-checklist-item';

export function SetupChecklist({
  summary,
}: {
  summary: HackathonSetupSummary;
}) {
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState('');
  const [pendingSection, setPendingSection] = useState<SetupSection>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function setCompletion(
    item: HackathonSetupSummary['sections'][number],
    completed: boolean,
  ) {
    setError(undefined);
    setPendingSection(item.id);
    startTransition(async () => {
      try {
        const result = await setSetupCompletionAction({
          section: item.id,
          fingerprint: item.fingerprint,
          completed,
        });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setMessage(
          `${item.title} ${completed ? 'marked as done' : 'completion undone'}.`,
        );
        router.refresh();
      } catch {
        setError('Your checklist could not be saved. Please try again.');
      }
    });
  }

  return (
    <section
      id="checklist"
      aria-labelledby="checklist-title"
      className="scroll-mt-6"
    >
      <SetupChecklistProgress
        completeCount={summary.completeCount}
        totalCount={summary.totalCount}
        progress={summary.progress}
      />
      <p className="sr-only" role="status">
        {message}
      </p>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ol className="flex flex-col">
        {summary.sections.map((item, index) => (
          <SetupChecklistItem
            key={item.id}
            item={item}
            index={index}
            pending={pending}
            saving={pending && pendingSection === item.id}
            onCompletionChange={setCompletion}
          />
        ))}
      </ol>
    </section>
  );
}
