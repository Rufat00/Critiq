import { parseArgs } from 'node:util';
import { db } from '@critiq/db';

class DevelopmentResetError extends Error {}
const { values } = parseArgs({ options: { 'event-name': { type: 'string' } } });
try {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw new DevelopmentResetError(
      'Judging reset is restricted to a local development database.',
    );
  }
  if (!values['event-name'])
    throw new DevelopmentResetError(
      'Provide --event-name with the exact current event name.',
    );
  const result = await db.$transaction(
    async (tx) => {
      const event = await tx.hackathon.findFirstOrThrow();
      // Use the event row lock shared by scoring, assignment, and stage changes.
      await tx.hackathon.update({
        where: { id: event.id },
        data: { updatedAt: new Date() },
      });
      const current = await tx.hackathon.findUniqueOrThrow({
        where: { id: event.id },
      });
      if (current.name !== values['event-name'])
        throw new DevelopmentResetError(
          'The event name does not match. Nothing was reset.',
        );
      const scope = { category: { hackathonId: event.id } };
      const before = {
        status: current.status,
        evaluations: await tx.evaluation.count({ where: scope }),
        visits: await tx.judgingVisit.count({
          where: { hackathonId: event.id },
        }),
      };
      await tx.competitionResultSnapshot.deleteMany({ where: scope });
      await tx.relativeRanking.deleteMany({ where: scope });
      await tx.rankingRevision.deleteMany({ where: scope });
      // Assignments without physical visits are cleared too; evaluations/scores cascade.
      await tx.judgingAssignment.deleteMany({ where: scope });
      await tx.judgingVisit.deleteMany({ where: { hackathonId: event.id } });
      await tx.roomStayEpoch.deleteMany({ where: { hackathonId: event.id } });
      await tx.judgingConfiguration.deleteMany({
        where: { hackathonId: event.id },
      });
      await tx.projectFlag.deleteMany({
        where: { project: { hackathonId: event.id } },
      });
      await tx.judgeCategory.updateMany({
        where: scope,
        data: { currentRoomId: null },
      });
      await tx.user.updateMany({
        where: { role: 'JUDGE', categoryMemberships: { some: scope } },
        data: { isJudgingAvailable: true },
      });
      await tx.rubric.updateMany({ where: scope, data: { isLocked: false } });
      await tx.judgingCategory.updateMany({
        where: { hackathonId: event.id },
        data: {
          status: 'NOT_STARTED',
          startedAt: null,
          endedAt: null,
          targetEvaluations: null,
        },
      });
      await tx.hackathon.update({
        where: { id: event.id },
        data: { status: 'READY', judgingPausedAt: null },
      });
      await tx.auditLog.create({
        data: {
          hackathonId: event.id,
          action: 'judging.development.reset',
          entityType: 'Hackathon',
          entityId: event.id,
          metadata: {
            source: 'worker',
            before,
            after: { status: 'READY' },
            setupPreserved: true,
          },
        },
      });
      return { name: event.name, ...before };
    },
    { timeout: 30000 },
  );
  console.log(
    `Returned ${result.name} to READY. Cleared ${result.evaluations} evaluations and ${result.visits} visits. Event setup and judge accounts were preserved.`,
  );
} catch (error) {
  console.error(
    error instanceof DevelopmentResetError
      ? error.message
      : 'Unable to reset development judging. The reset transaction was rolled back.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
