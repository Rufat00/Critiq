'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  RiHome5Line,
  RiHome5Fill,
  RiFolderLine,
  RiGroupLine,
  RiFlagLine,
  RiBarChartLine,
  RiTrophyLine,
  RiHistoryLine,
  RiSettings3Line,
  RiLayoutGridLine,
  RiMapPinLine,
} from '@remixicon/react';
import type { HackathonSetupSummary } from '@critiq/core/hackathon';
import { Logo } from '@/components/logo';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { getStageNavigation } from '../lib/stage-navigation';
import { AdminFrame } from './admin-frame';
import { SidebarSetupChecklist } from '../(Home)/components/sidebar-setup-checklist';

const icons = {
  Home: RiHome5Line,
  Projects: RiFolderLine,
  Judges: RiGroupLine,
  Results: RiTrophyLine,
  Analytics: RiBarChartLine,
  Flags: RiFlagLine,
  Activity: RiHistoryLine,
};

function AdminNavigation({
  summary,
  userName,
}: {
  summary: HackathonSetupSummary;
  userName: string;
}) {
  const navigation = getStageNavigation(summary.status);
  const pathname = usePathname();
  const initials =
    userName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join('')
      .toUpperCase() || 'U';
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false);
  return (
    <Sidebar>
      <SidebarHeader className="px-6 pt-7 pb-6">
        <Link href="/admin" aria-label="Critiq home" onClick={close}>
          <Logo className="h-8" />
        </Link>
        <p
          className="mt-3 line-clamp-2 break-words text-lg leading-snug font-semibold text-foreground"
          title={summary.name ?? 'Your hackathon'}
        >
          {summary.name ?? 'Your hackathon'}
        </p>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <SidebarGroup>
          <SidebarMenu>
            {navigation.main.map((label) => {
              const Icon =
                label === 'Home'
                  ? RiHome5Fill
                  : icons[label as keyof typeof icons];
              const href =
                label === 'Home'
                  ? '/admin'
                  : label === 'Projects'
                    ? '/admin/projects'
                    : label === 'Judges'
                      ? '/admin/judges'
                      : null;
              return (
                <SidebarMenuItem key={label}>
                  {href ? (
                    <SidebarMenuButton
                      asChild
                      size="lg"
                      isActive={pathname === href}
                    >
                      <Link href={href} onClick={close}>
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      size="lg"
                      disabled
                      title={`${label} is coming soon.`}
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
          {summary.status !== 'DRAFT' && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Additional event pages are coming soon.
            </p>
          )}
        </SidebarGroup>
        {navigation.configuration && (
          <SidebarGroup>
            <SidebarMenu>
              {[
                {
                  label: 'Categories',
                  href: '/admin/categories',
                  icon: RiLayoutGridLine,
                },
                {
                  label: 'Rooms',
                  href: '/admin/rooms',
                  icon: RiMapPinLine,
                },
                {
                  label: 'Settings',
                  href: '/admin/settings',
                  icon: RiSettings3Line,
                },
              ].map(({ label, href, icon: Icon }) => (
                <SidebarMenuItem key={label}>
                  {!navigation.configurationLocked ? (
                    <SidebarMenuButton
                      asChild
                      size="lg"
                      isActive={pathname === href}
                    >
                      <Link href={href} onClick={close}>
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      size="lg"
                      disabled
                      title={navigation.lockReason}
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            {navigation.configurationLocked && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {navigation.lockReason}
              </p>
            )}
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="gap-4 px-3 pb-6">
        {summary.status === 'DRAFT' && (
          <SidebarSetupChecklist
            completeCount={summary.completeCount}
            totalCount={summary.totalCount}
            progress={summary.progress}
            onContinue={close}
          />
        )}
        <section
          aria-label="Your account"
          className="flex flex-col gap-3 rounded-2xl border bg-card p-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar aria-hidden="true">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <p
              className="truncate text-sm font-medium text-foreground"
              title={userName}
            >
              {userName}
            </p>
          </div>
          <SignOutButton variant="secondary" size="sm" />
        </section>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminShell({
  summary,
  userName,
  children,
}: {
  summary: HackathonSetupSummary;
  userName: string;
  children: ReactNode;
}) {
  return (
    <AdminFrame
      navigation={<AdminNavigation summary={summary} userName={userName} />}
    >
      {children}
    </AdminFrame>
  );
}
