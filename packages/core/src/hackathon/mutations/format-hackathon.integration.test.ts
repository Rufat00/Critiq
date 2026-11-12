import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

test(
  'format clears a judged event, preserves owner access and claim, and allows event setup again',
  { skip: process.env.CRITIQ_DB_INTEGRATION !== '1' },
  async () => {
    const { db } = await import('@critiq/db');
    const { formatHackathon } = await import('./format-hackathon');
    const { completeSetup } =
      await import('../../setup/mutations/complete-setup');
    const { getEntryState } =
      await import('../../registration/queries/get-entry-state');
    const rollback = new Error(
      'Format integration check complete; roll back all changes',
    );
    try {
      await db.$transaction(
        async (tx) => {
          const hackathon = await tx.hackathon.findFirstOrThrow();
          const installation = await tx.installation.findUniqueOrThrow({
            where: { id: 1 },
          });
          const owner = await tx.user.findFirstOrThrow({
            where: { role: 'OWNER' },
          });
          const ctx = {
            db: tx,
            hackathonId: hackathon.id,
            actor: {
              type: 'user' as const,
              userId: owner.id,
              role: owner.role,
            },
            source: 'web-action' as const,
            request: { ipAddress: null, userAgent: null },
          };
          const ownerSession = await tx.session.create({
            data: {
              id: randomUUID(),
              userId: owner.id,
              token: randomUUID(),
              expiresAt: new Date(Date.now() + 3600000),
            },
          });
          const admin = await tx.user.create({
            data: {
              id: randomUUID(),
              email: `${randomUUID()}@example.com`,
              name: 'Format admin',
              role: 'ADMIN',
            },
          });
          const judge = await tx.user.create({
            data: {
              id: randomUUID(),
              email: `${randomUUID()}@example.com`,
              name: 'Format judge',
              role: 'JUDGE',
            },
          });
          for (const user of [admin, judge]) {
            await tx.session.create({
              data: {
                id: randomUUID(),
                userId: user.id,
                token: randomUUID(),
                expiresAt: new Date(Date.now() + 3600000),
              },
            });
            await tx.account.create({
              data: {
                id: randomUUID(),
                userId: user.id,
                accountId: user.id,
                providerId: 'credential',
              },
            });
          }
          const category = await tx.judgingCategory.create({
            data: {
              hackathonId: hackathon.id,
              name: `Format ${randomUUID()}`,
              kind: 'TRACK',
              method: 'RUBRIC',
              startedAt: new Date(),
              status: 'COMPLETED',
              track: { create: { hackathonId: hackathon.id } },
              rubric: {
                create: {
                  isLocked: true,
                  criteria: { create: { name: 'Quality', position: 0 } },
                },
              },
            },
            include: { track: true, rubric: { include: { criteria: true } } },
          });
          const room = await tx.room.create({
            data: { hackathonId: hackathon.id, name: randomUUID() },
          });
          await tx.trackRoom.create({
            data: {
              trackId: category.track!.id,
              roomId: room.id,
              capacity: 5,
            },
          });
          const project = await tx.project.create({
            data: {
              hackathonId: hackathon.id,
              trackId: category.track!.id,
              name: 'Judged project',
              roomId: room.id,
              tableNumber: 1,
            },
          });
          await tx.judgeCategory.create({
            data: {
              userId: judge.id,
              categoryId: category.id,
              currentRoomId: room.id,
            },
          });
          const assignment = await tx.judgingAssignment.create({
            data: {
              categoryId: category.id,
              projectId: project.id,
              judgeId: judge.id,
              status: 'COMPLETED',
            },
          });
          await tx.evaluation.create({
            data: {
              assignmentId: assignment.id,
              categoryId: category.id,
              projectId: project.id,
              judgeId: judge.id,
              scores: {
                create: {
                  criterionId: category.rubric!.criteria[0]!.id,
                  score: 5,
                },
              },
            },
          });
          await tx.projectFlag.create({
            data: {
              projectId: project.id,
              reportedById: judge.id,
              type: 'OTHER',
            },
          });
          await tx.invitation.create({
            data: {
              hackathonId: hackathon.id,
              createdById: admin.id,
              redeemedById: judge.id,
              role: 'JUDGE',
              tokenHash: randomUUID(),
              expiresAt: new Date(Date.now() + 3600000),
            },
          });
          await tx.hackathon.update({
            where: { id: hackathon.id },
            data: {
              name: 'Format test',
              status: 'COMPLETED',
              scoreScale: 10,
              roomSwitchPercent: 80,
            },
          });
          await formatHackathon(ctx, {
            eventName: 'Format test',
            acknowledged: true,
          });
          assert.deepEqual(
            (await tx.user.findMany({ select: { id: true } })).map(
              (user) => user.id,
            ),
            [owner.id],
          );
          assert.ok(
            await tx.session.findUnique({ where: { id: ownerSession.id } }),
          );
          assert.equal(
            await tx.session.count({ where: { userId: { not: owner.id } } }),
            0,
          );
          assert.equal(
            await tx.account.count({ where: { userId: { not: owner.id } } }),
            0,
          );
          for (const count of [
            tx.project.count(),
            tx.room.count(),
            tx.invitation.count(),
            tx.evaluation.count(),
            tx.judgingAssignment.count(),
            tx.rubric.count(),
            tx.judgeCategory.count(),
            tx.trackRoom.count(),
          ])
            assert.equal(await count, 0);
          const reset = await tx.hackathon.findUniqueOrThrow({
            where: { id: hackathon.id },
          });
          assert.equal(reset.name, null);
          assert.equal(reset.status, 'DRAFT');
          assert.equal(reset.scoreScale, 5);
          assert.equal(reset.roomSwitchPercent, 25);
          assert.equal(await tx.judgingCategory.count(), 1);
          const overall = await tx.judgingCategory.findFirstOrThrow({
            where: { hackathonId: hackathon.id, kind: 'OVERALL' },
          });
          assert.equal(overall.name, 'Overall');
          assert.equal(overall.method, 'RELATIVE');
          assert.deepEqual(
            (await tx.installation.findUniqueOrThrow({ where: { id: 1 } }))
              .claimedAt,
            installation.claimedAt,
          );
          assert.equal(
            (await getEntryState(ctx, {})).configurationRequired,
            true,
          );
          await completeSetup(ctx, { name: 'Started again' });
          assert.equal(
            (await getEntryState(ctx, {})).configurationRequired,
            false,
          );
          throw rollback;
        },
        { timeout: 20000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await db.$disconnect();
    }
  },
);
