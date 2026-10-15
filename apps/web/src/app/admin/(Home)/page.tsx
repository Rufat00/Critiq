import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { VideoCard } from '@/components/video-card';
import { videos } from '@/lib/constants/videos';
import { getAuthContext } from '@/lib/auth/auth-context';
import { SetupRequiredDialog } from './components/setup-required-dialog';
import { SetupChecklist } from './components/setup-checklist';
import { ReadinessActions } from './components/readiness-actions';
import { getAdminHome } from '../queries';
import { stageLabels } from '../lib/stage-navigation';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const [summary, params, session] = await Promise.all([
    getAdminHome(),
    searchParams,
    getAuthContext(),
  ]);
  const isDraft = summary.status === 'DRAFT';
  const isReady = summary.status === 'READY';
  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className="max-w-3xl text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
          {isDraft
            ? `Let’s prepare for ${summary.name ?? 'your hackathon'} Judging!`
            : isReady
              ? `${summary.name ?? 'Your hackathon'} is ready for judging`
              : `${summary.name ?? 'Your hackathon'} · ${stageLabels[summary.status]}`}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {isDraft
            ? 'Get the essentials in place, check your setup, and give your judges a smooth start.'
            : isReady
              ? 'Review your event summary below. Return to draft whenever you need to adjust your setup before judging starts.'
              : 'Your event configuration is locked. Operational monitoring and results will be available as those workflows are implemented.'}
        </p>
      </header>
      {!summary.name && (
        <SetupRequiredDialog isOwner={session?.isOwner() ?? false} />
      )}
      {summary.name && params.setup === 'complete' && (
        <Alert role="status">
          <AlertDescription>
            Your hackathon name is saved. Let’s prepare your judging setup.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] xl:gap-10">
        {isDraft ? (
          <div className="flex min-w-0 flex-col gap-6">
            <SetupChecklist summary={summary} />
            <ReadinessActions summary={summary} />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {isReady ? 'Final event summary' : 'Event summary'}
              </CardTitle>
              <CardDescription>
                Competition configuration · {summary.scoreScale}-point score
                scale
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {summary.categories.length ? (
                summary.categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex flex-col gap-1 rounded-xl bg-muted p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{category.name}</span>
                      <Badge>{category.enabled ? 'Enabled' : 'Disabled'}</Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {category.method === 'RUBRIC'
                        ? `Rubric · ${category.criteria} criteria`
                        : 'Relative judging'}{' '}
                      · {category.minEvaluations} minimum
                      {category.targetEvaluations
                        ? ` / ${category.targetEvaluations} target`
                        : ''}{' '}
                      evaluations · {category.timerSeconds}s timer
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No categories configured.
                </p>
              )}
            </CardContent>
          </Card>
        )}
        <aside id="guide" className="scroll-mt-6">
          <VideoCard video={videos.setup} />
        </aside>
      </div>
      {isReady && <ReadinessActions summary={summary} />}
    </>
  );
}
