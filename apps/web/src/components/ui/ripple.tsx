'use client';

import { useEffect, useRef, useState } from 'react';

interface RippleWave {
  id: number;
  x: number;
  y: number;
  diameter: number;
  leaving: boolean;
}

const RIPPLE_DURATION = 550;
const TOUCH_DELAY = 80;

// Place inside a positioned interactive element. This decorative layer follows
// the parent's border radius without replacing its event handlers.
export function Ripple({ disabled = false }: { disabled?: boolean }) {
  const layerRef = useRef<HTMLSpanElement>(null);
  const nextId = useRef(0);
  const [waves, setWaves] = useState<RippleWave[]>([]);

  useEffect(() => {
    const target = layerRef.current?.parentElement;
    if (!target) return;
    if (disabled) {
      setWaves((current) => (current.length ? [] : current));
      return;
    }
    const control = target;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let mounted = true;
    let activeId: number | null = null;
    let pointerId: number | null = null;
    let pendingTouch: (() => void) | null = null;
    let touchTimer: ReturnType<typeof setTimeout> | null = null;
    let heldKey: string | null = null;
    let keyboardClickPending = false;

    function schedule(callback: () => void, duration: number) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (mounted) callback();
      }, duration);
      timers.add(timer);
      return timer;
    }

    function startWave(event: PointerEvent | MouseEvent | null) {
      if (
        !mounted ||
        !control.isConnected ||
        reducedMotion.matches ||
        control.matches(':disabled, [aria-disabled="true"], [data-disabled]')
      )
        return;
      const bounds = control.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const centered = event === null;
      const x = centered
        ? Math.round(bounds.width / 2)
        : Math.round(event.clientX - bounds.left);
      const y = centered
        ? Math.round(bounds.height / 2)
        : Math.round(event.clientY - bounds.top);
      let diameter = centered
        ? Math.sqrt((2 * bounds.width ** 2 + bounds.height ** 2) / 3)
        : 2 *
          Math.hypot(
            Math.max(x, control.clientWidth - x) + 1,
            Math.max(y, control.clientHeight - y) + 1,
          );
      if (centered && diameter % 2 === 0) diameter += 1;
      const id = nextId.current++;
      activeId = id;
      setWaves((current) => [
        ...current,
        { id, x, y, diameter, leaving: false },
      ]);
    }

    function stopWave() {
      const id = activeId;
      if (id === null) return;
      activeId = null;
      setWaves((current) =>
        current.map((wave) =>
          wave.id === id ? { ...wave, leaving: true } : wave,
        ),
      );
      schedule(
        () => setWaves((current) => current.filter((wave) => wave.id !== id)),
        RIPPLE_DURATION,
      );
    }

    function clearTouchDelay() {
      if (touchTimer !== null) {
        clearTimeout(touchTimer);
        timers.delete(touchTimer);
        touchTimer = null;
      }
    }

    function cancelPress() {
      clearTouchDelay();
      pendingTouch = null;
      pointerId = null;
      heldKey = null;
      keyboardClickPending = false;
      stopWave();
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0 || !event.isPrimary) return;
      stopWave();
      pointerId = event.pointerId;
      if (event.pointerType === 'touch') {
        pendingTouch = () => startWave(event);
        touchTimer = schedule(() => {
          pendingTouch?.();
          pendingTouch = null;
          touchTimer = null;
        }, TOUCH_DELAY);
      } else {
        startWave(event);
      }
    }

    function onPointerUp(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      clearTouchDelay();
      pointerId = null;
      if (pendingTouch) {
        // A quick tap still gets an entry frame before starting the exit.
        pendingTouch();
        pendingTouch = null;
        schedule(stopWave, 0);
      } else {
        stopWave();
      }
    }

    function onPointerCancel(event: PointerEvent) {
      if (event.pointerId === pointerId) cancelPress();
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerId === pointerId && event.pointerType === 'touch')
        cancelPress();
    }

    function onPointerLeave(event: PointerEvent) {
      if (event.pointerType === 'mouse') cancelPress();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (
        event.target !== control ||
        event.repeat ||
        !['Enter', ' '].includes(event.key)
      )
        return;
      heldKey = event.key;
      keyboardClickPending = true;
      startWave(null);
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.key !== heldKey) return;
      heldKey = null;
      stopWave();
      schedule(() => {
        keyboardClickPending = false;
      }, 0);
    }

    function onClick(event: MouseEvent) {
      if (event.detail !== 0 || keyboardClickPending || heldKey !== null)
        return;
      startWave(null);
      schedule(stopWave, 0);
    }

    control.addEventListener('pointerdown', onPointerDown);
    control.addEventListener('pointermove', onPointerMove);
    control.addEventListener('pointerleave', onPointerLeave);
    control.addEventListener('keydown', onKeyDown);
    control.addEventListener('click', onClick);
    control.addEventListener('blur', cancelPress);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', cancelPress);
    return () => {
      mounted = false;
      control.removeEventListener('pointerdown', onPointerDown);
      control.removeEventListener('pointermove', onPointerMove);
      control.removeEventListener('pointerleave', onPointerLeave);
      control.removeEventListener('keydown', onKeyDown);
      control.removeEventListener('click', onClick);
      control.removeEventListener('blur', cancelPress);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', cancelPress);
      timers.forEach(clearTimeout);
    };
  }, [disabled]);

  return (
    <span
      ref={layerRef}
      data-slot="ripple"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 block overflow-hidden rounded-[inherit] motion-reduce:hidden"
    >
      {waves.map(({ id, x, y, diameter, leaving }) => (
        <span
          key={id}
          className="absolute animate-ripple-enter opacity-30"
          style={{
            left: x - diameter / 2,
            top: y - diameter / 2,
            width: diameter,
            height: diameter,
          }}
        >
          <span
            className={`block size-full rounded-full bg-[var(--ripple-color,currentColor)] ${leaving ? 'animate-ripple-exit' : ''}`}
          />
        </span>
      ))}
    </span>
  );
}
