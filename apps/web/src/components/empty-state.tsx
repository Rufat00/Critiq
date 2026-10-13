import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <span
        className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6"
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}
