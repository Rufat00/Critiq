// The planner still estimates visit costs, but an open-ended event has no time
// budget. Allow each judge enough planning capacity to visit every project once.
export function getFullCoveragePlanningMinutes(input: {
  projectCount: number;
  presentationMinutes: number;
  questionsMinutes: number;
  formMinutes: number[];
  travelMinutes: number;
  reservePercent: number;
}) {
  const visitMinutes =
    input.presentationMinutes +
    input.questionsMinutes +
    input.formMinutes.reduce((sum, minutes) => sum + minutes, 0) +
    input.travelMinutes;
  return (
    Math.max(1, input.projectCount * visitMinutes) /
    (1 - input.reservePercent / 100)
  );
}
