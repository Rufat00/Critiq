export const rubricColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function RubricWeightDonut({
  items,
}: {
  items: { id: string; name: string; weight: number }[];
}) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let offset = 0;
  const segments = items.map((item, index) => {
    const start = offset;
    const percent = Math.max(0, Math.min(item.weight, 100 - offset));
    offset += percent;
    return (
      <circle
        key={item.id}
        cx="60"
        cy="60"
        r="48"
        fill="none"
        strokeWidth="12"
        pathLength="100"
        strokeDasharray={`${percent} ${100 - percent}`}
        strokeDashoffset={-start}
        transform="rotate(-90 60 60)"
        stroke={rubricColors[index % rubricColors.length]}
      >
        <title>
          {item.name || `Item ${index + 1}`}: {item.weight}%
        </title>
      </circle>
    );
  });
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Rubric allocation: ${total}% of 100%. ${items.map((item, index) => `${item.name || `Item ${index + 1}`}: ${item.weight}%`).join(', ')}`}
      className="size-40 shrink-0 sm:size-48"
    >
      <circle
        cx="60"
        cy="60"
        r="48"
        fill="none"
        strokeWidth="12"
        className="stroke-muted"
      />
      {segments}
      <text
        x="60"
        y="56"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-foreground text-xl font-semibold"
      >
        {total}%
      </text>
      <text
        x="60"
        y="75"
        textAnchor="middle"
        className="fill-muted-foreground text-[9px]"
      >
        of 100%
      </text>
    </svg>
  );
}
