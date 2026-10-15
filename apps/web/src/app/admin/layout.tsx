import { Suspense, type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/auth-context';
import { getAdminHome } from './queries';
import { AdminShell } from './components/admin-shell';
import { AdminShellSkeleton } from './components/admin-shell-skeleton';

async function AdminWorkspace({ children }: { children: ReactNode }) {
  const session = await getAuthContext();
  if (!session) redirect('/');
  if (!session.isAdmin()) redirect('/judging');
  const summary = await getAdminHome();
  return (
    <AdminShell summary={summary} userName={session.user.name}>
      {children}
    </AdminShell>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <AdminWorkspace>{children}</AdminWorkspace>
    </Suspense>
  );
}
