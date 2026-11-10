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
import { getTableRangePreview } from '../lib/get-table-range-preview';
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
  const { total, current, offset, tables } = getTableRangePreview(valid, page);
  return (
    <TooltipProvider>
      <section className="flex flex-col gap-3" aria-label="Table range preview">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          <span className="text-xs text-muted-foreground">{total} tables</span>
        </header>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
          {tables.map(({ table, trackId, index }) => {
            const name =
              options.find((option) => option.id === trackId)?.category.name ??
              'Track';
            const color = colors[index % colors.length]!;
            const background = `color-mix(in srgb, ${color} 14%, var(--background))`;
            const project = projects?.find(
              (item) => item.tableNumber === table,
            );
            const hint = project
              ? project.name
              : projects
                ? 'Unassigned table'
                : name;
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
                    projects &&
                      !project &&
                      'border-dashed text-muted-foreground',
                  )}
                  style={{
                    background,
                    borderColor: color
                      ? `color-mix(in srgb, ${color} 35%, var(--border))`
                      : undefined,
                  }}
                >
                  <span className="truncate">{table}</span>
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
        </div>
        {total > 100 && (
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
              disabled={offset + tables.length >= total}
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
