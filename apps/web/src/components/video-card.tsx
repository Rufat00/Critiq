import { RiExternalLinkLine } from '@remixicon/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { GuideVideo } from '@/lib/constants/videos';

export function VideoCard({ video }: { video: GuideVideo }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0 md:p-0">
        <iframe
          className="aspect-video w-full border-0 bg-muted"
          src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
          title={video.title}
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </CardContent>
      <CardHeader className="pb-2 md:pb-2">
        <CardTitle>{video.title}</CardTitle>
        <CardDescription>{video.description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild variant="link" size="sm" className="px-0">
          <a href={video.url} target="_blank" rel="noopener noreferrer">
            Watch on YouTube <RiExternalLinkLine data-icon="inline-end" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
