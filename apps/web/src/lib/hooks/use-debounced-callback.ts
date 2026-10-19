'use client';

import { useEffect, useMemo, useRef } from 'react';
import { debounce } from '@/lib/debounce';

export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay = 300,
) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  }, [callback]);
  const debounced = useMemo(
    () => debounce((...args: TArgs) => latest.current(...args), delay),
    [delay],
  );
  useEffect(() => () => debounced.cancel(), [debounced]);
  return debounced;
}
