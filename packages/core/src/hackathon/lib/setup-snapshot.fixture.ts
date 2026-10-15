import type { SetupSnapshot } from './read-setup-snapshot';

export function snapshot(): SetupSnapshot {
  return {
    hackathon: {
      id: 'event',
      name: 'RowdyHacks',
      status: 'DRAFT',
      scoreScale: 5,
      setupCompletions: [],
      rooms: [],
      invitations: [],
      projects: [
        {
          id: 'project',
          name: 'Project',
          isActive: true,
          isDisqualified: false,
          roomId: null,
          tableNumber: null,
          trackId: null,
          challenges: [],
        },
      ],
      categories: [
        {
          id: 'overall',
          name: 'Overall',
          kind: 'OVERALL',
          isEnabled: true,
          isVisible: true,
          method: 'RELATIVE',
          judges: [{ userId: 'judge', isActive: true }],
          rubric: null,
          track: null,
          challenge: null,
          minEvaluations: 4,
          targetEvaluations: null,
          timerSeconds: 300,
        },
      ],
    },
    judges: [{ id: 'judge', name: 'Judge', isActive: true, conflicts: [] }],
  } as unknown as SetupSnapshot;
}
