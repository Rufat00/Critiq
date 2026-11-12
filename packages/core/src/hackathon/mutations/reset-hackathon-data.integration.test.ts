import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

test(
  'owner resets preserve Overall and organizers and clean dependent data in PostgreSQL',
  { skip: process.env.CRITIQ_DB_INTEGRATION !== '1' },
  async () => {
    const { db } = await import('@critiq/db');
    const { resetHackathonData } = await import('./reset-hackathon-data');
    const { getHackathonSettings } =
      await import('../queries/get-hackathon-settings');
    const rollback = new Error(
      'Reset integration check complete; roll back all changes',
    );
    try {
      await db.$transaction(
        async (tx) => {
          const hackathon = await tx.hackathon.findFirstOrThrow();
          assert.equal(hackathon.status, 'DRAFT');
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
          assert.equal(
            (await getHackathonSettings(ctx, {})).canResetData,
            true,
          );
          const admin = await tx.user.create({
            data: {
              id: randomUUID(),
              email: `${randomUUID()}@example.com`,
              name: 'Reset test admin',
              role: 'ADMIN',
            },
          });
          assert.equal(
            (
              await getHackathonSettings(
                {
                  ...ctx,
                  actor: { type: 'user', userId: admin.id, role: 'ADMIN' },
                },
                {},
              )
            ).canResetData,
            false,
          );
          const judge = await tx.user.create({
            data: {
              id: randomUUID(),
              email: `${randomUUID()}@example.com`,
              name: 'Reset test judge',
              role: 'JUDGE',
            },
          });
          await tx.account.create({
            data: {
              id: randomUUID(),
              userId: judge.id,
              accountId: judge.id,
              providerId: 'credential',
            },
          });
          await tx.session.create({
            data: {
              id: randomUUID(),
              userId: judge.id,
              token: randomUUID(),
              expiresAt: new Date(Date.now() + 3600000),
            },
          });
          const category = await tx.judgingCategory.create({
            data: {
              hackathonId: hackathon.id,
              kind: 'TRACK',
              name: `Reset ${randomUUID()}`,
              track: { create: { hackathonId: hackathon.id } },
            },
            include: { track: true },
          });
          const room = await tx.room.create({
            data: {
              hackathonId: hackathon.id,
              name: `Reset room ${randomUUID()}`,
            },
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
              name: 'Reset test project',
              trackId: category.track!.id,
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
          const invitation = await tx.invitation.create({
            data: {
              hackathonId: hackathon.id,
              createdById: owner.id,
              redeemedById: judge.id,
              role: 'JUDGE',
              tokenHash: randomUUID(),
              expiresAt: new Date(Date.now() + 3600000),
              redemptions: { create: { userId: judge.id } },
            },
          });
          const adminInvitation = await tx.invitation.create({
            data: {
              hackathonId: hackathon.id,
              createdById: owner.id,
              role: 'ADMIN',
              tokenHash: randomUUID(),
              expiresAt: new Date(Date.now() + 3600000),
            },
          });
          const beforeAudits = await tx.auditLog.count({
            where: { action: 'hackathon.data.reset' },
          });
          await resetHackathonData(ctx, {
            section: 'judges',
            acknowledged: true,
          });
          assert.equal(await tx.user.count({ where: { role: 'JUDGE' } }), 0);
          assert.equal(
            await tx.session.count({ where: { userId: judge.id } }),
            0,
          );
          assert.equal(
            await tx.account.count({ where: { userId: judge.id } }),
            0,
          );
          assert.equal(
            await tx.invitation.count({ where: { id: invitation.id } }),
            0,
          );
          assert.ok(
            await tx.invitation.findUnique({
              where: { id: adminInvitation.id },
            }),
          );
          assert.ok(await tx.user.findUnique({ where: { id: owner.id } }));
          assert.ok(await tx.user.findUnique({ where: { id: admin.id } }));
          await resetHackathonData(ctx, {
            section: 'categories',
            acknowledged: true,
          });
          const overall = await tx.judgingCategory.findFirstOrThrow({
            where: { hackathonId: hackathon.id, kind: 'OVERALL' },
            include: { track: true },
          });
          assert.equal(
            await tx.judgingCategory.count({
              where: { hackathonId: hackathon.id },
            }),
            1,
          );
          assert.equal(overall.method, 'RELATIVE');
          assert.equal(
            (await tx.project.findUniqueOrThrow({ where: { id: project.id } }))
              .trackId,
            overall.track!.id,
          );
          await tx.project.update({
            where: { id: project.id },
            data: { roomId: room.id, tableNumber: 2 },
          });
          await tx.judgeCategory.create({
            data: {
              userId: admin.id,
              categoryId: overall.id,
              currentRoomId: room.id,
            },
          });
          await resetHackathonData(ctx, {
            section: 'rooms',
            acknowledged: true,
          });
          const unplaced = await tx.project.findUniqueOrThrow({
            where: { id: project.id },
          });
          assert.equal(unplaced.roomId, null);
          assert.equal(unplaced.tableNumber, null);
          assert.equal(
            (
              await tx.judgeCategory.findUniqueOrThrow({
                where: {
                  userId_categoryId: {
                    userId: admin.id,
                    categoryId: overall.id,
                  },
                },
              })
            ).currentRoomId,
            null,
          );
          assert.equal(
            await tx.room.count({ where: { hackathonId: hackathon.id } }),
            0,
          );
          await resetHackathonData(ctx, {
            section: 'projects',
            acknowledged: true,
          });
          assert.equal(
            await tx.project.count({ where: { hackathonId: hackathon.id } }),
            0,
          );
          assert.equal(
            await tx.auditLog.count({
              where: { action: 'hackathon.data.reset' },
            }),
            beforeAudits + 4,
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
