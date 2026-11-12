'use client';
import { useState, type ReactElement, type HTMLAttributes } from 'react';
import type { RoomDetail, RoomsOverview } from '@critiq/core/rooms';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTrackColor } from '../lib/get-track-color';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ProjectLocationPreview({
  room,
  tracks,
}: {
  room: RoomDetail;
  tracks: RoomsOverview['tracks'];
}) {
  const [page, setPage] = useState(0);
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(room.projects.length / 100) - 1),
  );
  const projects = room.projects.slice(current * 100, (current + 1) * 100);
  return (
    <TooltipProvider>
      <section className="flex flex-col gap-4" aria-label="Project locations">
        <div className="flex flex-wrap gap-2">
          {room.trackRooms
            .filter((link) => link.capacity > 0)
            .map((link) => (
              <Badge
                key={link.trackId}
                variant="default"
                style={{
                  backgroundColor: `color-mix(in srgb, ${getTrackColor(link.trackId, tracks)} 18%, var(--background))`,
                  borderColor: getTrackColor(link.trackId, tracks),
                }}
              >
                {link.track.category.name}:{' '}
                {
                  room.projects.filter(
                    (project) => project.trackId === link.trackId,
                  ).length
                }{' '}
                / {link.capacity} spots
              </Badge>
            ))}
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {projects.map((project) => (
            <ProjectTooltip
              key={project.id}
              hint={`${project.name} · ${project.track.category.name}`}
              label={`Project ${project.tableNumber}: ${project.name}, ${project.track.category.name}`}
            >
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="border"
                style={{
                  backgroundColor: `color-mix(in srgb, ${getTrackColor(project.trackId, tracks)} 18%, var(--background))`,
                  borderColor: getTrackColor(project.trackId, tracks),
                }}
              >
                {project.tableNumber}
              </Button>
            </ProjectTooltip>
          ))}
        </div>
        {!room.projects.length && (
          <p className="text-sm text-muted-foreground">
            No projects are assigned to this room yet.
          </p>
        )}
        {room.projects.length > 100 && (
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous projects
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={(current + 1) * 100 >= room.projects.length}
              onClick={() => setPage(current + 1)}
            >
              Next projects
            </Button>
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}

function ProjectTooltip({
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
