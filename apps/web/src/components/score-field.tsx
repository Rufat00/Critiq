'use client';

import { useState } from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const scoreFieldColors = {
  primary: '[--score-color:var(--primary)]',
  success: '[--score-color:var(--success)]',
  warning: '[--score-color:var(--warning)]',
  destructive: '[--score-color:var(--destructive)]',
  info: '[--score-color:var(--info)]',
  'indigo-violet': '[--score-start:#a5b4fc] [--score-color:#4f46e5]',
  'emerald-lime': '[--score-start:#34d399] [--score-color:#84cc16]',
  'peach-rose': '[--score-start:#fdba74] [--score-color:#fb7185]',
} as const;

export type ScoreFieldVariant = keyof typeof scoreFieldColors;

export function ScoreField({
  id,
  label,
  value,
  min,
  max,
  step = max === 5 ? 0.25 : max === 10 ? 0.5 : 1,
  disabled,
  variant = 'primary',
  description,
  onValueChange,
  onValueCommit,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  variant?: ScoreFieldVariant;
  description?: string;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const marks = Array.from(
    { length: Math.floor((max - min) / step) + 1 },
    (_, index) => Number((min + index * step).toFixed(6)),
  );
  const hintId = `${id}-hint`;
  const labelId = `${id}-label`;

  return (
    <div
      data-variant={variant}
      className={cn('w-full min-w-0 space-y-1', scoreFieldColors[variant])}
    >
      <div className="flex items-center justify-between gap-3">
        <Label
          id={labelId}
          htmlFor={id}
          className="text-base font-semibold leading-6"
        >
          {label}
        </Label>
        <output
          htmlFor={id}
          className="min-w-16 rounded-full bg-muted px-3 py-0.5 text-center text-base font-semibold tabular-nums text-foreground"
        >
          {value}{' '}
          <span className="text-sm font-medium text-muted-foreground">
            / {max}
          </span>
        </output>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        data-dragging={dragging || undefined}
        className="group relative flex h-11 w-full touch-none items-center select-none data-[disabled]:opacity-45"
        onPointerDown={() => !disabled && setDragging(true)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onLostPointerCapture={() => setDragging(false)}
        onValueChange={([next]) => next !== undefined && onValueChange(next)}
        onValueCommit={([next]) => {
          setDragging(false);
          if (next !== undefined) onValueCommit?.(next);
        }}
      >
        <SliderPrimitive.Track className="relative h-6 w-full grow overflow-hidden rounded-full bg-secondary/70">
          <SliderPrimitive.Range className="absolute h-full rounded-full [background:linear-gradient(90deg,var(--score-start,color-mix(in_srgb,var(--score-color)_45%,white)),var(--score-color))]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          id={id}
          aria-labelledby={labelId}
          aria-describedby={hintId}
          aria-valuetext={`${value} out of ${max}`}
          className="block size-8 cursor-grab rounded-full border-[3px] border-background bg-[var(--score-color)] shadow-control outline-none transition-[scale] duration-[var(--motion-fast)] ease-ui focus-visible:ring-4 focus-visible:ring-[var(--score-color)] group-data-[dragging=true]:scale-125 group-data-[dragging=true]:cursor-grabbing data-[disabled]:cursor-not-allowed motion-reduce:transition-none"
        />
      </SliderPrimitive.Root>
      <div aria-hidden="true" className="relative mx-4 h-8">
        {marks.map((mark) => {
          const whole = Number.isInteger(mark);
          const selected = Math.abs(mark - value) < step / 2;
          return (
            <span
              key={mark}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1"
              style={{ left: `${((mark - min) / (max - min)) * 100}%` }}
            >
              <span className="flex h-2 items-center">
                <span
                  className={cn(
                    'rounded-full transition-[scale] duration-[var(--motion-fast)] ease-ui motion-reduce:transition-none',
                    whole ? 'size-1.5' : 'size-0.75',
                    selected
                      ? 'bg-[var(--score-color)]'
                      : 'bg-muted-foreground/40',
                    dragging && selected && 'scale-[1.8]',
                  )}
                />
              </span>
              {whole && (
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    selected
                      ? 'font-semibold text-[var(--score-color)]'
                      : 'text-muted-foreground',
                  )}
                >
                  {mark}
                </span>
              )}
            </span>
          );
        })}
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        {disabled
          ? 'Scoring is unavailable.'
          : dragging
            ? `Release to select ${value} out of ${max}.`
            : `Choose a score from ${min} to ${max} in ${step}-point increments.`}
      </p>
      {description && <p className="text-sm text-info">{description}</p>}
    </div>
  );
}
