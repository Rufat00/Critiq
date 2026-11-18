import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import type { AppContext } from '../../context';

test(
  '40 NPC judges run the actual timer and scoring workflows concurrently',
  { skip: process.env.CRITIQ_JUDGING_INTEGRATION !== '1', timeout: 120000 },
  async () => {
    assert.ok(
      new URL(process.env.DATABASE_URL!).pathname.startsWith(
        '/critiq_judging_test_',
      ),
    );
    const { db } = await import('@critiq/db');
    const { configureJudging } = await import('../index');
    const { startHackathonJudging } =
      await import('../../hackathon/mutations/start-hackathon-judging');
    const event = await db.hackathon.findFirstOrThrow();
    const owner = await db.user.create({
      data: {
        id: randomUUID(),
        name: 'NPC test organizer',
        email: 'npc-test-owner@critiq.invalid',
        role: 'OWNER',
      },
    });
    const overall = await db.judgingCategory.findFirstOrThrow({
      where: { hackathonId: event.id, kind: 'OVERALL' },
      include: { track: true },
    });
    const beginner = await db.judgingCategory.create({
      data: {
        hackathonId: event.id,
        kind: 'TRACK',
        name: 'Beginner',
        method: 'RUBRIC',
        track: { create: { hackathonId: event.id } },
        rubric: {
          create: {
            criteria: {
              create: [
                { name: 'Execution', weight: 1, position: 0 },
                { name: 'Impact', weight: 1, position: 1 },
              ],
            },
          },
        },
      },
      include: { track: true },
    });
    const tracks = [overall, beginner];
    const challenge = await db.judgingCategory.create({
      data: {
        hackathonId: event.id,
        kind: 'CHALLENGE',
        name: 'NPC challenge',
        method: 'RATING_SCALE',
        challenge: {
          create: {
            hackathonId: event.id,
            allowedTracks: {
              create: tracks.map((t) => ({ trackId: t.track!.id })),
            },
          },
        },
      },
      include: { challenge: true },
    });
    for (const [index, track] of tracks.entries()) {
      const room = await db.room.create({
        data: { hackathonId: event.id, name: `Room ${index + 1}` },
      });
      await db.trackRoom.create({
        data: { trackId: track.track!.id, roomId: room.id, capacity: 6 },
      });
      for (let project = 0; project < 6; project++)
        await db.project.create({
          data: {
            hackathonId: event.id,
            trackId: track.track!.id,
            roomId: room.id,
            tableNumber: index * 6 + project + 1,
            name: `NPC project ${index}-${project}`,
            challenges: { create: { challengeId: challenge.challenge!.id } },
          },
        });
    }
    await db.hackathon.update({
      where: { id: event.id },
      data: { name: 'NPC simulation test', status: 'READY' },
    });
    const run = (...args: string[]) => {
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          './packages/db/node_modules/tsx/dist/loader.mjs',
          'packages/core/scripts/run-npc-judges.ts',
          ...args,
        ],
        {
          cwd: process.cwd(),
          env: process.env,
          encoding: 'utf8',
          timeout: 90000,
        },
      );
      assert.equal(
        result.status,
        0,
        `${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`,
      );
      return result;
    };
    run('--judges', '40', '--prepare-only');
    const judges = await db.user.findMany({
      where: { id: { startsWith: 'critiq-npc-judge-' } },
    });
    assert.equal(judges.length, 40);
    for (const judge of judges) {
      const memberships = await db.judgeCategory.findMany({
        where: { userId: judge.id, isActive: true },
        include: { category: true },
      });
      assert.equal(
        memberships.filter((m) => m.category.kind !== 'CHALLENGE').length,
        1,
      );
      assert.equal(
        memberships.filter((m) => m.category.kind === 'CHALLENGE').length,
        1,
      );
    }
    const ctx: AppContext = {
      db,
      hackathonId: event.id,
      actor: { type: 'user', userId: owner.id, role: 'OWNER' },
      source: 'worker',
      request: { ipAddress: null, userAgent: 'NPC integration test' },
    };
    await configureJudging(ctx, {
      expectedRevision: 0,
      judges: judges.map((j) => ({ judgeId: j.id })),
      categories: [...tracks, challenge].map((c) => ({
        categoryId: c.id,
        minimumEvaluations: 2,
        desiredEvaluations: 3,
        maximumEvaluations: 4,
      })),
      minRoomCompletionPercent: 0,
    });
    await startHackathonJudging(ctx, {});
    run(
      '--judges',
      '40',
      '--presentation-seconds',
      '0',
      '--stagger-seconds',
      '0',
      '--score-delay-ms',
      '0',
      '--poll-ms',
      '50',
      '--idle-ms',
      '100',
      '--max-visits',
      '1',
    );
    const visits = await db.judgingVisit.findMany({
      where: { hackathonId: event.id },
      include: { assignments: { include: { evaluation: true } } },
    });
    assert.equal(visits.length, 40);
    assert.equal(new Set(visits.map((v) => v.judgeId)).size, 40);
    assert.ok(
      visits.every(
        (v) =>
          v.status === 'COMPLETED' &&
          v.timerStartedAt &&
          v.presentationFinishedAt,
      ),
    );
    assert.ok(
      visits.every((v) =>
        v.assignments.every((a) => a.status === 'COMPLETED' && a.evaluation),
      ),
    );
    const coverage = await db.evaluation.groupBy({
      by: ['projectId', 'categoryId'],
      where: { category: { hackathonId: event.id }, isExcluded: false },
      _count: true,
    });
    assert.ok(coverage.length <= 24);
    assert.ok(coverage.every((c) => c._count >= 1 && c._count <= 4));
    const initialEvaluations = await db.evaluation.count();
    // Challenge access can produce challenge-only visits outside a judge's primary track.
    assert.ok(initialEvaluations >= 40 && initialEvaluations <= 80);
    assert.ok((await db.evaluationScore.count()) > 0);
    assert.ok((await db.relativeRanking.count()) > 0);
    assert.ok(
      (await db.evaluation.count({ where: { ordinalRating: { not: null } } })) >
        0,
    );
    run(
      '--judges',
      '40',
      '--presentation-seconds',
      '0',
      '--stagger-seconds',
      '0',
      '--score-delay-ms',
      '0',
      '--poll-ms',
      '50',
      '--idle-ms',
      '100',
      '--stop-when-idle',
    );
    const finalCoverage = await db.evaluation.groupBy({
      by: ['projectId', 'categoryId'],
      where: { category: { hackathonId: event.id }, isExcluded: false },
      _count: true,
    });
    assert.equal(finalCoverage.length, 24);
    assert.ok(
      finalCoverage.every((c) => c._count === 4),
      JSON.stringify(finalCoverage),
    );
    assert.equal(
      await db.judgingVisit.count({
        where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
      }),
      0,
    );
    const resetArgs = [
      '--import',
      './packages/db/node_modules/tsx/dist/loader.mjs',
      'packages/core/scripts/reset-development-judging.ts',
    ];
    const refused = spawnSync(
      process.execPath,
      [...resetArgs, '--event-name', 'Wrong event'],
      { env: process.env, encoding: 'utf8' },
    );
    assert.equal(refused.status, 1);
    assert.equal(await db.evaluation.count(), 96);
    const reset = spawnSync(
      process.execPath,
      [...resetArgs, '--event-name', 'NPC simulation test'],
      { env: process.env, encoding: 'utf8' },
    );
    assert.equal(reset.status, 0, reset.stderr);
    assert.equal(
      (await db.hackathon.findUniqueOrThrow({ where: { id: event.id } }))
        .status,
      'READY',
    );
    assert.equal(await db.evaluation.count(), 0);
    assert.equal(await db.judgingVisit.count(), 0);
    assert.equal(await db.relativeRanking.count(), 0);
    assert.equal(await db.judgingConfiguration.count(), 0);
    assert.equal(await db.project.count(), 12);
    assert.equal(await db.user.count({ where: { role: 'JUDGE' } }), 40);
    assert.equal(await db.rubricCriterion.count(), 2);
    assert.equal(await db.rubric.count({ where: { isLocked: true } }), 0);
    assert.equal(
      await db.judgingCategory.count({
        where: { status: { not: 'NOT_STARTED' } },
      }),
      0,
    );
    assert.equal(
      await db.auditLog.count({
        where: { action: 'judging.development.reset' },
      }),
      1,
    );
    assert.equal(await db.session.count(), 0);
    assert.ok(
      (await db.auditLog.count({
        where: { action: 'judging.timer.control' },
      })) >= 80,
    );
  },
);
