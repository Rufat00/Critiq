'use client';
import { useId } from 'react';
import { RiDeleteBinLine } from '@remixicon/react';
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
}: {
  value: AccessTracks;
  onChange: (next: AccessTracks) => void;
  options: RoomEditorData['tracks'];
  disabled: boolean;
  errors: AppFieldErrors;
}) {
  const id = useId();
  const availableTracks = options.filter(
    (option) => !value.some((track) => track.trackId === option.id),
  );
  function addTrack(trackId: string) {
    const option = availableTracks.find((track) => track.id === trackId);
    if (disabled || !option || option.remainingProjects === 0) return;
    const start =
      Math.max(
        0,
        ...value.flatMap((track) =>
          track.ranges.map((range) => range.toNumber),
        ),
      ) + 1;
    onChange([
      ...value,
      {
        trackId,
        ranges: [
          {
            fromNumber: start,
            toNumber: start + Math.min(option.remainingProjects, 10) - 1,
          },
        ],
      },
    ]);
  }
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
      <FieldSet disabled={disabled} aria-label="Room track ranges">
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
                <FieldLegend variant="label" className="px-0.5">
                  {option.name}
                </FieldLegend>
                {track.ranges.map((range, j) => (
                  <Field key={j} data-invalid={!!errors[`tracks.${i}.ranges`]}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <FieldLabel id={`${id}-${i}-${j}`}>
                        Tables {range.fromNumber}–{range.toNumber}
                      </FieldLabel>
                      <div className="flex items-center gap-2">
                        <Badge>
                          {Math.max(0, option.remainingProjects - used)}{' '}
                          projects remaining
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={disabled}
                          aria-label={`Remove ${option.name} range ${j + 1}`}
                          onClick={() =>
                            onChange(
                              value
                                .map((t, ti) =>
                                  ti === i
                                    ? {
                                        ...t,
                                        ranges: t.ranges.filter(
                                          (_, ri) => ri !== j,
                                        ),
                                      }
                                    : t,
                                )
                                .filter((t) => t.ranges.length > 0),
                            )
                          }
                        >
                          <RiDeleteBinLine />
                        </Button>
                      </div>
                    </div>
                    <RangeSlider
                      labelId={`${id}-${i}-${j}`}
                      range={range}
                      option={option}
                      others={track.ranges.filter((_, ri) => ri !== j)}
                      occupied={value.flatMap((other, ti) =>
                        other.ranges.filter((_, ri) => ti !== i || ri !== j),
                      )}
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
          <Field>
            <FieldLabel id={`${id}-add-track`}>Add track</FieldLabel>
            {availableTracks.length ? (
              <RadioGroup
                aria-labelledby={`${id}-add-track`}
                value=""
                onValueChange={addTrack}
                disabled={disabled}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {availableTracks.map((option) => {
                  const unavailable =
                    disabled || option.remainingProjects === 0;
                  return (
                    <Field
                      key={option.id}
                      orientation="horizontal"
                      data-disabled={unavailable}
                    >
                      <FieldLabel
                        htmlFor={`${id}-track-${option.id}`}
                        className="w-full cursor-pointer items-center justify-between rounded-full border border-border px-4 py-3 has-disabled:cursor-default"
                      >
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="truncate" title={option.name}>
                            {option.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {option.remainingProjects} remaining
                          </span>
                        </span>
                        <RadioGroupItem
                          id={`${id}-track-${option.id}`}
                          value={option.id}
                          disabled={unavailable}
                        />
                      </FieldLabel>
                    </Field>
                  );
                })}
              </RadioGroup>
            ) : (
              <p className="text-sm text-muted-foreground">
                {options.length
                  ? 'All tracks have been added.'
                  : 'Create a track and add projects before configuring ranges.'}
              </p>
            )}
          </Field>
          <FieldError>{errors.tracks?.[0]}</FieldError>
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
  occupied,
  option,
  disabled,
  onChange,
}: {
  labelId: string;
  range: TableRange;
  others: TableRange[];
  occupied: TableRange[];
  option: RoomEditorData['tracks'][number];
  disabled: boolean;
  onChange: (range: TableRange) => void;
}) {
  const min = Math.max(
    1,
    ...occupied
      .filter((r) => r.toNumber < range.fromNumber)
      .map((r) => r.toNumber + 1),
  );
  const max = Math.min(
    2147483647,
    ...occupied
      .filter((r) => r.fromNumber > range.toNumber)
      .map((r) => r.fromNumber - 1),
    Math.max(
      2,
      option.projectCount,
      range.fromNumber + option.remainingProjects - 1,
      option.highestTableNumber + option.remainingProjects,
      range.toNumber,
      ...others.map((r) => r.toNumber + option.remainingProjects),
    ),
  );
  return (
    <div className="flex flex-col gap-3 py-2">
      <Slider
        aria-labelledby={labelId}
        showThumbValues
        thumbLabels={[
          `${option.name}: starting table`,
          `${option.name}: ending table`,
        ]}
        aria-valuetext={`Tables ${range.fromNumber} to ${range.toNumber}`}
        min={min}
        max={max}
        step={1}
        minStepsBetweenThumbs={0}
        value={[range.fromNumber, range.toNumber]}
        disabled={disabled || min === max}
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
        <span>{min}</span>
        <output aria-live="polite">
          {range.toNumber - range.fromNumber + 1} tables
        </output>
        <span>{max}</span>
      </div>
    </div>
  );
}
