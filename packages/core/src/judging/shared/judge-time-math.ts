export function calculateRemainingJudgeMinutes(
  availableMinutes: number,
  visits: {
    status: string;
    estimatedMinutes: number;
    createdAt: Date;
    finishedAt: Date | null;
  }[],
  stays: { travelMinutes: number }[],
  now: Date,
) {
  const used =
    visits.reduce((sum, v) => {
      const elapsed = Math.max(
        0,
        ((v.finishedAt ?? now).getTime() - v.createdAt.getTime()) / 60000,
      );
      return (
        sum +
        (v.status === 'COMPLETED'
          ? Math.max(v.estimatedMinutes, elapsed)
          : elapsed)
      );
    }, 0) + stays.slice(1).reduce((s, e) => s + e.travelMinutes, 0);
  return Math.max(0, availableMinutes - used);
}
