'use client';
import { RiUserLine } from '@remixicon/react';
import type {
  JudgeList as JudgeListData,
  JudgeTracks,
} from '@critiq/core/judges';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { JudgeActions } from './judge-actions';

export function JudgeList({
  judges,
  tracks,
  categoryId,
  search,
  locked,
  pending,
  onReset,
}: {
  judges: JudgeListData;
  tracks: JudgeTracks;
  categoryId: string;
  search: string;
  locked: boolean;
  pending: boolean;
  onReset: () => void;
}) {
  return judges.items.length === 0 ? (
    <EmptyState
      icon={<RiUserLine />}
      title={
        search
          ? 'No matching judges'
          : judges.pagination.totalItems
            ? 'No judges on this page'
            : 'No judges in this track yet'
      }
      description={
        search
          ? 'Try a different name or email.'
          : 'Invite a judge by email or share an invitation link. They will appear here after registering.'
      }
      action={
        <Button variant="secondary" disabled={pending} onClick={onReset}>
          {search ? 'Clear search' : 'Refresh judges'}
        </Button>
      }
    />
  ) : (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {judges.items.map((judge) => (
              <TableRow key={judge.id}>
                <TableCell>{judge.name}</TableCell>
                <TableCell className="break-all">{judge.email}</TableCell>
                <TableCell className="text-right">
                  <JudgeActions
                    judge={judge}
                    tracks={tracks}
                    categoryId={categoryId}
                    disabled={locked || pending}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {judges.items.map((judge) => (
          <article
            key={judge.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border p-4"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="font-medium">{judge.name}</h3>
              <p className="break-all text-sm text-muted-foreground">
                {judge.email}
              </p>
            </div>
            <JudgeActions
              judge={judge}
              tracks={tracks}
              categoryId={categoryId}
              disabled={locked || pending}
            />
          </article>
        ))}
      </div>
    </>
  );
}
