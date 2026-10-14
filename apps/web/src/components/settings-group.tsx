import type { ReactNode } from 'react';
import Link from 'next/link';
import { RiArrowRightSLine } from '@remixicon/react';

import { cn } from '@/lib/utils';

export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  icon,
  title,
  description,
  value,
  href,
  control,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  value?: string;
} & (
  | { href: string; control?: never }
  | { href?: never; control?: ReactNode }
)) {
  const contents = (
    <>
      <span
        className="shrink-0 text-muted-foreground [&_svg]:size-5"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      {control ??
        (href && (
          <RiArrowRightSLine
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        ))}
    </>
  );
  const rowClassName = cn(
    'flex min-h-16 items-center gap-4 px-5 py-4',
    href &&
      'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
  );

  if (href)
    return (
      <Link href={href} className={rowClassName}>
        {contents}
      </Link>
    );
  return <div className={rowClassName}>{contents}</div>;
}
