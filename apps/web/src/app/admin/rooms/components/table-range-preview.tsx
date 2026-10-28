'use client';
import { useState, type ReactElement, type HTMLAttributes } from 'react';
import type {
  RoomsOverview,
  RoomDetail,
  SetRoomTrackAccessInput,
} from '@critiq/core/rooms';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
const colors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];
export function TableRangePreview({
  tracks,
  options,
  projects,
  title = 'Table preview',
}: {
  tracks: SetRoomTrackAccessInput['tracks'];
  options: RoomsOverview['tracks'];
  projects?: RoomDetail['projects'];
  title?: string;
}) {
  const [page, setPage] = useState(0);
  const valid = tracks.map((track) => ({
    ...track,
    ranges: track.ranges.filter(
      (r) =>
        Number.isInteger(r.fromNumber) &&
        Number.isInteger(r.toNumber) &&
        r.fromNumber > 0 &&
        r.toNumber >= r.fromNumber &&
        r.toNumber <= 2147483647,
    ),
  }));
  const max = Math.max(
    24,
    ...valid.flatMap((t) => t.ranges.map((r) => r.toNumber)),
  );
  const current = Math.min(page, Math.floor((max - 1) / 100));
  const first = current * 100 + 1,
    last = Math.min(first + 99, max);
  return (
    <TooltipProvider>
      <section className="flex flex-col gap-3" aria-label="Table range preview">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          <span className="text-xs text-muted-foreground">
            Tables {first}–{last}
          </span>
        </header>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
          {Array.from({ length: last - first + 1 }, (_, i) => {
            const table = first + i;
            const matching = valid
              .map((t, index) => ({ ...t, index }))
              .filter((t) =>
                t.ranges.some(
                  (r) => r.fromNumber <= table && table <= r.toNumber,
                ),
              );
            const names = matching.map(
              (t) =>
                options.find((o) => o.id === t.trackId)?.category.name ??
                'Track',
            );
            const color = matching.length
              ? colors[matching[0]!.index % colors.length]
              : undefined;
            const background =
              matching.length > 1
                ? `linear-gradient(135deg, ${matching.map((t, index) => `color-mix(in srgb, ${colors[t.index % colors.length]} 18%, var(--background)) ${(index * 100) / matching.length}% ${((index + 1) * 100) / matching.length}%`).join(', ')})`
                : color
                  ? `color-mix(in srgb, ${color} 14%, var(--background))`
                  : undefined;
            const project = projects?.find(
              (item) => item.tableNumber === table,
            );
            const hint = project
              ? project.name
              : projects
                ? matching.length
                  ? 'Unassigned table'
                  : 'Not configured'
                : names.join(', ') || 'Not configured';
            return (
              <TableTooltip
                key={table}
                hint={hint}
                label={`Table ${table}: ${hint}`}
              >
                <button
                  type="button"
                  className={cn(
                    'flex h-9 min-w-0 items-center justify-center rounded-md border px-1 text-xs tabular-nums',
                    (!matching.length || (projects && !project)) &&
                      'border-dashed text-muted-foreground',
                  )}
                  style={{
                    background,
                    borderColor: color
                      ? `color-mix(in srgb, ${color} 35%, var(--border))`
                      : undefined,
                  }}
                >
                  <span className="truncate">
                    {table}
                    {matching.length > 1 ? '*' : ''}
                  </span>
                </button>
              </TableTooltip>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {valid.map((t, i) => (
            <span key={t.trackId} className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-sm"
                style={{ background: colors[i % colors.length] }}
              />
              {options.find((o) => o.id === t.trackId)?.category.name ??
                'Track'}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-dashed border-muted-foreground" />
            Not configured
          </span>
        </div>
        {valid.some((track, i) =>
          valid
            .slice(i + 1)
            .some((other) =>
              track.ranges.some((a) =>
                other.ranges.some(
                  (b) =>
                    a.fromNumber <= b.toNumber && b.fromNumber <= a.toNumber,
                ),
              ),
            ),
        ) && (
          <p className="text-xs text-muted-foreground">
            * Shared by multiple tracks.
          </p>
        )}
        {max > 100 && (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous tables
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={last >= max}
              onClick={() => setPage(current + 1)}
            >
              Next tables
            </Button>
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}

function TableTooltip({
  hint,
  label,
  children,
}: {
  hint: string;
  label: string;
  children: ReactElement<HTMLAttributes<HTMLButtonElement>>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        asChild
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="max-w-72 break-words">{hint}</TooltipContent>
    </Tooltip>
  );
}
