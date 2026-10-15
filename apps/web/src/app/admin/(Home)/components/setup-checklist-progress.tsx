import type { HackathonSetupSummary } from '@critiq/core/hackathon';
import { Progress } from '@/components/ui/progress';

type SetupChecklistProgressProps = Pick<
  HackathonSetupSummary,
  'completeCount' | 'totalCount' | 'progress'
>;

export function SetupChecklistProgress({
  completeCount,
  totalCount,
  progress,
}: SetupChecklistProgressProps) {
  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="checklist-title" className="text-lg font-semibold">
          Your setup checklist
        </h2>
        <span className="text-sm tabular-nums text-muted-foreground">
          {completeCount} of {totalCount} complete · {progress}%
        </span>
      </div>
      <Progress value={progress} aria-label="Setup checklist completion" />
    </div>
  );
}
