'use client';
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react';
import type { ProjectList } from '@critiq/core/projects';
import { Button } from '@/components/ui/button';

export function ProjectPagination({
  pagination,
  disabled,
  onNavigate,
}: {
  pagination: ProjectList['pagination'];
  disabled: boolean;
  onNavigate: (changes: Record<string, string>) => void;
}) {
  const { page, totalItems, totalPages, hasPreviousPage, hasNextPage } =
    pagination;
  return (
    <nav
      aria-label="Project pagination"
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
