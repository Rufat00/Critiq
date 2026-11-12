'use client';
import { useCallback, useEffect, useState } from 'react';
import { RiDoorOpenLine, RiPencilLine } from '@remixicon/react';
import type { RoomDetail, RoomsOverview } from '@critiq/core/rooms';
import { getRoomAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { ProjectLocationPreview } from './project-location-preview';
import { RoomDeleteDialog } from './room-delete-dialog';
export function RoomExpandedPanel({
  roomId,
  locked,
  revision,
  tracks,
  onEdit,
  onDeleted,
}: {
  roomId: string;
  locked: boolean;
  revision: number;
  tracks: RoomsOverview['tracks'];
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [room, setRoom] = useState<RoomDetail | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getRoomAction({ roomId });
      if (result.ok) setRoom(result.data);
      else setError(result.error.message);
    } catch {
      setError('The room layout couldn’t be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [roomId]);
  useEffect(() => {
    void load();
  }, [load, revision]);
  return (
    <section
      className="flex min-w-0 flex-col gap-5 whitespace-normal p-2 sm:p-4"
      aria-label="Room layout"
      aria-busy={loading}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {room && (
            <>
              <Badge>{room.projects.length} projects</Badge>
              <Badge>
                {room.trackRooms.filter((link) => link.capacity > 0).length}{' '}
                tracks
              </Badge>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={locked || loading}
            onClick={onEdit}
          >
            <RiPencilLine data-icon="inline-start" />
            Edit
          </Button>
          {room && (
            <RoomDeleteDialog
              roomId={roomId}
              name={room.name}
              locked={locked || loading}
              onDeleted={onDeleted}
            />
          )}
        </div>
      </header>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => void load()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {loading && !room && (
        <div
          className="flex flex-col gap-3"
          role="status"
          aria-label="Loading room layout"
        >
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
      {room &&
        (room.trackRooms.some((link) => link.capacity > 0) ? (
          <ProjectLocationPreview room={room} tracks={tracks} />
        ) : (
          <EmptyState
            icon={<RiDoorOpenLine />}
            title="No spots configured"
            description="Edit this room to set the number of spots for each track."
          />
        ))}
    </section>
  );
}
