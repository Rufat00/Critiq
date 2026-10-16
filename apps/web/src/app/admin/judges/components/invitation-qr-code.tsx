'use client';

import { useEffect, useRef, useState } from 'react';
import {
  judgeQrInvitationMinutes,
  judgeQrInvitationMaxUses,
} from '@critiq/constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function InvitationQrCode({
  url,
  trackName,
}: {
  url: string;
  trackName: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    void (async () => {
      try {
        const { default: QRCode } = await import('qrcode');
        if (cancelled || !canvas.current) return;
        await QRCode.toCanvas(canvas.current, url, {
          width: 320,
          margin: 4,
          errorCorrectionLevel: 'M',
          // Keep the QR's contrast and quiet zone stable in either app theme.
          color: { dark: '#000000ff', light: '#ffffffff' },
        });
        if (!cancelled) setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, attempt]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-square w-80 max-w-full">
        {state === 'loading' && (
          <Skeleton className="absolute inset-0 size-full" />
        )}
        <canvas
          ref={canvas}
          width={320}
          height={320}
          role="img"
          aria-label={`Judge invitation QR code for ${trackName}`}
          className={cn('size-full', state !== 'ready' && 'invisible')}
        />
      </div>
      {state === 'loading' && (
        <p role="status" className="text-sm text-muted-foreground">
          Preparing QR code…
        </p>
      )}
      {state === 'ready' && (
        <p className="text-center text-sm text-muted-foreground">
          Valid for {judgeQrInvitationMinutes} minutes. Up to{' '}
          {judgeQrInvitationMaxUses} judges can register with this code.
        </p>
      )}
      {state === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>
            QR code couldn’t be displayed. Copy the invitation link or try
            again.
            <Button
              variant="secondary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
