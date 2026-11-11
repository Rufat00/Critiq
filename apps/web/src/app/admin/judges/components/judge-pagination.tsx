'use client';
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react';
import type { JudgeList } from '@critiq/core/judges';
import { Button } from '@/components/ui/button';

export function JudgePagination({
  pagination,
  disabled,
  onNavigate,
}: {
  pagination: JudgeList['pagination'];
  disabled: boolean;
  onNavigate: (changes: Record<string, string>) => void;
}) {
  const { page, totalItems, totalPages, hasPreviousPage, hasNextPage } =
    pagination;
  return (
    <nav
      aria-label="Judge table pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground">
        {totalItems} {totalItems === 1 ? 'record' : 'records'} · Page {page} of{' '}
        {totalPages || 1}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Previous page"
          disabled={disabled || !hasPreviousPage}
          onClick={() => onNavigate({ page: String(page - 1) })}
        >
          <RiArrowLeftSLine />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Next page"
          disabled={disabled || !hasNextPage}
          onClick={() => onNavigate({ page: String(page + 1) })}
        >
          <RiArrowRightSLine />
        </Button>
      </div>
    </nav>
  );
}
