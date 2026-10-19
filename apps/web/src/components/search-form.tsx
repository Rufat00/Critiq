'use client';

import { useEffect, useRef } from 'react';
import { useForm } from '@tanstack/react-form';
import { RiSearchLine } from '@remixicon/react';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from '@/lib/hooks/use-debounced-callback';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';

const normalizeSearch = (value: string) => value.trim().replace(/\s+/g, ' ');

export function SearchForm({
  id,
  label,
  placeholder,
  className,
  initialSearch,
  pending,
  onSearch,
}: {
  id: string;
  label: string;
  placeholder: string;
  className?: string;
  initialSearch: string;
  pending: boolean;
  onSearch: (value: string) => void;
}) {
  const previousSearch = useRef(initialSearch);
  const composing = useRef(false);
  const form = useForm({
    defaultValues: { search: initialSearch },
    onSubmit: ({ value }) => {
      const search = normalizeSearch(value.search);
      if (search !== normalizeSearch(initialSearch)) onSearch(search);
    },
  });

  const scheduleSearch = useDebouncedCallback(() => {
    void form.handleSubmit();
  });
  useEffect(() => {
    // Sync URL navigation and Clear search without replacing newer typing.
    if (
      !scheduleSearch.isPending() &&
      normalizeSearch(form.state.values.search) ===
        normalizeSearch(previousSearch.current)
    ) {
      form.reset({ search: initialSearch });
    }
    previousSearch.current = initialSearch;
  }, [initialSearch, form, scheduleSearch]);

  return (
    <form
      role="search"
      aria-label={label}
      aria-busy={pending}
      className={cn('w-full min-w-0', className)}
      onSubmit={(event) => {
        event.preventDefault();
        scheduleSearch.cancel();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="search">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={id} className="sr-only">
                {label}
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon
                  aria-hidden="true"
                  className="border-0 pl-3 pr-0 text-muted-foreground [&_svg]:size-4"
                >
                  <RiSearchLine />
                </InputGroupAddon>
                <InputGroupInput
                  id={id}
                  type="search"
                  placeholder={placeholder}
                  maxLength={200}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    scheduleSearch.cancel();
                    if (!composing.current) scheduleSearch();
                  }}
                  onCompositionStart={() => {
                    composing.current = true;
                    scheduleSearch.cancel();
                  }}
                  onCompositionEnd={() => {
                    composing.current = false;
                    scheduleSearch();
                  }}
                />
              </InputGroup>
            </Field>
          )}
        </form.Field>
      </FieldGroup>
      <span role="status" className="sr-only">
        {pending ? 'Updating search results…' : ''}
      </span>
    </form>
  );
}
