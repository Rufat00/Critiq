'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  RiHome5Line,
  RiFolderLine,
  RiGroupLine,
  RiFlagLine,
  RiBarChartLine,
  RiTrophyLine,
  RiHistoryLine,
  RiSettings3Line,
  RiLayoutGridLine,
  RiMapPinLine,
  RiArrowDownSLine,
} from '@remixicon/react';
import type { HackathonSetupSummary } from '@critiq/core/hackathon';
import { Logo } from '@/components/logo';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getStageNavigation } from '../lib/stage-navigation';
import { AdminFrame } from './admin-frame';

const mainItems = {
  Home: { icon: RiHome5Line, href: '/admin' },
  Projects: { icon: RiFolderLine, href: '/admin/projects' },
  Judges: { icon: RiGroupLine, href: '/admin/judges' },
  Results: { icon: RiTrophyLine, href: null },
  Analytics: { icon: RiBarChartLine, href: null },
  Flags: { icon: RiFlagLine, href: null },
  Activity: { icon: RiHistoryLine, href: null },
};

const configurationItems = [
  { label: 'Categories', href: '/admin/categories', icon: RiLayoutGridLine },
  { label: 'Rooms', href: '/admin/rooms', icon: RiMapPinLine },
  { label: 'Settings', href: '/admin/settings', icon: RiSettings3Line },
];

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
  const items = [
    ...navigation.main.map((label) => ({
      label,
      ...mainItems[label as keyof typeof mainItems],
      disabledReason: `${label} is coming soon.`,
    })),
    ...(navigation.configuration
      ? configurationItems.map((item) => ({
          ...item,
          href: navigation.configurationLocked ? null : item.href,
          disabledReason: navigation.lockReason,
        }))
      : []),
  ];

  return (
    <header className="mx-auto grid w-full max-w-[1440px] grid-cols-[1fr_auto] items-center gap-x-6 gap-y-5 px-5 pt-6 pb-2 md:px-10 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:py-6">
      <Link
        href="/admin"
        aria-label="Critiq home"
        className="flex min-w-0 w-fit flex-col items-start gap-1.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <Logo className="h-7 md:h-8" />
        <span
          className="w-full max-w-44 truncate text-sm font-medium text-muted-foreground xl:max-w-52"
          title={summary.name ?? 'Your hackathon'}
        >
          {summary.name ?? 'Your hackathon'}
        </span>
      </Link>
      <nav
        aria-label="Admin navigation"
        className="col-span-2 row-start-2 min-w-0 overflow-x-auto py-1 xl:col-span-1 xl:col-start-2 xl:row-start-1"
      >
        <ul className="mx-auto flex w-max items-center gap-1 rounded-full bg-muted p-1">
          {items.map(({ label, href, icon: Icon, disabledReason }) => {
            const active =
              href !== null &&
              (pathname === href ||
                (href !== '/admin' && pathname.startsWith(`${href}/`)));
            return (
              <li key={label}>
                {href ? (
                  <Button asChild variant={active ? 'default' : 'ghost'}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon aria-hidden="true" data-icon="inline-start" />
                      {label}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    disabled
                    title={disabledReason}
                    aria-label={`${label}. ${disabledReason}`}
                  >
                    <Icon aria-hidden="true" data-icon="inline-start" />
                    {label}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="col-start-2 row-start-1 min-w-0 justify-self-end xl:col-start-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              size="lg"
              aria-label={`Account for ${userName}`}
              className="max-w-full gap-2 pr-3 pl-1"
            >
              <Avatar size="lg" aria-hidden="true">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-32 truncate sm:block xl:max-w-24 2xl:max-w-40">
                {userName}
              </span>
              <RiArrowDownSLine aria-hidden="true" data-icon="inline-end" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={12}
            className="w-44 max-w-[calc(100vw-2.5rem)] p-2"
            aria-label="Your account"
          >
            <SignOutButton size="sm" />
          </PopoverContent>
        </Popover>
      </div>
      {navigation.configuration && navigation.configurationLocked && (
        <p className="col-span-full text-center text-xs text-muted-foreground">
          {navigation.lockReason}
        </p>
      )}
    </header>
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
