'use client';

import Link from 'next/link';
import type { HackathonSetupSummary } from '@critiq/core/hackathon';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

type SidebarSetupChecklistProps = Pick<
  HackathonSetupSummary,
  'completeCount' | 'totalCount' | 'progress'
> & {
  onContinue: () => void;
};

export function SidebarSetupChecklist({
  completeCount,
  totalCount,
  progress,
  onContinue,
}: SidebarSetupChecklistProps) {
  return (
    <section
      className="flex flex-col gap-3 rounded-2xl bg-muted p-3"
      aria-label="Setup reminder"
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        Your setup checklist
      </span>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {completeCount} of {totalCount} complete
        </span>
        <span>{progress}%</span>
      </div>
      <Progress value={progress} aria-label="Setup completion" />
      <Button asChild size="sm">
        <Link href="/admin#checklist" onClick={onContinue}>
          Continue setup
        </Link>
      </Button>
    </section>
  );
}
