import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { Spinner } from '@/components/ui/spinner';

export default function Loading() {
  return (
    <AuthPageShell name="Critiq">
      <div role="status" className="flex items-center justify-center gap-3">
        <Spinner />
        <span>Loading your invitation…</span>
      </div>
    </AuthPageShell>
  );
}
