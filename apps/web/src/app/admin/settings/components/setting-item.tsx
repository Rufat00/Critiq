import type { ReactNode } from 'react';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import { cn } from '@/lib/utils';

export function SettingItem({
  title,
  description,
  children,
  htmlFor,
  labelId,
  descriptionId,
  invalid,
  disabled,
  variant = 'control',
}: {
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  labelId?: string;
  descriptionId?: string;
  invalid?: boolean;
  disabled?: boolean;
  variant?: 'control' | 'action';
}) {
  return (
    <Field
      data-invalid={invalid}
      data-disabled={disabled}
      className="grid items-start gap-4 py-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-12"
    >
      <FieldContent>
        {htmlFor || labelId ? (
          <FieldLabel htmlFor={htmlFor} id={labelId}>
            {title}
          </FieldLabel>
        ) : (
          <FieldTitle>{title}</FieldTitle>
        )}
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      </FieldContent>
      <div
        className={cn(
          'flex min-w-0 flex-col gap-3',
          variant === 'action' &&
            'w-full md:ml-auto md:max-w-52 [&>button]:w-full',
        )}
      >
        {children}
      </div>
    </Field>
  );
}
