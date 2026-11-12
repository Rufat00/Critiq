'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Collapsible } from 'radix-ui';
import {
  RiAddLine,
  RiArrowRightSLine,
  RiArrowLeftSLine,
  RiDoorOpenLine,
} from '@remixicon/react';
import type { RoomsPageData } from '../queries';
import { AdminHeading } from '@/components/admin-heading';
import { EmptyState } from '@/components/empty-state';
import { SearchForm } from '@/components/search-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { RoomFormDialog } from './room-form-dialog';
import { RoomExpandedPanel } from './room-expanded-panel';
import { getTrackColor } from '../lib/get-track-color';
import { ExportRoomsButton } from './export-rooms-button';

export function RoomsSection({ data }: { data: RoomsPageData }) {
  const router = useRouter(),
    [pending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null),
    [editor, setEditor] = useState<{ roomId?: string } | null>(null),
    [revision, setRevision] = useState(0);
  const { pagination: p } = data;
  function navigate(changes: Record<string, string>, replace = false) {
    const params = new URLSearchParams({
      search: data.search,
      page: String(p.page),
      ...changes,
    });
    startTransition(() => {
      const href = `/admin/rooms?${params}`;
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    });
  }
  return (
    <>
      <AdminHeading
        title="Rooms"
        description="Manage judging locations and project locations."
      />
      {data.locked && (
        <Alert>
          <AlertDescription>
            Room setup is locked. Return the hackathon to draft to change rooms
            or track access.
          </AlertDescription>
        </Alert>
      )}
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ['Rooms', data.summary.rooms],
            ['Projects placed', data.summary.placed],
            ['Unassigned projects', data.summary.unassigned],
          ] as const
        ).map(([label, count]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 sm:flex-col sm:items-start sm:gap-2"
          >
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>
      <section
        className="flex min-w-0 flex-col gap-4"
        aria-label="Rooms overview"
        aria-busy={pending}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchForm
            id="rooms-search"
            label="Search rooms"
            placeholder="Search rooms by name…"
            initialSearch={data.search}
            pending={pending}
            onSearch={(search) => navigate({ search, page: '1' }, true)}
            className="flex-1 sm:max-w-sm"
          />
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <ExportRoomsButton search={data.search} disabled={pending} />
            <Button
              className="shrink-0"
              disabled={data.locked || pending}
              onClick={() => setEditor({})}
            >
              <RiAddLine data-icon="inline-start" />
              Add room
            </Button>
          </div>
        </div>
        {!data.items.length ? (
          <EmptyState
            icon={<RiDoorOpenLine />}
            title={
              data.search
                ? 'No matching rooms'
                : p.totalItems
                  ? 'No rooms on this page'
                  : 'No rooms yet'
            }
            description={
              data.search
                ? 'Try another room name or clear your search.'
                : p.totalItems
                  ? 'Go back to the first page to see your rooms.'
                  : 'Add your first judging location and set spots for each track.'
            }
            action={
              data.search || p.page > 1 ? (
                <Button
                  variant="secondary"
                  onClick={() => navigate({ search: '', page: '1' })}
                >
                  Show all rooms
                </Button>
              ) : (
                <Button disabled={data.locked} onClick={() => setEditor({})}>
                  Add room
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table className="block md:table">
              <TableHeader className="hidden md:table-header-group">
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Tracks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Expand room</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              {data.items.map((room) => (
                <Collapsible.Root
                  key={room.id}
                  asChild
                  open={expandedId === room.id}
                  onOpenChange={(open) => setExpandedId(open ? room.id : null)}
                >
                  <TableBody className="block border-b border-border last:border-0 md:table-row-group">
                    <TableRow className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 p-3 md:table-row md:p-0">
                      <TableCell className="col-start-1 row-start-1 h-auto min-w-0 px-0 md:h-16 md:max-w-80 md:px-3">
                        <button
                          type="button"
                          className="text-left font-medium break-words whitespace-normal hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-ring"
                          aria-expanded={expandedId === room.id}
                          onClick={() =>
                            setExpandedId((current) =>
                              current === room.id ? null : room.id,
                            )
                          }
                        >
                          {room.name}
                        </button>
                        {room.description && (
                          <p className="mt-1 line-clamp-2 whitespace-normal text-muted-foreground">
                            {room.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="col-start-1 row-start-2 h-auto px-0 tabular-nums md:h-16 md:px-3">
                        <span className="md:hidden">Projects: </span>
                        {room._count.projects}
                      </TableCell>
                      <TableCell className="col-span-2 row-start-3 h-auto px-0 md:h-16 md:max-w-72 md:px-3">
                        {room.trackRooms.some((link) => link.capacity > 0) ? (
                          <div className="flex flex-wrap gap-1.5">
                            {room.trackRooms
                              .filter((link) => link.capacity > 0)
                              .map((link) => (
                                <Badge
                                  key={link.trackId}
                                  style={{
                                    backgroundColor: `color-mix(in srgb, ${getTrackColor(link.trackId, data.tracks)} 18%, var(--background))`,
                                    borderColor: getTrackColor(
                                      link.trackId,
                                      data.tracks,
                                    ),
                                  }}
                                >
                                  {link.track.category.name} · {link.capacity}{' '}
                                  spots
                                  {!link.isActive && ' · Inactive'}
                                </Badge>
                              ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            No tracks
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="col-start-2 row-start-2 h-auto px-0 md:h-16 md:px-3">
                        <Badge variant={room.isActive ? 'success' : 'default'}>
                          {room.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="col-start-2 row-start-1 h-auto px-0 md:h-16 md:px-3">
                        <Collapsible.Trigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${expandedId === room.id ? 'Collapse' : 'Expand'} ${room.name}`}
                          >
                            <RiArrowRightSLine
                              className={cn(
                                'transition-transform',
                                expandedId === room.id && 'rotate-90',
                              )}
                            />
                          </Button>
                        </Collapsible.Trigger>
                      </TableCell>
                    </TableRow>
                    <Collapsible.Content asChild>
                      <TableRow className="block md:table-row">
                        <TableCell
                          colSpan={5}
                          className="block h-auto p-3 md:table-cell"
                        >
                          <RoomExpandedPanel
                            roomId={room.id}
                            locked={data.locked || pending}
                            revision={revision}
                            tracks={data.tracks}
                            onEdit={() => setEditor({ roomId: room.id })}
                            onDeleted={() => {
                              setExpandedId(null);
                              setRevision((value) => value + 1);
                              if (data.items.length === 1 && p.page > 1)
                                navigate({ page: String(p.page - 1) });
                              else router.refresh();
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    </Collapsible.Content>
                  </TableBody>
                </Collapsible.Root>
              ))}
            </Table>
          </div>
        )}
        <nav
          className="flex flex-wrap items-center justify-between gap-3"
          aria-label="Room pagination"
        >
          <p className="text-sm text-muted-foreground">
            {p.totalItems} {p.totalItems === 1 ? 'room' : 'rooms'} · Page{' '}
            {p.page} of {p.totalPages || 1}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Previous page"
              disabled={pending || !p.hasPreviousPage}
              onClick={() => navigate({ page: String(p.page - 1) })}
            >
              <RiArrowLeftSLine />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Next page"
              disabled={pending || !p.hasNextPage}
              onClick={() => navigate({ page: String(p.page + 1) })}
            >
              <RiArrowRightSLine />
            </Button>
          </div>
        </nav>
      </section>
      {editor && (
        <RoomFormDialog
          roomId={editor.roomId}
          locked={data.locked}
          onClose={() => setEditor(null)}
          onSaved={(id) => {
            setEditor(null);
            setExpandedId(id);
            setRevision((n) => n + 1);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
