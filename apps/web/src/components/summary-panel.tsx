import type { ReactNode } from 'react';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export function SummaryPanel({
  title,
  metric,
  subtitle,
  progress,
  className,
}: {
  title: string;
  metric: ReactNode;
  subtitle?: string;
  progress?: { value: number; label: string };
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-card px-6 py-7 text-center',
        className,
      )}
      aria-label={title}
    >
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-foreground">
        {metric}
      </p>
      {subtitle && (
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      )}
      {progress && (
        <div className="mx-auto mt-5 max-w-sm space-y-2">
          <Progress value={progress.value} aria-label={progress.label} />
          <p className="text-xs text-muted-foreground">{progress.label}</p>
        </div>
      )}
    </section>
  );
}
