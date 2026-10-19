export function debounce<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  function cancel() {
    clearTimeout(timer);
    timer = undefined;
  }
  function schedule(...args: TArgs) {
    cancel();
    timer = setTimeout(() => {
      timer = undefined;
      callback(...args);
    }, delay);
  }
  return Object.assign(schedule, {
    cancel,
    isPending: () => timer !== undefined,
  });
}
