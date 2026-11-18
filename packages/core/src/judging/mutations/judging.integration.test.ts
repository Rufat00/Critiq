import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { AppContext } from '../../context';

test(
  'judging lifecycle, scoring, room epochs, idempotency, concurrency and publication on PostgreSQL',
  { skip: process.env.CRITIQ_JUDGING_INTEGRATION !== '1' },
  async (t) => {
    const { db } = await import('@critiq/db');
    const api = await import('../index');
    const { startHackathonJudging } =
      await import('../../hackathon/mutations/start-hackathon-judging');
    const { AppError } = await import('../../shared/errors');
    const fail = (promise: Promise<unknown>, code: string) =>
      assert.rejects(
        promise,
        (e: unknown) => e instanceof AppError && e.code === code,
      );
    const event = await db.hackathon.findFirstOrThrow();
    assert.ok(
      new URL(process.env.DATABASE_URL!).pathname.startsWith(
        '/critiq_judging_test_',
      ),
      'Integration tests require the disposable database runner.',
    );
    const owner = await db.user.create({
      data: {
        id: randomUUID(),
        name: 'Owner',
        email: 'owner@test.invalid',
        role: 'OWNER',
      },
    });
    const judges = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        db.user.create({
          data: {
            id: randomUUID(),
            name: `Judge ${i}`,
            email: `judge${i}@test.invalid`,
            role: 'JUDGE',
          },
        }),
      ),
    );
    const context = (user = owner): AppContext => ({
      db,
      actor: { type: 'user', userId: user.id, role: user.role },
      hackathonId: event.id,
      source: 'web-action',
      request: { requestId: randomUUID(), ipAddress: null, userAgent: null },
    });
    const ctx = context(),
      judge = judges[0]!,
      jctx = context(judge);
    const finalize = async (
      input: Omit<
        Parameters<typeof api.finalizeCompetitionResults>[1],
        'expectedEvidenceFingerprint'
      >,
    ) => {
      const result = await api.getCompetitionResults(ctx, {
        categoryId: input.categoryId,
      });
      return api.finalizeCompetitionResults(ctx, {
        ...input,
        expectedEvidenceFingerprint: result.evidenceFingerprint,
      });
    };
    const overall = await db.judgingCategory.findFirstOrThrow({
      where: { hackathonId: event.id, kind: 'OVERALL' },
      include: { track: true },
    });
    const roomA = await db.room.create({
        data: { hackathonId: event.id, name: 'A' },
      }),
      roomB = await db.room.create({
        data: { hackathonId: event.id, name: 'B' },
      });
    await db.trackRoom.createMany({
      data: [roomA, roomB].map((room) => ({
        trackId: overall.track!.id,
        roomId: room.id,
        capacity: 10,
      })),
    });
    const challenge = await db.judgingCategory.create({
      data: {
        hackathonId: event.id,
        name: 'AI',
        kind: 'CHALLENGE',
        method: 'RATING_SCALE',
        challenge: {
          create: {
            hackathonId: event.id,
            allowedTracks: { create: { trackId: overall.track!.id } },
          },
        },
      },
      include: { challenge: true },
    });
    const rubricCategory = await db.judgingCategory.create({
      data: {
        hackathonId: event.id,
        name: 'UX',
        kind: 'CHALLENGE',
        method: 'RUBRIC',
        challenge: {
          create: {
            hackathonId: event.id,
            allowedTracks: { create: { trackId: overall.track!.id } },
          },
        },
        rubric: {
          create: {
            criteria: {
              create: [
                { name: 'Execution', weight: 40, position: 0 },
                { name: 'Impact', weight: 60, position: 1 },
              ],
            },
          },
        },
      },
      include: {
        challenge: true,
        rubric: { include: { criteria: { orderBy: { position: 'asc' } } } },
      },
    });
    const categories = [overall, challenge, rubricCategory];
    for (const user of judges)
      await db.judgeCategory.createMany({
        data: categories
          .filter((c) => user.id !== judge.id || c.kind !== 'CHALLENGE')
          .map((c) => ({ categoryId: c.id, userId: user.id })),
      });
    const projects = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        db.project.create({
          data: {
            hackathonId: event.id,
            name: `Project ${i}`,
            trackId: overall.track!.id,
            roomId: i === 2 ? roomB.id : roomA.id,
            tableNumber: i + 1,
            challenges: {
              create: [challenge, rubricCategory].map((c) => ({
                challengeId: c.challenge!.id,
              })),
            },
          },
        }),
      ),
    );
    const settings = {
      expectedRevision: 0,

      minRoomCompletionPercent: 100,
      judges: judges.map((j) => ({ judgeId: j.id })),
      categories: categories.map((c) => ({
        categoryId: c.id,
        minimumEvaluations: 1,
        maximumEvaluations: 3,
        desiredEvaluations: 2,
        ...(c.id === rubricCategory.id
          ? {
              criteria: rubricCategory.rubric!.criteria.map((r, i) => ({
                id: r.id,
                lower: 0,
                upper: i ? 10 : 5,
              })),
            }
          : {}),
      })),
    };
    await t.test(
      'configuration validates scope, min/max, qualified judges and optimistic revision',
      async () => {
        await fail(api.configureJudging(jctx, settings), 'FORBIDDEN');
        await fail(
          api.configureJudging(ctx, {
            ...settings,
            categories: settings.categories.map((c) => ({
              ...c,
              minimumEvaluations: 5,
              maximumEvaluations: 3,
            })),
          }),
          'VALIDATION_ERROR',
        );
        await fail(
          api.configureJudging(ctx, {
            ...settings,
            categories: [{ ...settings.categories[0]!, categoryId: 'foreign' }],
          }),
          'INVALID_STATE',
        );
        const saved = await api.configureJudging(ctx, settings);
        assert.equal(saved.revision, 1);
        assert.equal(saved.plan.feasible, true);
        assert.equal(saved.plan.guaranteed, false);
        assert.equal(
          saved.policy.presentationMinutes,
          event.judgingSeconds / 60,
        );
        assert.equal(saved.policy.questionsMinutes, 0);
        await fail(api.configureJudging(ctx, settings), 'CONFLICT');
      },
    );
    await db.hackathon.update({
      where: { id: event.id },
      data: { name: 'Test Hackathon', status: 'READY' },
    });
    await startHackathonJudging(ctx, {});
    let current: Awaited<ReturnType<typeof api.requestNextAssignment>>;
    await t.test(
      'concurrent requests yield one physical visit and explicit category reservations',
      async () => {
        const [a, b] = await Promise.all([
          api.requestNextAssignment(jctx, { requestKey: 'first' }),
          api.requestNextAssignment(jctx, { requestKey: 'second' }),
        ]);
        assert.equal(a.visit!.id, b.visit!.id);
        current = a;
        assert.equal(a.visit!.assignments.length, 3);
        assert.equal(
          await db.judgeCategory.count({
            where: { userId: judge.id, category: { kind: 'CHALLENGE' } },
          }),
          0,
        );
        const workspace = await api.getJudgeCurrentAssignment(jctx, {});
        assert.equal(workspace.visit!.project.challenges.length, 2);
        assert.equal(
          workspace.visit!.assignments.filter(
            (a) => a.category.kind === 'CHALLENGE',
          ).length,
          2,
        );

        assert.equal(
          await db.judgingVisit.count({
            where: { judgeId: judge.id, status: 'ASSIGNED' },
          }),
          1,
        );
        const coverage = await api.getJudgingCoverageSummary(ctx, {});
        assert.equal(
          coverage[0]!.projects.find((p) => p.projectId === a.visit!.projectId)!
            .reserved,
          1,
        );
        assert.equal(
          coverage[0]!.projects.find((p) => p.projectId === a.visit!.projectId)!
            .completed,
          0,
        );
        await fail(
          api.getCompetitionResults(jctx, { categoryId: overall.id }),
          'FORBIDDEN',
        );
        const own = await api.getJudgeCurrentAssignment(jctx, {});
        assert.equal(own.visit!.id, a.visit!.id);
        assert.equal('evaluations' in own, false);
      },
    );
    const observation = async (
      user: typeof owner,
      visit: NonNullable<typeof current.visit>,
    ) => {
      const c = context(user),
        relative = visit.assignments.find((a) => a.categoryId === overall.id)!,
        ordinal = visit.assignments.find((a) => a.categoryId === challenge.id),
        rubric = visit.assignments.find(
          (a) => a.categoryId === rubricCategory.id,
        );
      const order = await api.getJudgeRelativeRanking(c, {
        categoryId: overall.id,
      });
      if (relative)
        await api.updateRelativeRanking(c, {
          categoryId: overall.id,
          expectedRevision: order.revision,
          orderedProjectIds: [
            ...order.projects.map((p) => p.id),
            visit.projectId,
          ],
          visitId: visit.id,
          assignmentId: relative.id,
        });
      if (ordinal)
        await api.submitRatingVote(c, {
          visitId: visit.id,
          assignmentId: ordinal.id,
          rating: 4,
        });
      if (rubric)
        await api.submitRubricEvaluation(c, {
          visitId: visit.id,
          assignmentId: rubric.id,
          marks: rubricCategory.rubric!.criteria.map((r, i) => ({
            criterionId: r.id,
            value: i ? 8 : 4,
          })),
        });
      await api.completeJudgingVisit(c, { visitId: visit.id });
    };
    await t.test(
      'persistent presentation timers enforce ownership, survive overtime, and pause with the event',
      async () => {
        const visitId = current.visit!.id;
        await fail(
          api.controlJudgingTimer(context(judges[1]!), {
            visitId,
            action: 'START',
          }),
          'FORBIDDEN',
        );
        await api.controlJudgingTimer(jctx, { visitId, action: 'START' });
        const started = await db.judgingVisit.findUniqueOrThrow({
          where: { id: visitId },
        });
        assert.ok(started.timerStartedAt);
        const renewed = await api.renewJudgingVisit(jctx, { visitId });
        assert.ok(renewed.expiresAt.getTime() > Date.now() + 19 * 60000);
        await db.judgingVisit.update({
          where: { id: visitId },
          data: { timerRunningSince: new Date(Date.now() - 310000) },
        });
        await api.controlJudgingTimer(jctx, { visitId, action: 'PAUSE' });
        const over = await db.judgingVisit.findUniqueOrThrow({
          where: { id: visitId },
        });
        assert.ok(over.timerElapsedSeconds >= 310);
        assert.equal(over.presentationFinishedAt, null);
        await api.controlJudgingTimer(jctx, { visitId, action: 'RESUME' });
        await api.transitionJudging(ctx, {
          status: 'PAUSED',
          reason: 'Organizer pause test',
        });
        assert.equal(
          (await db.judgingVisit.findUniqueOrThrow({ where: { id: visitId } }))
            .timerRunningSince,
          null,
        );
        assert.equal(
          (await api.getJudgeCurrentAssignment(jctx, {})).visit!.id,
          visitId,
        );
        await fail(
          api.controlJudgingTimer(jctx, { visitId, action: 'FINISH' }),
          'INVALID_STATE',
        );
        await fail(
          api.requestNextAssignment(jctx, { requestKey: 'while-paused' }),
          'INVALID_STATE',
        );
        await api.transitionJudging(ctx, {
          status: 'JUDGING',
          reason: 'Organizer resume test',
        });
        await api.controlJudgingTimer(jctx, { visitId, action: 'FINISH' });
        assert.ok(
          (await api.getJudgeCurrentAssignment(jctx, {})).visit!
            .presentationFinishedAt,
        );
        const dashboard = await api.getAdminJudgingDashboard(ctx, {});
        assert.equal(dashboard.tracks.length, 1);
        assert.ok(dashboard.tracks[0]!.projects.some((p) => p.reserved === 1));
        const ordered = dashboard.tracks[0]!.projects.map((p) => p.assignments);
        assert.deepEqual(
          ordered,
          [...ordered].sort((a, b) => a - b),
        );
        await fail(api.getAdminJudgingDashboard(jctx, {}), 'FORBIDDEN');
      },
    );
    await t.test(
      'closing requires the event name and releases unfinished work atomically',
      async () => {
        await fail(
          api.transitionJudging(ctx, {
            status: 'DELIBERATION',
            reason: 'Close judging',
            eventName: 'Wrong name',
          }),
          'INVALID_STATE',
        );
        assert.equal(
          (await db.hackathon.findUniqueOrThrow({ where: { id: event.id } }))
            .status,
          'JUDGING',
        );
        const rollback = new Error('rollback closing test');
        await assert.rejects(
          db.$transaction(async (tx) => {
            await api.transitionJudging(
              { ...ctx, db: tx },
              {
                status: 'DELIBERATION',
                reason: 'Close judging',
                eventName: 'Test Hackathon',
              },
            );
            assert.equal(
              (
                await tx.judgingVisit.findUniqueOrThrow({
                  where: { id: current.visit!.id },
                })
              ).status,
              'SKIPPED',
            );
            assert.equal(
              await tx.judgingAssignment.count({
                where: {
                  visitId: current.visit!.id,
                  status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
                },
              }),
              0,
            );
            throw rollback;
          }),
          (e) => e === rollback,
        );
        assert.ok(
          ['ASSIGNED', 'IN_PROGRESS'].includes(
            (
              await db.judgingVisit.findUniqueOrThrow({
                where: { id: current.visit!.id },
              })
            ).status,
          ),
        );
      },
    );
    await t.test(
      'saving the track evaluation leaves both challenge steps open',
      async () => {
        const rollback = new Error(
          'Restore scoring state after checking step order',
        );
        await assert.rejects(
          db.$transaction(async (tx) => {
            const scoped = { ...jctx, db: tx };
            const visit = current.visit!;
            const track = visit.assignments.find(
              (a) => a.categoryId === overall.id,
            )!;
            await api.updateRelativeRanking(scoped, {
              categoryId: overall.id,
              expectedRevision: 0,
              orderedProjectIds: [visit.projectId],
              visitId: visit.id,
              assignmentId: track.id,
            });
            const workspace = await api.getJudgeCurrentAssignment(scoped, {});
            assert.equal(
              workspace.visit!.assignments.find((a) => a.id === track.id)!
                .status,
              'COMPLETED',
            );
            const unfinished = workspace.visit!.assignments.filter(
              (a) => !['COMPLETED', 'SKIPPED'].includes(a.status),
            );
            assert.equal(unfinished.length, 2);
            assert.ok(unfinished.every((a) => a.category.kind === 'CHALLENGE'));
            await fail(
              api.completeJudgingVisit(scoped, { visitId: visit.id }),
              'INVALID_STATE',
            );
            throw rollback;
          }),
          (error) => error === rollback,
        );
      },
    );
    await t.test(
      'submissions enforce identity, ranges, complete ranking and idempotency',
      async () => {
        const visit = current.visit!,
          rubric = visit.assignments.find(
            (a) => a.categoryId === rubricCategory.id,
          )!,
          ordinal = visit.assignments.find(
            (a) => a.categoryId === challenge.id,
          )!,
          relative = visit.assignments.find(
            (a) => a.categoryId === overall.id,
          )!;
        await fail(
          api.completeJudgingVisit(jctx, { visitId: visit.id }),
          'INVALID_STATE',
        );
        await fail(
          api.submitRatingVote(context(judges[1]!), {
            visitId: visit.id,
            assignmentId: ordinal.id,
            rating: 5,
          }),
          'FORBIDDEN',
        );
        await fail(
          api.submitRubricEvaluation(jctx, {
            visitId: visit.id,
            assignmentId: rubric.id,
            marks: [
              { criterionId: rubricCategory.rubric!.criteria[0]!.id, value: 6 },
            ],
          }),
          'VALIDATION_ERROR',
        );
        await fail(
          api.updateRelativeRanking(jctx, {
            categoryId: overall.id,
            expectedRevision: 0,
            orderedProjectIds: ['foreign'],
            visitId: visit.id,
            assignmentId: relative.id,
          }),
          'INVALID_STATE',
        );
        assert.equal(
          await db.evaluation.count({ where: { assignmentId: relative.id } }),
          0,
        );
        const input = {
          visitId: visit.id,
          assignmentId: ordinal.id,
          rating: 4,
        };
        const [a, b] = await Promise.all([
          api.submitRatingVote(jctx, input),
          api.submitRatingVote(jctx, input),
        ]);
        assert.equal(a.id, b.id);
        await fail(
          api.submitRatingVote(jctx, { ...input, rating: 5 }),
          'CONFLICT',
        );
        await observation(judge, visit);
        await api.completeJudgingVisit(jctx, { visitId: visit.id });
        assert.equal(
          await db.evaluation.count({
            where: { judgeId: judge.id, projectId: visit.projectId },
          }),
          3,
        );
        const progress = await api.getJudgeCurrentAssignment(jctx, {});
        assert.equal(progress.epoch!.progress.completed, 1);
        const summary = await api.getCompetitionResults(ctx, {
          categoryId: rubricCategory.id,
        });
        assert.equal(
          summary.leaderboard.find((r) => r.projectId === visit.projectId)!
            .score,
          80,
        );
      },
    );
    await t.test(
      'frozen room denominator, ranking revisions, skips and expired requests',
      async () => {
        const before = await api.getJudgeCurrentAssignment(jctx, {});
        const frozen = before.epoch!.reachableProjectIds;
        const next = await api.requestNextAssignment(jctx, {
          requestKey: 'next',
        });
        assert.ok(next.visit);
        if (frozen.length > 1)
          assert.equal(next.visit.roomId, before.epoch!.roomId);
        await api.skipJudgingVisit(jctx, {
          visitId: next.visit.id,
          reason: 'Project is absent',
        });
        const again = await api.requestNextAssignment(jctx, {
          requestKey: 'again',
        });
        assert.ok(again.visit);
        await db.judgingVisit.update({
          where: { id: again.visit.id },
          data: {
            createdAt: new Date(Date.now() - 60000),
            expiresAt: new Date(Date.now() - 1000),
          },
        });
        await fail(
          api.submitRatingVote(jctx, {
            visitId: again.visit.id,
            assignmentId: again.visit.assignments.find(
              (a) => a.categoryId === challenge.id,
            )!.id,
            rating: 5,
          }),
          'INVALID_STATE',
        );
        const replacement = await api.requestNextAssignment(jctx, {
          requestKey: 'replacement',
        });
        assert.ok(replacement.visit);
        assert.equal(
          (
            await db.judgingVisit.findUniqueOrThrow({
              where: { id: again.visit.id },
            })
          ).status,
          'EXPIRED',
        );
        const order = await api.getJudgeRelativeRanking(jctx, {
          categoryId: overall.id,
        });
        await fail(
          api.updateRelativeRanking(jctx, {
            categoryId: overall.id,
            expectedRevision: order.revision - 1,
            orderedProjectIds: [],
          }),
          'CONFLICT',
        );
        await observation(judge, replacement.visit);
        assert.deepEqual(
          (
            await db.roomStayEpoch.findUniqueOrThrow({
              where: { id: before.epoch!.id },
            })
          ).reachableProjectIds,
          frozen,
        );
      },
    );
    await t.test(
      'audit failure rolls back reservation and room entry',
      async () => {
        const trigger = `CREATE FUNCTION fail_judging_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."action" = 'judging.assignments.request' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$`;
        await db.$executeRawUnsafe(trigger);
        await db.$executeRawUnsafe(
          `CREATE TRIGGER fail_judging_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fail_judging_audit()`,
        );
        try {
          await fail(
            api.requestNextAssignment(context(judges[1]!), {
              requestKey: 'rollback',
            }),
            'INTERNAL_SERVER_ERROR',
          );
          assert.equal(
            await db.judgingVisit.count({ where: { judgeId: judges[1]!.id } }),
            0,
          );
          assert.equal(
            await db.roomStayEpoch.count({ where: { judgeId: judges[1]!.id } }),
            0,
          );
        } finally {
          await db.$executeRawUnsafe(
            'DROP TRIGGER fail_judging_audit ON "AuditLog"',
          );
          await db.$executeRawUnsafe('DROP FUNCTION fail_judging_audit()');
        }
      },
    );
    await t.test(
      'coverage maximum and project capacity survive concurrent independent judges',
      async () => {
        for (let pass = 0; pass < 20; pass++) {
          let assigned = 0;
          const responses = await Promise.all(
            judges.map((user) =>
              api.requestNextAssignment(context(user), {
                requestKey: `round-${pass}`,
              }),
            ),
          );
          for (let i = 0; i < responses.length; i++) {
            const response = responses[i]!;
            if (
              response.visit &&
              ['ASSIGNED', 'IN_PROGRESS'].includes(response.visit.status)
            ) {
              await observation(judges[i]!, response.visit);
              assigned++;
            }
          }
          if (!assigned) break;
        }
        const coverage = await api.getJudgingCoverageSummary(ctx, {});
        for (const c of coverage)
          for (const p of c.projects) {
            assert.ok(p.completed >= 1);
            assert.ok(p.completed <= 3);
            assert.equal(p.reserved, 0);
          }
        const results = await api.getCompetitionResults(ctx, {
          categoryId: overall.id,
        });
        assert.equal(results.readiness.ready, true);
      },
    );
    await t.test(
      'closing blocks scores, publication freezes evidence and preserves ties',
      async () => {
        await fail(
          finalize({
            categoryId: challenge.id,
            expectedScoringRevision: 1,
          }),
          'INVALID_STATE',
        );
        await api.transitionJudging(ctx, {
          status: 'DELIBERATION',
          eventName: 'Test Hackathon',
          reason: 'All judging completed',
        });
        await fail(
          api.requestNextAssignment(jctx, { requestKey: 'closed' }),
          'INVALID_STATE',
        );
        await fail(
          finalize({
            categoryId: challenge.id,
            expectedScoringRevision: 1,
          }),
          'INVALID_STATE',
        );
        const published = await finalize({
          categoryId: challenge.id,
          expectedScoringRevision: 1,
          acknowledgeTies: true,
        });
        assert.ok(published.evidence);
        assert.equal(
          (
            await finalize({
              categoryId: challenge.id,
              expectedScoringRevision: 1,
              acknowledgeTies: true,
            })
          ).id,
          published.id,
        );
        await fail(
          api.submitRatingVote(jctx, {
            visitId: current.visit!.id,
            assignmentId: current.visit!.assignments.find(
              (a) => a.categoryId === challenge.id,
            )!.id,
            rating: 4,
          }),
          'INVALID_STATE',
        );
        const ordinal = await api.getCompetitionResults(ctx, {
          categoryId: challenge.id,
        });
        assert.equal(ordinal.unresolvedWinner, true);
        assert.deepEqual(
          ordinal.leaderboard.map((r) => r.rank),
          [1, 1, 1],
        );
      },
    );
    await t.test(
      'reopening preserves publications, exclusions recompute evidence, and exceptions require reasons',
      async () => {
        const first = await db.competitionResultSnapshot.findFirstOrThrow({
          where: { categoryId: challenge.id },
        });
        await api.reopenCompetition(ctx, {
          categoryId: challenge.id,
          reason: 'Review a newly reported conflict',
        });
        assert.ok(
          (
            await db.competitionResultSnapshot.findUniqueOrThrow({
              where: { id: first.id },
            })
          ).supersededAt,
        );
        await fail(
          api.excludeEvaluation(jctx, {
            evaluationId: (await db.evaluation.findFirstOrThrow()).id,
            reason: 'Judge cannot exclude another review',
          }),
          'FORBIDDEN',
        );
        const own = await db.evaluation.findFirstOrThrow({
          where: {
            judgeId: judge.id,
            categoryId: overall.id,
            isExcluded: false,
          },
        });
        const before = await api.getCompetitionResults(ctx, {
          categoryId: overall.id,
        });
        await api.declareJudgeConflict(jctx, {
          projectId: own.projectId,
          reason: 'A teammate works on this project',
        });
        const after = await api.getCompetitionResults(ctx, {
          categoryId: overall.id,
        });
        assert.equal(
          after.leaderboard.find((r) => r.projectId === own.projectId)!.count,
          before.leaderboard.find((r) => r.projectId === own.projectId)!.count -
            1,
        );
        assert.equal(
          (await db.evaluation.findUniqueOrThrow({ where: { id: own.id } }))
            .isExcluded,
          true,
        );
        const reviewed = await api.getCompetitionResults(ctx, {
          categoryId: challenge.id,
        });
        const ordinal = await db.evaluation.findMany({
          where: {
            categoryId: challenge.id,
            projectId: projects[0]!.id,
            isExcluded: false,
          },
        });
        for (const e of ordinal)
          await api.excludeEvaluation(ctx, {
            evaluationId: e.id,
            reason: 'Project eligibility needs organizer review',
          });
        await fail(
          api.finalizeCompetitionResults(ctx, {
            categoryId: challenge.id,
            expectedScoringRevision: 1,
            expectedEvidenceFingerprint: reviewed.evidenceFingerprint,
            acknowledgeTies: true,
            exceptionReason: 'Acknowledge the reviewed shortfall',
          }),
          'CONFLICT',
        );
        const result = await api.getCompetitionResults(ctx, {
          categoryId: challenge.id,
        });
        assert.equal(result.coverage.minimum, 0);
        assert.equal(result.readiness.ready, false);
        await fail(
          finalize({
            categoryId: challenge.id,
            expectedScoringRevision: 1,
            acknowledgeTies: true,
          }),
          'INVALID_STATE',
        );
        const replacement = await finalize({
          categoryId: challenge.id,
          expectedScoringRevision: 1,
          acknowledgeTies: true,
          exceptionReason:
            'Project withdrew after judging; publish the coverage exception',
        });
        assert.notEqual(first.id, replacement.id);
        assert.equal(
          await db.competitionResultSnapshot.count({
            where: { categoryId: challenge.id },
          }),
          2,
        );
        assert.equal(
          (replacement.results as { state: string }).state,
          'FINALIZED_WITH_EXCEPTIONS',
        );
      },
    );
    await t.test(
      'judge breaks and project availability are scoped and audited',
      async () => {
        await fail(
          api.setJudgeJudgingAvailability(jctx, {
            judgeId: judges[1]!.id,
            available: false,
            reason: 'Try changing another judge',
          }),
          'FORBIDDEN',
        );
        await api.setJudgeJudgingAvailability(jctx, {
          available: false,
          reason: 'Taking a short break',
        });
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: judge.id } }))
            .isJudgingAvailable,
          false,
        );
        await api.setJudgeJudgingAvailability(jctx, {
          available: true,
          reason: 'Returned from break',
        });
        await api.setProjectJudgingAvailability(ctx, {
          projectId: projects[0]!.id,
          available: false,
          reason: 'Temporary power outage',
        });
        assert.equal(
          await db.projectFlag.count({
            where: { projectId: projects[0]!.id, status: 'OPEN' },
          }),
          1,
        );
        await api.setProjectJudgingAvailability(ctx, {
          projectId: projects[0]!.id,
          available: true,
          reason: 'Power restored',
        });
        assert.equal(
          await db.projectFlag.count({
            where: { projectId: projects[0]!.id, status: 'OPEN' },
          }),
          0,
        );
        await fail(
          api.getCompetitionResults(
            { ...ctx, hackathonId: 'foreign' },
            { categoryId: challenge.id },
          ),
          'INVALID_STATE',
        );
        await fail(
          api.requestNextAssignment(
            {
              ...jctx,
              actor: { type: 'user', userId: judge.id, role: 'ADMIN' },
            },
            { requestKey: 'forged-role' },
          ),
          'FORBIDDEN',
        );
      },
    );
    await db.$disconnect();
  },
);
