import { AppPage } from '@/components/app-page';

export default function HomePage() {
  return (
    <AppPage>
      <header className="space-y-2">
        <h1 className="text-[28px] font-semibold tracking-[-0.025em] md:text-[32px]">
          Critiq
        </h1>
        <p className="text-base text-muted-foreground">
          Hackathon judging software.
        </p>
      </header>
    </AppPage>
  );
}
