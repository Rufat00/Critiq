'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export function CategorySelectionPill({
  id,
  name,
  checked,
  disabled,
  hint,
  onCheckedChange,
}: {
  id: string;
  name: string;
  checked: boolean;
  disabled: boolean;
  hint?: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" data-disabled={disabled}>
      <FieldLabel
        htmlFor={id}
        title={hint}
        className={cn(
          'w-full cursor-pointer items-center justify-between rounded-full border border-border px-4 py-3 has-disabled:cursor-default',
          checked && 'border-primary bg-accent',
        )}
      >
        <span className="min-w-0 flex-1 break-words">
          {name}
          {hint && <span className="sr-only"> ({hint})</span>}
        </span>
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
      </FieldLabel>
    </Field>
  );
}
