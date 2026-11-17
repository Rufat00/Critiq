import type { HackathonSetupSummary } from '@critiq/core/hackathon';

export type HackathonStage = HackathonSetupSummary['status'];
export const stageLabels: Record<HackathonStage, string> = {
  DRAFT: 'Draft',
  READY: 'Ready',
  JUDGING: 'Judging',
  PAUSED: 'Paused',
  DELIBERATION: 'Results review',
  COMPLETED: 'Completed',
};
export function getStageNavigation(stage: HackathonStage) {
  const reviewing = stage === 'DELIBERATION';
  const completed = stage === 'COMPLETED';
  const live = stage === 'JUDGING' || stage === 'PAUSED';
  return {
    main: [
      'Home',
      ...(reviewing || completed ? ['Results'] : []),
      ...(completed ? ['Analytics'] : []),
      'Projects',
      'Judges',
      ...(live || reviewing ? ['Flags'] : []),
      ...(reviewing || completed ? ['Activity'] : []),
    ],
    configuration: true,
    configurationLocked: stage !== 'DRAFT',
    lockReason:
      stage === 'READY'
        ? undefined
        : 'Competition settings are read-only after judging starts.',
  };
}
