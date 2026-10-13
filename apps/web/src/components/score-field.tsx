'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

export function ScoreField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onValueChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <output
          htmlFor={id}
          className="text-sm font-medium tabular-nums text-foreground"
        >
          {value} / {max}
        </output>
      </div>
      <Slider
        id={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([next]) => next !== undefined && onValueChange(next)}
        aria-label={label}
      />
      <p className="text-xs text-muted-foreground">
        Choose a score from {min} to {max}.
      </p>
    </div>
  );
}
