import Link from 'next/link';

import { CoverageIndicator } from '@/components/coverage-indicator';

export function ResultRow({
  rank,
  project,
  team,
  href,
  score,
  completedEvaluations,
  targetEvaluations,
}: {
  rank: number;
  project: string;
  team: string;
  href: string;
  score: string;
  completedEvaluations: number;
  targetEvaluations: number;
}) {
  return (
    <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-4 border-b border-border/60 px-3 py-4 text-sm hover:bg-muted/60 md:grid-cols-[3rem_1fr_6rem_12rem] md:gap-6">
      <span
        className="tabular-nums text-muted-foreground"
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </span>
      <span className="min-w-0">
        <Link
          href={href}
          className="block truncate font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {project}
        </Link>
        <span className="block truncate text-muted-foreground">{team}</span>
      </span>
      <span
        className="text-right font-medium tabular-nums text-foreground"
        aria-label={`Score ${score}`}
      >
        {score}
      </span>
      <span className="col-start-2 col-span-2 md:col-auto">
        <CoverageIndicator
          completed={completedEvaluations}
          target={targetEvaluations}
        />
      </span>
    </div>
  );
}
