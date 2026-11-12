'use client';

import { useTransition } from 'react';
import { RiDownloadLine } from '@remixicon/react';
import { toast } from '@/components/ui/sonner';
import { LoadingButton } from '@/components/ui/button';
import { exportRoomProjectsAction } from '../actions';

export function ExportRoomsButton({
  search,
  disabled,
}: {
  search: string;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <LoadingButton
      variant="secondary"
      loading={pending}
      disabled={disabled}
      title={
        search
          ? 'Export projects in all matching rooms'
          : 'Export all projects and their room details'
      }
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await exportRoomProjectsAction({ search });
            if (!result.ok) {
              toast.error(result.error.message);
              return;
            }
            if (!result.data.projectCount) {
              toast.error('No projects to export.');
              return;
            }
            const url = URL.createObjectURL(
              new Blob([result.data.csv], { type: 'text/csv;charset=utf-8;' }),
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = 'room-projects.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast.success(
              `CSV download started with ${result.data.projectCount} ${result.data.projectCount === 1 ? 'project' : 'projects'}.`,
            );
          } catch {
            toast.error('Could not export projects. Please try again.');
          }
        })
      }
    >
      <RiDownloadLine data-icon="inline-start" />
      Export CSV
    </LoadingButton>
  );
}
