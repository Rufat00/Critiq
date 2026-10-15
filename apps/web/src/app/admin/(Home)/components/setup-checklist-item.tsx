'use client';

import Link from 'next/link';
import {
  RiCalendarCheckLine,
  RiLayoutGridLine,
  RiFolderLine,
  RiGroupLine,
  RiMapPinLine,
  RiCheckLine,
  RiArrowRightLine,
  RiArrowGoBackLine,
} from '@remixicon/react';
import type { HackathonSetupSummary } from '@critiq/core/hackathon';
import { Button, LoadingButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type SetupChecklistItemProps = {
  item: HackathonSetupSummary['sections'][number];
  index: number;
  pending: boolean;
  saving: boolean;
  onCompletionChange: (
    item: HackathonSetupSummary['sections'][number],
    completed: boolean,
  ) => void;
};

const icons = {
  event: RiCalendarCheckLine,
  categories: RiLayoutGridLine,
  projects: RiFolderLine,
  judges: RiGroupLine,
  rooms: RiMapPinLine,
};

export function SetupChecklistItem({
  item,
  index,
  pending,
  saving,
  onCompletionChange,
}: SetupChecklistItemProps) {
  const Icon = icons[item.id];
  return (
    <li
      id={item.id}
      className="flex scroll-mt-8 flex-wrap items-center gap-4 border-b py-5 last:border-b-0"
    >
      <div className="flex min-w-0 flex-[1_1_15rem] items-start gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm tabular-nums text-muted-foreground">
          {index + 1}
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="font-medium">
            <Link
              href={item.href}
              className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.title}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2 pl-13 sm:pl-0">
        <span
          className="mr-1 flex items-center gap-2 text-muted-foreground"
          aria-label={
            item.count !== null
              ? `${item.count} ${item.title.toLowerCase()}`
              : item.title
          }
        >
          <Icon className="size-5" aria-hidden="true" />
          {item.count !== null && (
            <span className="text-sm tabular-nums">{item.count}</span>
          )}
        </span>
        {item.done ? (
          <>
            <Badge
              variant="success"
              size="button"
              className="w-32 shrink-0 px-3 justify-center"
            >
              <RiCheckLine aria-hidden="true" />
              Done
            </Badge>
            {item.id !== 'event' && (
              <LoadingButton
                variant="ghost"
                size="sm"
                loading={saving}
                disabled={pending}
                onClick={() => onCompletionChange(item, false)}
                aria-label={`Undo ${item.title.toLowerCase()} completion`}
                title="Undo completion"
              >
                <RiArrowGoBackLine data-icon="inline-start" />
                <span className="sr-only">Undo</span>
              </LoadingButton>
            )}
          </>
        ) : (
          <>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="w-32 shrink-0 px-3"
            >
              <Link href={item.href}>
                {item.id === 'projects'
                  ? 'Add'
                  : item.id === 'judges'
                    ? 'Invite'
                    : item.id === 'categories'
                      ? 'Create'
                      : item.canComplete
                        ? 'Finish setup'
                        : 'Set up'}
                <RiArrowRightLine data-icon="inline-end" />
              </Link>
            </Button>
            {item.canComplete && (
              <LoadingButton
                variant="soft"
                size="sm"
                className="w-32 shrink-0 px-3"
                loading={saving}
                disabled={pending}
                onClick={() => onCompletionChange(item, true)}
              >
                Mark as done
              </LoadingButton>
            )}
          </>
        )}
      </div>
    </li>
  );
}
