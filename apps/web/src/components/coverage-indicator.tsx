import { Progress } from '@/components/ui/progress';

export function CoverageIndicator({
  completed,
  target,
}: {
  completed: number;
  target: number;
}) {
  const value =
    target > 0 ? Math.min(100, Math.max(0, (completed / target) * 100)) : 0;
  const label = `${completed} of ${target} target evaluations complete`;

  return (
    <div className="min-w-28 space-y-2">
      <span className="text-xs tabular-nums text-muted-foreground">
        {label}
      </span>
      <Progress value={value} aria-label={label} />
    </div>
  );
}
