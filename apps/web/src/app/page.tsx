import { AppPage } from '@/components/app-page';
import { Logo } from '@/components/logo';

export default function HomePage() {
  return (
    <AppPage>
      <header className="space-y-2">
        <h1>
          <Logo className="h-9 md:h-10" />
        </h1>
        <p className="text-base text-muted-foreground">
          Hackathon judging software.
        </p>
      </header>
    </AppPage>
  );
}
