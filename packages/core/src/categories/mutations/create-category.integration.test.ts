import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

test(
  'category creation persists subtypes, rubric percentages, and audits atomically in PostgreSQL',
  { skip: process.env.CRITIQ_DB_INTEGRATION !== '1' },
  async () => {
    const { db } = await import('@critiq/db');
    const { createCategory } = await import('./create-category');
    const rollback = new Error('Category creation check complete');
    try {
      await db.$transaction(async (tx) => {
        const hackathon = await tx.hackathon.findFirstOrThrow();
        assert.equal(
          hackathon.status,
          'DRAFT',
          'Use a draft development hackathon for this check.',
        );
        const organizer = await tx.user.findFirstOrThrow({
          where: { role: { in: ['OWNER', 'ADMIN'] }, isActive: true },
          select: { id: true, role: true },
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
        const track = await createCategory(ctx, {
          kind: 'TRACK',
          name: `Track check ${randomUUID()}`,
          method: 'RELATIVE',
        });
        const trackRow = await tx.track.findUniqueOrThrow({
          where: { categoryId: track.id },
        });
        assert.equal(trackRow.hackathonId, hackathon.id);
        assert.equal(trackRow.disqualifiesFromOverall, true);
        const challenge = await createCategory(ctx, {
          kind: 'CHALLENGE',
          name: `Challenge check ${randomUUID()}`,
          method: 'RATING_SCALE',
        });
        assert.equal(
          (
            await tx.challenge.findUniqueOrThrow({
              where: { categoryId: challenge.id },
            })
          ).includesOverall,
          true,
        );
        const rubric = await createCategory(ctx, {
          kind: 'CHALLENGE',
          name: `Rubric check ${randomUUID()}`,
          method: 'RUBRIC',
          criteria: [
            { name: 'Impact', weight: 20 },
            { name: 'Execution', weight: 80 },
          ],
        });
        const rubricRow = await tx.rubric.findUniqueOrThrow({
          where: { categoryId: rubric.id },
          include: { criteria: { orderBy: { position: 'asc' } } },
        });
        assert.deepEqual(
          rubricRow.criteria.map((item) => ({
            name: item.name,
            weight: item.weight.toNumber(),
            position: item.position,
          })),
          [
            { name: 'Impact', weight: 20, position: 0 },
            { name: 'Execution', weight: 80, position: 1 },
          ],
        );
        const limited = await createCategory(ctx, {
          kind: 'CHALLENGE',
          name: `Limited challenge ${randomUUID()}`,
          method: 'RATING_SCALE',
          includesOverall: false,
          trackIds: [trackRow.id],
        });
        const limitedRow = await tx.challenge.findUniqueOrThrow({
          where: { categoryId: limited.id },
          include: { allowedTracks: true },
        });
        assert.equal(limitedRow.includesOverall, false);
        assert.deepEqual(
          limitedRow.allowedTracks.map((link) => link.trackId),
          [trackRow.id],
        );
        const globalRow = await tx.challenge.findUniqueOrThrow({
          where: { categoryId: challenge.id },
        });
        const linkedTrack = await createCategory(ctx, {
          kind: 'TRACK',
          name: `Linked track ${randomUUID()}`,
          method: 'RELATIVE',
          challengeIds: [limitedRow.id, globalRow.id],
        });
        const linkedTrackRow = await tx.track.findUniqueOrThrow({
          where: { categoryId: linkedTrack.id },
          include: { allowedChallenges: true },
        });
        assert.deepEqual(
          linkedTrackRow.allowedChallenges
            .map((link) => link.challengeId)
            .sort(),
          [limitedRow.id, globalRow.id].sort(),
        );
        const { getJudgingCategories } =
          await import('../queries/get-judging-categories');
        const overview = await getJudgingCategories(ctx, {});
        assert.deepEqual(
          overview.challenges
            .find((item) => item.id === limited.id)!
            .trackIds.sort(),
          [track.id, linkedTrack.id].sort(),
        );
        assert.ok(
          !overview.challenges
            .find((item) => item.id === challenge.id)!
            .trackIds.includes(track.id),
        );
        const overallCategory = await tx.judgingCategory.findFirstOrThrow({
          where: { hackathonId: hackathon.id, kind: 'OVERALL' },
        });
        assert.ok(
          overview.challenges
            .find((item) => item.id === challenge.id)!
            .trackIds.includes(overallCategory.id),
        );
        assert.ok(
          overview.challenges
            .find((item) => item.id === challenge.id)!
            .trackIds.includes(linkedTrack.id),
        );
        assert.equal(
          await tx.auditLog.count({
            where: {
              action: 'categories.create',
              entityId: {
                in: [
                  track.id,
                  challenge.id,
                  rubric.id,
                  limited.id,
                  linkedTrack.id,
                ],
              },
              hackathonId: hackathon.id,
              actorId: organizer.id,
            },
          }),
          5,
        );
        const { setChallengeTrack } = await import('./set-challenge-track');
        const membership = {
          trackCategoryId: track.id,
          challengeCategoryId: challenge.id,
          included: true,
        };
        await setChallengeTrack(ctx, membership);
        assert.ok(
          await tx.challengeTrack.findUnique({
            where: {
              challengeId_trackId: {
                challengeId: globalRow.id,
                trackId: trackRow.id,
              },
            },
          }),
        );
        const project = await tx.project.create({
          data: {
            hackathonId: hackathon.id,
            name: `Membership check ${randomUUID()}`,
            trackId: trackRow.id,
          },
        });
        await tx.projectChallenge.create({
          data: { projectId: project.id, challengeId: globalRow.id },
        });
        await assert.rejects(
          setChallengeTrack(ctx, { ...membership, included: false }),
          (error: unknown) =>
            !!error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'CONFLICT',
        );
        await tx.projectChallenge.delete({
          where: {
            projectId_challengeId: {
              projectId: project.id,
              challengeId: globalRow.id,
            },
          },
        });
        await setChallengeTrack(ctx, { ...membership, included: false });
        assert.equal(
          await tx.challengeTrack.findUnique({
            where: {
              challengeId_trackId: {
                challengeId: globalRow.id,
                trackId: trackRow.id,
              },
            },
          }),
          null,
        );
        const overallMembership = {
          ...membership,
          trackCategoryId: overallCategory.id,
          included: false,
        };
        await setChallengeTrack(ctx, overallMembership);
        assert.equal(
          (
            await tx.challenge.findUniqueOrThrow({
              where: { id: globalRow.id },
            })
          ).includesOverall,
          false,
        );
        await setChallengeTrack(ctx, { ...overallMembership, included: true });
        assert.equal(
          (
            await tx.challenge.findUniqueOrThrow({
              where: { id: globalRow.id },
            })
          ).includesOverall,
          true,
        );
        assert.equal(
          await tx.auditLog.count({
            where: {
              action: 'categories.set-challenge-track',
              entityId: challenge.id,
              hackathonId: hackathon.id,
              actorId: organizer.id,
            },
          }),
          4,
        );
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
      console.info(
        'Category creation, membership toggles, entry protection, and audits passed. All temporary changes rolled back.',
      );
    } finally {
      await db.$disconnect();
    }
  },
);
