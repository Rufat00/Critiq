import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (error: unknown) =>
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === code,
  );

test(
  'category editing persists rubrics and memberships, protects entries and Overall, and audits changes in PostgreSQL',
  { skip: process.env.CRITIQ_DB_INTEGRATION !== '1' },
  async () => {
    const { db } = await import('@critiq/db');
    const { createCategory } = await import('./create-category');
    const { updateCategory } = await import('./update-category');
    const { getJudgingCategories } =
      await import('../queries/get-judging-categories');
    const rollback = new Error('Editing verification complete');
    try {
      await db.$transaction(
        async (tx) => {
          const hackathon = await tx.hackathon.findFirstOrThrow();
          assert.equal(hackathon.status, 'DRAFT');
          const organizer = await tx.user.findFirstOrThrow({
            where: { role: { in: ['OWNER', 'ADMIN'] }, isActive: true },
          });
          const ctx = {
            db: tx,
            hackathonId: hackathon.id,
            actor: {
              type: 'user' as const,
              userId: organizer.id,
              role: organizer.role,
            },
            source: 'web-action' as const,
            request: { ipAddress: null, userAgent: null },
          };
          const name = (label: string) => `${label} ${randomUUID()}`;
          const track = await createCategory(ctx, {
            kind: 'TRACK',
            name: name('Track'),
            method: 'RELATIVE',
          });
          const trackRow = await tx.track.findUniqueOrThrow({
            where: { categoryId: track.id },
          });
          const challenge = await createCategory(ctx, {
            kind: 'CHALLENGE',
            name: name('Challenge'),
            method: 'RATING_SCALE',
          });
          const challengeRow = await tx.challenge.findUniqueOrThrow({
            where: { categoryId: challenge.id },
          });
          const base = {
            categoryId: challenge.id,
            kind: 'CHALLENGE' as const,
            name: challenge.name,
            method: 'RATING_SCALE' as const,
            includesOverall: true,
            trackIds: [trackRow.id],
          };
          await updateCategory(ctx, base);
          assert.ok(
            await tx.challengeTrack.findUnique({
              where: {
                challengeId_trackId: {
                  challengeId: challengeRow.id,
                  trackId: trackRow.id,
                },
              },
            }),
          );
          const project = await tx.project.create({
            data: {
              hackathonId: hackathon.id,
              name: name('Project'),
              trackId: trackRow.id,
              challenges: { create: { challengeId: challengeRow.id } },
            },
          });
          await rejects(
            updateCategory(ctx, {
              ...base,
              trackIds: [],
              name: name('Rejected edit'),
            }),
            'CONFLICT',
          );
          await rejects(
            updateCategory(ctx, {
              categoryId: track.id,
              kind: 'TRACK',
              name: track.name,
              method: 'RELATIVE',
              challengeIds: [],
            }),
            'CONFLICT',
          );
          assert.equal(
            (
              await tx.judgingCategory.findUniqueOrThrow({
                where: { id: challenge.id },
              })
            ).name,
            challenge.name,
          );
          await rejects(
            updateCategory(ctx, { ...base, name: track.name.toUpperCase() }),
            'CONFLICT',
          );
          await rejects(
            updateCategory(ctx, { ...base, trackIds: ['foreign-track'] }),
            'NOT_FOUND',
          );
          const rubricInput = {
            ...base,
            description: 'Optional description',
            method: 'RUBRIC' as const,
            criteria: [
              { name: 'Impact', weight: 20 },
              { name: 'Execution', weight: 80 },
            ],
          };
          await updateCategory(ctx, rubricInput);
          const rubric = await tx.rubric.findUniqueOrThrow({
            where: { categoryId: challenge.id },
            include: { criteria: { orderBy: { position: 'asc' } } },
          });
          assert.deepEqual(
            rubric.criteria.map((item) => ({
              name: item.name,
              weight: item.weight.toNumber(),
            })),
            rubricInput.criteria,
          );
          const overview = await getJudgingCategories(ctx, {});
          assert.deepEqual(
            overview.challenges
              .find((item) => item.id === challenge.id)!
              .criteria.map(({ name, weight }) => ({ name, weight })),
            rubricInput.criteria,
          );
          await updateCategory(ctx, {
            ...rubricInput,
            description: 'Details only',
          });
          assert.deepEqual(
            (
              await tx.rubricCriterion.findMany({
                where: { rubricId: rubric.id },
                orderBy: { position: 'asc' },
              })
            ).map((item) => item.id),
            rubric.criteria.map((item) => item.id),
          );
          await tx.rubric.update({
            where: { id: rubric.id },
            data: { isLocked: true },
          });
          await rejects(updateCategory(ctx, base), 'INVALID_STATE');
          await updateCategory(ctx, {
            ...rubricInput,
            description: 'Locked rubric, updated details',
          });
          await tx.rubric.update({
            where: { id: rubric.id },
            data: { isLocked: false },
          });
          await updateCategory(ctx, {
            ...rubricInput,
            criteria: [{ name: 'Quality', weight: 100 }],
          });
          assert.equal(
            await tx.rubricCriterion.count({
              where: { rubric: { categoryId: challenge.id } },
            }),
            1,
          );
          await updateCategory(ctx, base);
          assert.equal(
            await tx.rubric.count({ where: { categoryId: challenge.id } }),
            0,
          );
          await tx.projectChallenge.delete({
            where: {
              projectId_challengeId: {
                projectId: project.id,
                challengeId: challengeRow.id,
              },
            },
          });
          await updateCategory(ctx, { ...base, trackIds: [] });
          assert.equal(
            await tx.challengeTrack.count({
              where: { challengeId: challengeRow.id },
            }),
            0,
          );
          await updateCategory(ctx, {
            categoryId: track.id,
            kind: 'TRACK',
            name: track.name,
            method: 'RELATIVE',
            challengeIds: [challengeRow.id],
          });
          assert.equal(
            await tx.challengeTrack.count({
              where: { challengeId: challengeRow.id, trackId: trackRow.id },
            }),
            1,
          );
          const overall = await tx.judgingCategory.findFirstOrThrow({
            where: { hackathonId: hackathon.id, kind: 'OVERALL' },
          });
          const overallChallenges = await tx.challenge.findMany({
            where: { hackathonId: hackathon.id, includesOverall: true },
          });
          const overallInput = {
            categoryId: overall.id,
            kind: 'TRACK' as const,
            name: overall.name,
            method: 'RELATIVE' as const,
            challengeIds: overallChallenges
              .filter((item) => item.id !== challengeRow.id)
              .map((item) => item.id),
          };
          const overallProject = await tx.project.create({
            data: {
              hackathonId: hackathon.id,
              name: name('Overall project'),
              challenges: { create: { challengeId: challengeRow.id } },
            },
          });
          await rejects(updateCategory(ctx, overallInput), 'CONFLICT');
          await tx.projectChallenge.delete({
            where: {
              projectId_challengeId: {
                projectId: overallProject.id,
                challengeId: challengeRow.id,
              },
            },
          });
          await updateCategory(ctx, overallInput);
          assert.equal(
            (
              await tx.challenge.findUniqueOrThrow({
                where: { id: challengeRow.id },
              })
            ).includesOverall,
            false,
          );
          await updateCategory(ctx, {
            ...overallInput,
            challengeIds: [...overallInput.challengeIds, challengeRow.id],
          });
          assert.equal(
            (
              await tx.challenge.findUniqueOrThrow({
                where: { id: challengeRow.id },
              })
            ).includesOverall,
            true,
          );
          assert.equal(
            (
              await tx.judgingCategory.findUniqueOrThrow({
                where: { id: overall.id },
              })
            ).kind,
            'OVERALL',
          );
          assert.equal(
            (await tx.track.findUniqueOrThrow({ where: { id: trackRow.id } }))
              .disqualifiesFromOverall,
            true,
          );
          const audits = await tx.auditLog.findMany({
            where: { action: 'categories.update', entityId: challenge.id },
          });
          assert.equal(audits.length, 7);
          assert.equal(audits[0]!.actorId, organizer.id);
          throw rollback;
        },
        { timeout: 15000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await db.$disconnect();
    }
  },
);
