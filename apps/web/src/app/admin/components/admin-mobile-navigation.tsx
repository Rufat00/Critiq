'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RiHome5Line } from '@remixicon/react';
import { cn } from '@/lib/utils';

type NavigationItem = {
  label: string;
  href: string | null;
  icon: typeof RiHome5Line;
  disabledReason: string;
};

const tabClassName =
  'relative flex min-h-16 w-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[10px] min-[375px]:text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring disabled:opacity-45';
const activeTabClassName =
  'text-primary before:absolute before:inset-x-2 before:top-0 before:h-0.5 before:rounded-b-full before:bg-primary';

export function AdminMobileNavigation({
  items,
  lockReason,
}: {
  items: NavigationItem[];
  lockReason?: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string | null) =>
    href !== null &&
    (pathname === href ||
      (href !== '/admin' && pathname.startsWith(`${href}/`)));

  return (
    <nav
      aria-label="Mobile admin navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex items-stretch px-2">
        {items.map(({ label, href, icon: Icon, disabledReason }) => (
          <li key={label} className="min-w-0 flex-1">
            {href ? (
              <Link
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={cn(
                  tabClassName,
                  isActive(href) && activeTabClassName,
                )}
              >
                <Icon className="size-6" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title={disabledReason}
                aria-label={`${label}. ${disabledReason}`}
                className={tabClassName}
              >
                <Icon className="size-6" aria-hidden="true" />
                <span>{label}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {lockReason && <p className="sr-only">{lockReason}</p>}
    </nav>
  );
}
