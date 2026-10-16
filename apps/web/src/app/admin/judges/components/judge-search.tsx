'use client';
import { useForm } from '@tanstack/react-form';
import { RiSearchLine } from '@remixicon/react';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';

export function JudgeSearch({
  initialSearch,
  disabled,
  onSearch,
}: {
  initialSearch: string;
  disabled: boolean;
  onSearch: (search: string) => void;
}) {
  const form = useForm({
    defaultValues: { search: initialSearch },
    onSubmit: ({ value }) => onSearch(value.search.trim()),
  });
  return (
    <form
      role="search"
      aria-label="Search judges and invitations"
      className="w-full min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="search">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="judge-search" className="sr-only">
                Search judges
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon
                  aria-hidden="true"
                  className="border-0 pl-3 pr-0 text-muted-foreground [&_svg]:size-4"
                >
                  <RiSearchLine />
                </InputGroupAddon>
                <InputGroupInput
                  id="judge-search"
                  placeholder="Search name or email"
                  type="search"
                  maxLength={200}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  disabled={disabled}
                />
              </InputGroup>
            </Field>
          )}
        </form.Field>
      </FieldGroup>
    </form>
  );
}
