import Image from 'next/image';
import type { ComponentProps } from 'react';

import critiqMark from '@/assets/brand/critiq-mark.webp';
import critiqWordmarkLettering from '@/assets/brand/critiq-wordmark-lettering.webp';
import critiqWordmarkSymbol from '@/assets/brand/critiq-wordmark-symbol.webp';
import { cn } from '@/lib/utils';

type LogoProps = Omit<ComponentProps<'span'>, 'children'> & {
  alt?: string;
  variant?: 'mark' | 'wordmark';
};

/** Wordmark lettering follows the inherited text color; the C stays blue. */
export function Logo({
  variant = 'wordmark',
  alt = 'Critiq',
  className,
  ...props
}: LogoProps) {
  return (
    <span
      {...props}
      className={cn(
        'relative inline-flex h-8 max-w-full shrink-0 align-middle',
        className,
      )}
    >
      <Image
        src={variant === 'mark' ? critiqMark : critiqWordmarkSymbol}
        alt={alt}
        className="h-full w-auto max-w-full object-contain"
      />
      {variant === 'wordmark' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-current"
          style={{
            maskImage: `url("${critiqWordmarkLettering.src}")`,
            maskSize: '100% 100%',
            maskRepeat: 'no-repeat',
          }}
        />
      )}
    </span>
  );
}
