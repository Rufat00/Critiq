'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Slider as SliderPrimitive } from 'radix-ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels,
  showThumbValues = false,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  thumbLabels?: string[];
  showThumbValues?: boolean;
}) {
  const [heldThumb, setHeldThumb] = React.useState<number | null>(null);
  const [focusedThumb, setFocusedThumb] = React.useState<number | null>(null);
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );

  return (
    <TooltipProvider>
      <SliderPrimitive.Root
        data-slot="slider"
        defaultValue={defaultValue}
        value={value}
        min={min}
        max={max}
        className={cn(
          'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
          className,
        )}
        {...props}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className={cn(
            'relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
          )}
        >
          <SliderPrimitive.Range
            data-slot="slider-range"
            className={cn(
              'absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full',
            )}
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <Tooltip
            key={index}
            open={
              showThumbValues && (heldThumb === index || focusedThumb === index)
            }
          >
            <TooltipTrigger asChild>
              <SliderPrimitive.Thumb
                data-slot="slider-thumb"
                onPointerDown={() => {
                  setFocusedThumb(null);
                  setHeldThumb(index);
                }}
                onPointerUp={() => setHeldThumb(null)}
                onPointerCancel={() => setHeldThumb(null)}
                onLostPointerCapture={() => setHeldThumb(null)}
                onFocus={(event) => {
                  if (event.currentTarget.matches(':focus-visible'))
                    setFocusedThumb(index);
                }}
                onKeyDown={() => setFocusedThumb(index)}
                onBlur={() => {
                  setFocusedThumb(null);
                  setHeldThumb(null);
                }}
                {...(thumbLabels?.[index]
                  ? { 'aria-label': thumbLabels[index] }
                  : {})}
                aria-describedby={props['aria-describedby']}
                aria-invalid={props['aria-invalid']}
                className="block size-4 shrink-0 rounded-full border border-primary bg-white shadow-none ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={8}
              className="pointer-events-none tabular-nums"
            >
              {_values[index]}
            </TooltipContent>
          </Tooltip>
        ))}
      </SliderPrimitive.Root>
    </TooltipProvider>
  );
}

export { Slider };
