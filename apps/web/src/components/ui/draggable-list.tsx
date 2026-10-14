'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiDraggable,
} from '@remixicon/react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DragSelection<T> {
  id: string;
  original: T[];
  preview: T[];
  input: 'pointer' | 'keyboard';
  pointerId?: number;
  clientY?: number;
  grabOffset?: number;
  itemHeight?: number;
  slotCenters?: number[];
}

export interface DraggableListProps<T extends { id: string }> {
  items: readonly T[];
  onOrderChange: (items: T[]) => void;
  getItemLabel: (item: T) => string;
  renderItem: (item: T, rank: number) => ReactNode;
  label: string;
  disabled?: boolean;
  emptyMessage?: string;
  className?: string;
}

function moveItem<T extends { id: string }>(
  items: T[],
  id: string,
  index: number,
) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return items;
  const remaining = items.filter((entry) => entry.id !== id);
  remaining.splice(Math.max(0, Math.min(index, remaining.length)), 0, item);
  return remaining;
}

export function DraggableList<T extends { id: string }>({
  items,
  onOrderChange,
  getItemLabel,
  renderItem,
  label,
  disabled = false,
  emptyMessage = 'No projects to rank yet.',
  className,
}: DraggableListProps<T>) {
  const hintId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const selectionRef = useRef<DragSelection<T> | null>(null);
  const [selection, setSelection] = useState<DragSelection<T> | null>(null);
  const [announcement, setAnnouncement] = useState('');

  function updateSelection(next: DragSelection<T> | null) {
    selectionRef.current = next;
    setSelection(next);
  }

  function cancel() {
    updateSelection(null);
    setAnnouncement('Ranking change canceled. The original order is restored.');
  }

  function commit() {
    const active = selectionRef.current;
    if (!active) return;
    // Keep the current records; the component only changes their ordering.
    const byId = new Map(items.map((item) => [item.id, item]));
    const next = active.preview.flatMap((item) => {
      const current = byId.get(item.id);
      return current ? [current] : [];
    });
    updateSelection(null);
    if (disabled || next.length !== items.length) return;
    if (next.some((item, index) => item.id !== items[index]?.id))
      onOrderChange(next);
    const rank = next.findIndex((item) => item.id === active.id) + 1;
    const item = byId.get(active.id);
    if (item)
      setAnnouncement(
        `${getItemLabel(item)} is ranked ${rank} of ${next.length}.`,
      );
  }

  function updatePointer(clientY: number) {
    const active = selectionRef.current;
    if (!active || active.input !== 'pointer') return;
    const list = listRef.current;
    if (
      !list ||
      !active.slotCenters ||
      active.grabOffset === undefined ||
      active.itemHeight === undefined
    )
      return;
    const center =
      clientY -
      list.getBoundingClientRect().top -
      active.grabOffset +
      active.itemHeight / 2;
    // Fixed rank positions keep the threshold stable after the rows reorder.
    const index = active.slotCenters.reduce(
      (closest, slot, candidate, slots) =>
        Math.abs(slot - center) < Math.abs(slots[closest]! - center)
          ? candidate
          : closest,
      0,
    );
    const preview = moveItem(active.preview, active.id, index);
    updateSelection({ ...active, preview, clientY });
  }

  function startPointer(event: PointerEvent<HTMLButtonElement>, item: T) {
    if (disabled || event.button !== 0 || !event.isPrimary) return;
    const bounds = rows.current.get(item.id)?.getBoundingClientRect();
    if (!bounds) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    listRef.current?.setPointerCapture(event.pointerId);
    updateSelection({
      id: item.id,
      original: [...items],
      preview: [...items],
      input: 'pointer',
      pointerId: event.pointerId,
      clientY: event.clientY,
      grabOffset: event.clientY - bounds.top,
      itemHeight: bounds.height,
      slotCenters: items.map((entry) => {
        const row = rows.current.get(entry.id);
        return row ? row.offsetTop + row.offsetHeight / 2 : 0;
      }),
    });
    setAnnouncement(
      `${getItemLabel(item)} picked up. Drag to change its rank; release to place it.`,
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, item: T) {
    if (disabled) return;
    const active = selectionRef.current;
    if (event.key === 'Escape' && active) {
      event.preventDefault();
      cancel();
      return;
    }
    if ([' ', 'Enter'].includes(event.key)) {
      event.preventDefault();
      if (event.repeat) return;
      if (active?.id === item.id) commit();
      else {
        updateSelection({
          id: item.id,
          original: [...items],
          preview: [...items],
          input: 'keyboard',
        });
        setAnnouncement(
          `${getItemLabel(item)} picked up. Use arrow keys to move, Enter or Space to place, or Escape to cancel.`,
        );
      }
      return;
    }
    if (active?.id !== item.id || active.input !== 'keyboard') return;
    const index = active.preview.findIndex((entry) => entry.id === item.id);
    const nextIndex = (
      {
        ArrowUp: index - 1,
        ArrowDown: index + 1,
        Home: 0,
        End: active.preview.length - 1,
      } as Record<string, number>
    )[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    const preview = moveItem(active.preview, item.id, nextIndex);
    updateSelection({ ...active, preview });
    setAnnouncement(
      `${getItemLabel(item)}, position ${preview.findIndex((entry) => entry.id === item.id) + 1} of ${preview.length}.`,
    );
  }

  function moveByButton(item: T, index: number) {
    if (disabled || selectionRef.current) return;
    const next = moveItem([...items], item.id, index);
    onOrderChange(next);
    setAnnouncement(
      `${getItemLabel(item)} is ranked ${next.findIndex((entry) => entry.id === item.id) + 1} of ${next.length}.`,
    );
  }

  useLayoutEffect(() => {
    rows.current.forEach((row) => {
      row.style.translate = '';
    });
    if (!selection) return;
    const handle = handles.current.get(selection.id);
    if (selection.input === 'keyboard') {
      handle?.focus({ preventScroll: true });
      return;
    }
    const row = rows.current.get(selection.id);
    const list = listRef.current;
    if (
      !row ||
      !list ||
      selection.clientY === undefined ||
      selection.grabOffset === undefined
    )
      return;
    const rowTop = list.getBoundingClientRect().top + row.offsetTop;
    row.style.translate = `0 ${selection.clientY - selection.grabOffset - rowTop}px`;
  }, [selection]);

  useEffect(() => {
    const active = selectionRef.current;
    if (
      active &&
      (disabled ||
        active.original.length !== items.length ||
        active.original.some((item, index) => item.id !== items[index]?.id))
    ) {
      selectionRef.current = null;
      setSelection(null);
      setAnnouncement('Ranking changed. Select a project again to continue.');
    }
  }, [items, disabled]);

  useEffect(() => {
    if (selection?.input !== 'pointer') return;
    const list = listRef.current;
    if (!list) return;
    let scrollParent = list.parentElement;
    while (
      scrollParent &&
      !(
        scrollParent.scrollHeight > scrollParent.clientHeight &&
        /(auto|scroll)/.test(getComputedStyle(scrollParent).overflowY)
      )
    )
      scrollParent = scrollParent.parentElement;
    const container = scrollParent;
    let frame: number;
    function autoScroll() {
      const active = selectionRef.current;
      if (!active || active.clientY === undefined) return;
      const bounds = container?.getBoundingClientRect();
      const top = bounds ? Math.max(0, bounds.top) : 0;
      const bottom = bounds
        ? Math.min(window.innerHeight, bounds.bottom)
        : window.innerHeight;
      const edge = 56;
      const velocity =
        active.clientY < top + edge
          ? -Math.min(12, (top + edge - active.clientY) / 4)
          : active.clientY > bottom - edge
            ? Math.min(12, (active.clientY - bottom + edge) / 4)
            : 0;
      if (velocity) {
        const before = container ? container.scrollTop : window.scrollY;
        if (container) container.scrollBy(0, velocity);
        else window.scrollBy(0, velocity);
        const after = container ? container.scrollTop : window.scrollY;
        if (before !== after) updatePointer(active.clientY);
      }
      frame = requestAnimationFrame(autoScroll);
    }
    frame = requestAnimationFrame(autoScroll);
    return () => cancelAnimationFrame(frame);
    // The frame loop reads the current selection from its ref.
  }, [selection?.input]);

  useEffect(() => {
    if (!selection) return;
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) cancel();
    }
    function onBlur() {
      cancel();
    }
    window.addEventListener('keydown', onEscape);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onEscape);
      window.removeEventListener('blur', onBlur);
    };
  }, [selection?.input]);

  const displayed = selection?.preview ?? items;

  return (
    <div className={cn('space-y-3', className)}>
      <p id={hintId} className="text-sm text-muted-foreground">
        {disabled
          ? 'Ranking is locked. Projects cannot be moved.'
          : 'Drag a handle to rank projects, best first. You can also use the move buttons. On a keyboard, press Space to pick up, arrow keys to move, and Enter to place.'}
      </p>
      {!items.length ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ol
          ref={listRef}
          aria-label={label}
          className="relative space-y-3 p-1"
          onPointerMove={(event) => {
            if (event.pointerId === selectionRef.current?.pointerId)
              updatePointer(event.clientY);
          }}
          onPointerUp={(event) => {
            if (event.pointerId === selectionRef.current?.pointerId) commit();
          }}
          onPointerCancel={(event) => {
            if (event.pointerId === selectionRef.current?.pointerId) cancel();
          }}
          onLostPointerCapture={(event) => {
            if (event.pointerId === selectionRef.current?.pointerId) cancel();
          }}
        >
          {displayed.map((item, index) => {
            const active = selection?.id === item.id;
            const name = getItemLabel(item);
            return (
              <li
                key={item.id}
                ref={(node) => {
                  if (node) rows.current.set(item.id, node);
                  else rows.current.delete(item.id);
                }}
                data-selected={active || undefined}
                className="relative flex min-h-20 items-center gap-3 rounded-2xl border bg-card p-3 transition-[scale,box-shadow,border-color] duration-[var(--motion-fast)] ease-ui data-[selected=true]:z-10 data-[selected=true]:scale-[1.025] data-[selected=true]:border-primary/50 data-[selected=true]:shadow-popover motion-reduce:transition-none"
              >
                <button
                  type="button"
                  ref={(node) => {
                    if (node) handles.current.set(item.id, node);
                    else handles.current.delete(item.id);
                  }}
                  disabled={disabled}
                  aria-label={`Reorder ${name}, rank ${index + 1} of ${displayed.length}`}
                  aria-describedby={hintId}
                  aria-pressed={active}
                  aria-keyshortcuts="Space Enter ArrowUp ArrowDown Home End Escape"
                  className="flex size-11 shrink-0 touch-none items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:cursor-grabbing data-[active=true]:bg-soft data-[active=true]:text-soft-foreground cursor-grab"
                  data-active={active || undefined}
                  onPointerDown={(event) => startPointer(event, item)}
                  onKeyDown={(event) => onKeyDown(event, item)}
                >
                  <RiDraggable className="size-6" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  {renderItem(item, index + 1)}
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    ripple={false}
                    disabled={disabled || !!selection || index === 0}
                    aria-label={`Move ${name} up`}
                    onClick={() => moveByButton(item, index - 1)}
                  >
                    <RiArrowUpSLine aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    ripple={false}
                    disabled={
                      disabled || !!selection || index === displayed.length - 1
                    }
                    aria-label={`Move ${name} down`}
                    onClick={() => moveByButton(item, index + 1)}
                  >
                    <RiArrowDownSLine aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </p>
    </div>
  );
}
