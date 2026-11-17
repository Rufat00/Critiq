'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RiRefreshLine } from '@remixicon/react';
import { LoadingButton } from '@/components/ui/button';

export function RefreshJudgingButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <LoadingButton
      variant="secondary"
      loading={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RiRefreshLine aria-hidden="true" data-icon="inline-start" />
      Refresh
    </LoadingButton>
  );
}
