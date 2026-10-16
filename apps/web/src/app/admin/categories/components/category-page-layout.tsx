import { RiBookOpenLine } from '@remixicon/react';
import { AdminHeading } from '@/components/admin-heading';
import { InfoCard } from '@/components/info-card';
import { VideoCard } from '@/components/video-card';
import { videos } from '@/lib/constants/videos';
import type { ReactNode } from 'react';

export function CategoryPageLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminHeading
        title="Judging Categories"
        description="Manage tracks and challenges. Challenges can be part of multiple tracks and are judged independently from track awards."
      />
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">{children}</div>
        <aside className="flex flex-col gap-4" aria-label="Category guidance">
          <InfoCard
            title="How tracks & challenges work"
            icon={<RiBookOpenLine />}
          >
            <ul className="flex list-disc flex-col gap-3 pl-4">
              <li>
                A track groups projects into a separate competition with its own
                awards and dedicated judges. Judges are not shared across
                tracks.
              </li>
              <li>Projects in specialized tracks are excluded from Overall.</li>
              <li>
                A challenge is an optional competition for a specific theme,
                goal, or sponsor prize, with its own judging method and winners.
              </li>
              <li>
                A challenge can span multiple tracks, so projects from different
                tracks can compete for the same challenge award.
              </li>
            </ul>
          </InfoCard>
          <VideoCard video={videos.categories} />
        </aside>
      </div>
    </>
  );
}
