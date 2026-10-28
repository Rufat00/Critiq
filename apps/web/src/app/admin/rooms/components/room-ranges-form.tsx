'use client';
import { useId, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { RiAddLine, RiDeleteBinLine } from '@remixicon/react';
import type {
  RoomEditorData,
  SetRoomTrackAccessInput,
} from '@critiq/core/rooms';
import type { AppFieldErrors } from '@critiq/core/errors';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  countCoveredTables,
  constrainTableRange,
  type TableRange,
} from '../lib/table-ranges';
import { TableRangePreview } from './table-range-preview';

type AccessTracks = SetRoomTrackAccessInput['tracks'];
export function RoomRangesForm({
  value,
  onChange,
  options,
  disabled,
  errors,
  onDraftChange,
}: {
  value: AccessTracks;
  onChange: (next: AccessTracks) => void;
  options: RoomEditorData['tracks'];
  disabled: boolean;
  errors: AppFieldErrors;
  onDraftChange: (dirty: boolean) => void;
}) {
  const id = useId(),
    [draftError, setDraftError] = useState('');
  const draft = useForm({
    defaultValues: { trackId: '', range: { fromNumber: 1, toNumber: 1 } },
    onSubmit: ({ value: entry }) => {
      const option = options.find((t) => t.id === entry.trackId);
      const existing = value.find((t) => t.trackId === entry.trackId);
      if (
        !option ||
        countCoveredTables([...(existing?.ranges ?? []), entry.range]) >
          option.remainingProjects
      ) {
        setDraftError('Choose a track with enough remaining projects.');
        return;
      }
      if (
        existing?.ranges.some(
          (r) =>
            r.fromNumber === entry.range.fromNumber &&
            r.toNumber === entry.range.toNumber,
        )
      ) {
        setDraftError('This range already exists.');
        return;
      }
      onChange(
        existing
          ? value.map((t) =>
              t.trackId === entry.trackId
                ? { ...t, ranges: [...t.ranges, entry.range] }
                : t,
            )
          : [...value, { trackId: entry.trackId, ranges: [entry.range] }],
      );
      draft.reset();
      onDraftChange(false);
      setDraftError('');
    },
  });
  const entry = useStore(draft.store, (s) => s.values);
  const selected = options.find((t) => t.id === entry.trackId);
  const existingRanges =
    value.find((t) => t.trackId === entry.trackId)?.ranges ?? [];
  function updateRange(i: number, j: number, range: TableRange) {
    onChange(
      value.map((t, ti) =>
        ti === i
          ? { ...t, ranges: t.ranges.map((r, ri) => (ri === j ? range : r)) }
          : t,
      ),
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <FieldSet disabled={disabled}>
        <FieldLegend>Table ranges</FieldLegend>
        <FieldGroup className="gap-4">
          {!value.length && (
            <p className="text-sm text-muted-foreground">
              No ranges yet. Choose a track below to add one.
            </p>
          )}
          {value.map((track, i) => {
            const option = options.find((t) => t.id === track.trackId);
            if (!option) return null;
            const used = countCoveredTables(track.ranges);
            return (
              <FieldSet
                key={track.trackId}
                className="gap-3 rounded-2xl border border-border p-4"
              >
                <FieldLegend variant="label">{option.name}</FieldLegend>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge>
                    {Math.max(0, option.remainingProjects - used)} projects
                    remaining
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onChange(value.filter((_, ti) => ti !== i))}
                  >
                    Remove track
                  </Button>
                </div>
                {track.ranges.map((range, j) => (
                  <Field key={j} data-invalid={!!errors[`tracks.${i}.ranges`]}>
                    <div className="flex items-center justify-between gap-3">
                      <FieldLabel id={`${id}-${i}-${j}`}>
                        Tables {range.fromNumber}–{range.toNumber}
                      </FieldLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        aria-label={`Remove ${option.name} range ${j + 1}`}
                        onClick={() =>
                          onChange(
                            value.map((t, ti) =>
                              ti === i
                                ? {
                                    ...t,
                                    ranges: t.ranges.filter(
                                      (_, ri) => ri !== j,
                                    ),
                                  }
                                : t,
                            ),
                          )
                        }
                      >
                        <RiDeleteBinLine />
                      </Button>
                    </div>
                    <RangeSlider
                      labelId={`${id}-${i}-${j}`}
                      range={range}
                      option={option}
                      others={track.ranges.filter((_, ri) => ri !== j)}
                      disabled={disabled || option.remainingProjects === 0}
                      onChange={(next) => updateRange(i, j, next)}
                    />
                    <FieldError>
                      {errors[`tracks.${i}.ranges.${j}.fromNumber`]?.[0] ??
                        errors[`tracks.${i}.ranges.${j}.toNumber`]?.[0]}
                    </FieldError>
                  </Field>
                ))}
                <FieldError>
                  {errors[`tracks.${i}.ranges`]?.[0] ??
                    (used > option.remainingProjects
                      ? `Reduce the ranges to cover at most ${option.remainingProjects} available projects.`
                      : undefined)}
                </FieldError>
              </FieldSet>
            );
          })}
          <FieldError>{errors.tracks?.[0]}</FieldError>
        </FieldGroup>
      </FieldSet>
      <FieldSet disabled={disabled}>
        <FieldLegend>Add range</FieldLegend>
        <FieldGroup>
          <draft.Field name="trackId">
            {(field) => (
              <Field>
                <FieldLabel id={`${id}-track-label`}>Track</FieldLabel>
                <RadioGroup
                  aria-labelledby={`${id}-track-label`}
                  value={field.state.value}
                  className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  onValueChange={(trackId) => {
                    const option = options.find((t) => t.id === trackId)!;
                    const ranges =
                      value.find((t) => t.trackId === trackId)?.ranges ?? [];
                    const available = Math.max(
                      0,
                      option.remainingProjects - countCoveredTables(ranges),
                    );
                    const start =
                      Math.max(0, ...ranges.map((r) => r.toNumber)) + 1;
                    field.handleChange(trackId);
                    draft.setFieldValue('range', {
                      fromNumber: start,
                      toNumber: Math.min(
                        2147483647,
                        start + Math.min(available, 10) - 1,
                      ),
                    });
                    onDraftChange(true);
                    setDraftError('');
                  }}
                >
                  {options.map((option) => {
                    const remaining = Math.max(
                      0,
                      option.remainingProjects -
                        countCoveredTables(
                          value.find((t) => t.trackId === option.id)?.ranges ??
                            [],
                        ),
                    );
                    return (
                      <Field
                        key={option.id}
                        orientation="horizontal"
                        data-disabled={disabled || remaining === 0}
                      >
                        <FieldLabel
                          htmlFor={`${id}-${option.id}`}
                          className={cn(
                            'w-full cursor-pointer items-center justify-between rounded-full border border-border px-4 py-3 has-disabled:cursor-default',
                            field.state.value === option.id &&
                              'border-primary bg-accent',
                          )}
                        >
                          <span className="flex min-w-0 flex-col gap-1">
                            <span className="break-words">{option.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {remaining} remaining
                            </span>
                          </span>
                          <RadioGroupItem
                            id={`${id}-${option.id}`}
                            value={option.id}
                            disabled={disabled || remaining === 0}
                          />
                        </FieldLabel>
                      </Field>
                    );
                  })}
                </RadioGroup>
                {!options.length && (
                  <p className="text-sm text-muted-foreground">
                    Create a track and add projects before configuring ranges.
                  </p>
                )}
              </Field>
            )}
          </draft.Field>
          {selected && (
            <draft.Field name="range">
              {(field) => (
                <Field data-invalid={!!draftError}>
                  <FieldLabel id={`${id}-draft-range`}>
                    Tables {field.state.value.fromNumber}–
                    {field.state.value.toNumber}
                  </FieldLabel>
                  <RangeSlider
                    labelId={`${id}-draft-range`}
                    option={selected}
                    range={field.state.value}
                    others={existingRanges}
                    disabled={disabled}
                    onChange={(next) => {
                      field.handleChange(next);
                      onDraftChange(true);
                      setDraftError('');
                    }}
                  />
                </Field>
              )}
            </draft.Field>
          )}
          <FieldError>{draftError}</FieldError>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={disabled || !selected}
              onClick={() => void draft.handleSubmit()}
            >
              <RiAddLine data-icon="inline-start" />
              Add range
            </Button>
            {selected && (
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => {
                  draft.reset();
                  onDraftChange(false);
                  setDraftError('');
                }}
              >
                Cancel range
              </Button>
            )}
          </div>
          {selected && (
            <p className="text-xs text-muted-foreground">
              Add or cancel this range before saving the room.
            </p>
          )}
        </FieldGroup>
      </FieldSet>
      {value.some((t) => t.ranges.length) && (
        <TableRangePreview
          tracks={value}
          options={options.map((t) => ({
            id: t.id,
            category: { name: t.name },
          }))}
        />
      )}
    </div>
  );
}
function RangeSlider({
  labelId,
  range,
  others,
  option,
  disabled,
  onChange,
}: {
  labelId: string;
  range: TableRange;
  others: TableRange[];
  option: RoomEditorData['tracks'][number];
  disabled: boolean;
  onChange: (range: TableRange) => void;
}) {
  const max = Math.min(
    2147483647,
    Math.max(
      2,
      option.projectCount,
      option.highestTableNumber + option.remainingProjects,
      range.toNumber,
      ...others.map((r) => r.toNumber + option.remainingProjects),
    ),
  );
  return (
    <div className="flex flex-col gap-3 py-2">
      <Slider
        aria-labelledby={labelId}
        thumbLabels={[
          `${option.name}: starting table`,
          `${option.name}: ending table`,
        ]}
        aria-valuetext={`Tables ${range.fromNumber} to ${range.toNumber}`}
        min={1}
        max={max}
        step={1}
        minStepsBetweenThumbs={0}
        value={[range.fromNumber, range.toNumber]}
        disabled={disabled}
        onValueChange={(numbers) =>
          onChange(
            constrainTableRange(
              { fromNumber: numbers[0]!, toNumber: numbers[1]! },
              range,
              others,
              option.remainingProjects,
            ),
          )
        }
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{1}</span>
        <output aria-live="polite">
          {range.toNumber - range.fromNumber + 1} tables
        </output>
        <span>{max}</span>
      </div>
    </div>
  );
}
