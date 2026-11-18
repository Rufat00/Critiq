export function presentationElapsedSeconds(
  timer: {
    timerElapsedSeconds: number;
    timerRunningSince: Date | null;
  },
  now: Date,
) {
  return (
    timer.timerElapsedSeconds +
    (timer.timerRunningSince
      ? Math.max(
          0,
          Math.floor(
            (now.getTime() - timer.timerRunningSince.getTime()) / 1000,
          ),
        )
      : 0)
  );
}
