import assert from 'node:assert/strict';
import { test } from 'node:test';

test(
  'settings persist with an audit in PostgreSQL and roll back together',
  { skip: process.env.CRITIQ_DB_INTEGRATION !== '1' },
  async () => {
    const { db } = await import('@critiq/db');
    const { updateHackathonSettings } =
      await import('./update-hackathon-settings');
    const { getHackathonSettings } =
      await import('../queries/get-hackathon-settings');
    const rollback = new Error('Settings integration check complete');
    try {
      await db.$transaction(async (tx) => {
        const hackathon = await tx.hackathon.findFirstOrThrow();
        assert.equal(
          hackathon.status,
          'DRAFT',
          'Integration checks require a draft development event.',
        );
        const owner = await tx.user.findFirstOrThrow({
          where: { role: 'OWNER' },
        });
        const ctx = {
          db: tx,
          hackathonId: hackathon.id,
          actor: { type: 'user' as const, userId: owner.id, role: owner.role },
          source: 'web-action' as const,
          request: { ipAddress: null, userAgent: null },
        };
        const beforeAudits = await tx.auditLog.count({
          where: { action: 'hackathon.settings.update' },
        });
        for (const roomSwitchPercent of [0, 35, 100]) {
          await updateHackathonSettings(ctx, {
            name: 'Settings integration check',
            scoreScale: hackathon.scoreScale as 5 | 10,
            roomSwitchPercent,
          });
          const saved = await getHackathonSettings(ctx, {});
          assert.equal(saved.name, 'Settings integration check');
          assert.equal(saved.roomSwitchPercent, roomSwitchPercent);
        }
        assert.equal(
          await tx.auditLog.count({
            where: { action: 'hackathon.settings.update' },
          }),
          beforeAudits + 3,
        );
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await db.$disconnect();
    }
  },
);
