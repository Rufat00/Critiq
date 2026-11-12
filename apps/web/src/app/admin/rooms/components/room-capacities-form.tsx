'use client';
import { useId } from 'react';
import type {
  RoomEditorData,
  SetRoomTrackAccessInput,
} from '@critiq/core/rooms';
import type { AppFieldErrors } from '@critiq/core/errors';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field';
import { Slider } from '@/components/ui/slider';

export function RoomCapacitiesForm({
  value,
  onChange,
  options,
  disabled,
  errors,
}: {
  value: SetRoomTrackAccessInput['tracks'];
  onChange: (next: SetRoomTrackAccessInput['tracks']) => void;
  options: RoomEditorData['tracks'];
  disabled: boolean;
  errors: AppFieldErrors;
}) {
  const id = useId();
  return (
    <FieldSet>
      <FieldLegend>Spots per track</FieldLegend>
      <FieldDescription>
        Choose how many projects from each track fit in this room. Project
        numbers are assigned automatically across all rooms and tracks.
      </FieldDescription>
      <FieldGroup>
        {options.map((option) => {
          const index = value.findIndex((track) => track.trackId === option.id);
          const capacity = value[index]?.capacity ?? 0;
          const error =
            errors[`tracks.${index}.capacity`]?.[0] ??
            (capacity > option.remainingProjects
              ? `Only ${option.remainingProjects} projects are available. Reduce the spot count.`
              : undefined);
          const labelId = `${id}-${option.id}-label`;
          const descriptionId = `${id}-${option.id}-description`;
          const errorId = `${id}-${option.id}-error`;
          return (
            <Field
              key={option.id}
              data-invalid={!!error}
              data-disabled={
                disabled || (option.remainingProjects === 0 && capacity === 0)
              }
            >
              <FieldLabel id={labelId}>
                {option.name}{' '}
                <output aria-live="polite">{capacity} spots</output>
              </FieldLabel>
              <Slider
                aria-labelledby={labelId}
                aria-describedby={`${descriptionId} ${errorId}`}
                aria-invalid={!!error}
                thumbLabels={[`${option.name} spots`]}
                showThumbValues
                value={[capacity]}
                min={0}
                max={Math.max(1, option.remainingProjects, capacity)}
                step={1}
                disabled={
                  disabled || (option.remainingProjects === 0 && capacity === 0)
                }
                onValueChange={([next]) =>
                  onChange(
                    value.map((track) =>
                      track.trackId === option.id
                        ? { ...track, capacity: next ?? 0 }
                        : track,
                    ),
                  )
                }
              />
              <FieldDescription id={descriptionId}>
                0–{option.remainingProjects} spots available
              </FieldDescription>
              <FieldError id={errorId}>{error}</FieldError>
            </Field>
          );
        })}
        {!options.length && (
          <FieldDescription>
            No tracks available. Configure tracks before assigning room spots.
          </FieldDescription>
        )}
        <FieldError>{errors.tracks?.[0]}</FieldError>
      </FieldGroup>
    </FieldSet>
  );
}
