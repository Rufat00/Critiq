import { createHash, randomUUID } from 'node:crypto';
import {
  openSync,
  readFileSync,
  writeFileSync,
  closeSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { db } from '@critiq/db';
import type { AppContext } from '@critiq/core/context';
import { AppError } from '@critiq/core/errors';
import * as judging from '@critiq/core/judging';

const { values } = parseArgs({
  options: {
    judges: { type: 'string', default: '40' },
    concurrency: { type: 'string', default: '6' },
    'presentation-seconds': { type: 'string', default: '45' },
    'stagger-seconds': { type: 'string', default: '20' },
    'poll-ms': { type: 'string', default: '1000' },
    'idle-ms': { type: 'string', default: '5000' },
    'score-delay-ms': { type: 'string', default: '1000' },
    'max-visits': { type: 'string', default: '0' },
    'prepare-only': { type: 'boolean', default: false },
    'stop-when-idle': { type: 'boolean', default: false },
  },
});
function integer(
  value: string,
  name: string,
  minimum: number,
  maximum: number,
) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum)
    throw new Error(
      `${name} must be an integer from ${minimum} to ${maximum}.`,
    );
  return number;
}
const count = integer(values.judges!, 'judges', 1, 100);
const concurrency = integer(values.concurrency!, 'concurrency', 1, 20);
const presentationSeconds = integer(
  values['presentation-seconds']!,
  'presentation-seconds',
  0,
  3600,
);
const staggerSeconds = integer(
  values['stagger-seconds']!,
  'stagger-seconds',
  0,
  120,
);
const pollMs = integer(values['poll-ms']!, 'poll-ms', 50, 30000);
const idleMs = integer(values['idle-ms']!, 'idle-ms', 100, 60000);
const scoreDelayMs = integer(
  values['score-delay-ms']!,
  'score-delay-ms',
  0,
  30000,
);
const maxVisits = integer(values['max-visits']!, 'max-visits', 0, 10000);
const databaseUrl = new URL(process.env.DATABASE_URL!);
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)
)
  throw new Error('NPC judges are restricted to a local development database.');
const lockPath = join(
  tmpdir(),
  `critiq-npc-${createHash('sha256').update(databaseUrl.toString()).digest('hex').slice(0, 16)}.pid`,
);
let lock: number | undefined;
let stopping = false;
const stop = () => {
  stopping = true;
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
function acquireLock() {
  try {
    lock = openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const pid = Number(readFileSync(lockPath, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0)
      throw new Error(`Invalid NPC runner lock: ${lockPath}`);
    try {
      process.kill(pid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      unlinkSync(lockPath);
      lock = openSync(lockPath, 'wx', 0o600);
    }
    if (lock === undefined)
      throw new Error(`An NPC runner is already running (PID ${pid}).`);
  }
  writeFileSync(lock!, String(process.pid));
}
const unit = (value: string) =>
  createHash('sha256').update(value).digest().readUInt32BE(0) / 0xffffffff;
async function parallel<T>(items: T[], action: (item: T) => Promise<void>) {
  let next = 0;
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++]!;
        await action(item);
      }
    }),
  );
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}
type NpcJudge = {
  id: string;
  name: string;
  nextAt: number;
  requestKey: string;
  completed: number;
  errors: number;
  idle: boolean;
};
let npcs: NpcJudge[] = [];
let hackathonId = '';
function context(npc: NpcJudge): AppContext {
  return {
    db,
    actor: { type: 'user', userId: npc.id, role: 'JUDGE' },
    hackathonId,
    source: 'worker',
    request: {
      requestId: `npc:${randomUUID()}`,
      ipAddress: null,
      userAgent: 'Critiq NPC judge simulator',
    },
  };
}
async function prepare() {
  return db.$transaction(
    async (tx) => {
      const event = await tx.hackathon.findFirstOrThrow();
      // Serialize fixture preparation with the same event lock as judging writes.
      await tx.hackathon.update({
        where: { id: event.id },
        data: { updatedAt: new Date() },
      });
      const current = await tx.hackathon.findUniqueOrThrow({
        where: { id: event.id },
      });
      if (!['DRAFT', 'READY', 'JUDGING', 'PAUSED'].includes(current.status))
        throw new Error(
          'The event must be in Draft, Ready, Judging, or Paused.',
        );
      const categories = await tx.judgingCategory.findMany({
        where: { hackathonId: event.id, isEnabled: true },
        orderBy: { id: 'asc' },
        include: {
          track: {
            include: {
              projects: {
                where: { isActive: true, isDisqualified: false },
                select: { id: true },
              },
            },
          },
          challenge: { include: { allowedTracks: true } },
        },
      });
      const tracks = categories.filter(
        (c) => c.track && c.track.projects.length > 0,
      );
      if (!tracks.length)
        throw new Error(
          'Add projects to at least one enabled track before preparing NPC judges.',
        );
      const frozen =
        current.status === 'JUDGING' || current.status === 'PAUSED';
      const judges: NpcJudge[] = [];
      for (let index = 0; index < count; index++) {
        const number = String(index + 1).padStart(2, '0');
        const id = `critiq-npc-judge-${number}`;
        const email = `npc-judge-${number}@critiq.invalid`;
        const name = `NPC Judge ${number}`;
        const existing = await tx.user.findUnique({ where: { id } });
        if (existing && (existing.role !== 'JUDGE' || existing.email !== email))
          throw new Error(
            `Reserved NPC identity ${number} is already in use by another account.`,
          );
        if (frozen) {
          if (!existing?.isActive || !existing.isJudgingAvailable)
            throw new Error(
              'Prepare NPC judges before starting judging. Existing active NPC judges can be resumed.',
            );
          const configured = await tx.judgeCategory.count({
            where: {
              userId: id,
              isActive: true,
              category: {
                hackathonId: event.id,
                kind: { in: ['OVERALL', 'TRACK'] },
              },
            },
          });
          if (!configured)
            throw new Error(
              `${name} has no track access. Prepare NPC judges before starting.`,
            );
        } else {
          await tx.user.upsert({
            where: { id },
            create: {
              id,
              email,
              name,
              role: 'JUDGE',
              isActive: true,
              isJudgingAvailable: true,
            },
            update: { isActive: true, isJudgingAvailable: true },
          });
          const track = tracks[index % tracks.length]!;
          const access = categories.filter(
            (c) =>
              c.id === track.id ||
              c.challenge?.allowedTracks.some(
                (t) => t.trackId === track.track!.id,
              ),
          );
          await tx.judgeCategory.updateMany({
            where: { userId: id, category: { hackathonId: event.id } },
            data: { isActive: false },
          });
          for (const category of access)
            await tx.judgeCategory.upsert({
              where: {
                userId_categoryId: { userId: id, categoryId: category.id },
              },
              create: { userId: id, categoryId: category.id },
              update: { isActive: true },
            });
        }
        judges.push({
          id,
          name,
          nextAt: Date.now() + Math.floor(unit(id) * staggerSeconds * 1000),
          requestKey: randomUUID(),
          completed: 0,
          errors: 0,
          idle: false,
        });
      }
      await tx.auditLog.create({
        data: {
          hackathonId: event.id,
          action: 'judging.npc.prepare',
          entityType: 'NpcSimulation',
          metadata: {
            source: 'worker',
            count,
            reused: frozen,
            judgeIds: judges.map((j) => j.id),
          },
        },
      });
      return { event: current, judges };
    },
    { timeout: 30000 },
  );
}
async function step(npc: NpcJudge) {
  const ctx = context(npc);
  const workspace = await judging.getJudgeCurrentAssignment(ctx, {});
  if (workspace.event.status !== 'JUDGING') return;
  const visit = workspace.visit;
  if (!visit) {
    const next = await judging.requestNextAssignment(ctx, {
      requestKey: npc.requestKey,
    });
    npc.requestKey = randomUUID();
    npc.idle = next.status === 'NO_FEASIBLE_ASSIGNMENT';
    npc.nextAt =
      Date.now() + (next.status === 'RESERVED' ? scoreDelayMs : idleMs);
    return;
  }
  npc.idle = false;
  if (visit.expiresAt.getTime() - Date.now() < 120000)
    await judging.renewJudgingVisit(ctx, { visitId: visit.id });
  const desiredSeconds =
    presentationSeconds * (0.8 + unit(`${npc.id}:${visit.projectId}`) * 0.4);
  if (!visit.timerStartedAt) {
    await judging.controlJudgingTimer(ctx, {
      visitId: visit.id,
      action: 'START',
    });
    npc.nextAt = Date.now() + Math.min(60000, desiredSeconds * 1000);
    return;
  }
  if (!visit.presentationFinishedAt) {
    if (!visit.timerRunningSince) {
      await judging.controlJudgingTimer(ctx, {
        visitId: visit.id,
        action: 'RESUME',
      });
      npc.nextAt =
        Date.now() +
        Math.min(
          60000,
          Math.max(0, desiredSeconds - visit.timerElapsedSeconds) * 1000,
        );
    } else {
      const elapsed =
        visit.timerElapsedSeconds +
        (Date.now() - visit.timerRunningSince.getTime()) / 1000;
      if (elapsed < desiredSeconds)
        npc.nextAt =
          Date.now() + Math.min(60000, (desiredSeconds - elapsed) * 1000);
      else {
        await judging.controlJudgingTimer(ctx, {
          visitId: visit.id,
          action: 'FINISH',
        });
        npc.nextAt = Date.now() + scoreDelayMs;
      }
    }
    return;
  }
  const assignment = [...visit.assignments]
    .sort(
      (a, b) =>
        Number(a.category.kind === 'CHALLENGE') -
          Number(b.category.kind === 'CHALLENGE') || a.id.localeCompare(b.id),
    )
    .find((a) => !['COMPLETED', 'SKIPPED'].includes(a.status));
  if (!assignment) {
    await judging.completeJudgingVisit(ctx, { visitId: visit.id });
    npc.completed++;
    npc.nextAt = Date.now() + idleMs;
    return;
  }
  const quality = Math.max(
    0,
    Math.min(
      1,
      unit(visit.projectId) * 0.8 + unit(`${npc.id}:${visit.projectId}`) * 0.2,
    ),
  );
  if (assignment.category.method === 'RELATIVE') {
    const ranking = await judging.getJudgeRelativeRanking(ctx, {
      categoryId: assignment.categoryId,
    });
    const order = [
      ...new Set([...ranking.projects.map((p) => p.id), visit.projectId]),
    ].sort((a, b) => unit(b) - unit(a) || a.localeCompare(b));
    await judging.updateRelativeRanking(ctx, {
      visitId: visit.id,
      assignmentId: assignment.id,
      categoryId: assignment.categoryId,
      expectedRevision: ranking.revision,
      orderedProjectIds: order,
    });
  } else if (assignment.category.method === 'RUBRIC') {
    const criteria = workspace.rubrics.find(
      (r) => r.categoryId === assignment.categoryId,
    )?.rubric;
    if (!criteria?.length)
      throw new Error('The assigned rubric has no published criteria.');
    await judging.submitRubricEvaluation(ctx, {
      visitId: visit.id,
      assignmentId: assignment.id,
      marks: criteria.map((c) => ({
        criterionId: c.id,
        value: Math.max(
          c.lower,
          Math.min(
            c.upper,
            Number((c.lower + quality * (c.upper - c.lower)).toFixed(4)),
          ),
        ),
      })),
      notes: 'NPC simulation score.',
    });
  } else {
    await judging.submitRatingVote(ctx, {
      visitId: visit.id,
      assignmentId: assignment.id,
      rating: 1 + Math.min(4, Math.floor(quality * 5)),
      notes: 'NPC simulation vote.',
    });
  }
  npc.nextAt = Date.now() + scoreDelayMs;
}
async function run() {
  acquireLock();
  const prepared = await prepare();
  npcs = prepared.judges;
  hackathonId = prepared.event.id;
  console.log(
    `Prepared ${npcs.length} NPC judges, distributed across populated tracks with eligible challenge access.`,
  );
  console.log(
    'NPC accounts and simulated scores remain in this development event. No sign-in sessions are created.',
  );
  if (values['prepare-only']) return;
  console.log(
    `Running PID ${process.pid}. Presentations take about ${presentationSeconds}s. Stop with Ctrl+C or SIGTERM.`,
  );
  let lastStatus = '',
    lastSummary = 0;
  while (!stopping) {
    const event = await db.hackathon.findUniqueOrThrow({
      where: { id: hackathonId },
      select: { status: true },
    });
    if (lastStatus !== event.status) {
      lastStatus = event.status;
      console.log(
        `Event stage: ${event.status}${['DRAFT', 'READY'].includes(event.status) ? '. Refresh the admin page, then start judging when ready.' : ''}`,
      );
    }
    if (['DELIBERATION', 'COMPLETED'].includes(event.status)) break;
    if (event.status === 'JUDGING') {
      await parallel(
        npcs.filter(
          (n) =>
            n.nextAt <= Date.now() && (!maxVisits || n.completed < maxVisits),
        ),
        async (npc) => {
          try {
            await step(npc);
            npc.errors = 0;
          } catch (error) {
            npc.errors++;
            npc.nextAt = Date.now() + idleMs;
            if (npc.errors === 1 || npc.errors % 10 === 0)
              console.error(
                `${npc.name}: ${error instanceof AppError ? error.message : 'NPC step failed; retrying.'}`,
              );
            if (npc.errors >= 20)
              throw new Error(
                `${npc.name} repeatedly failed. Stop and inspect the judging configuration.`,
              );
          }
        },
      );
      if (maxVisits && npcs.every((n) => n.completed >= maxVisits)) break;
      if (values['stop-when-idle'] && npcs.every((n) => n.idle)) {
        const active = await db.judgingVisit.count({
          where: {
            hackathonId,
            status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
            expiresAt: { gt: new Date() },
          },
        });
        if (active === 0) break;
      }
    }
    if (Date.now() - lastSummary >= 15000) {
      const [active, evaluations] = await Promise.all([
        db.judgingVisit.count({
          where: {
            hackathonId,
            judgeId: { in: npcs.map((n) => n.id) },
            status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
            expiresAt: { gt: new Date() },
          },
        }),
        db.evaluation.count({
          where: {
            judgeId: { in: npcs.map((n) => n.id) },
            category: { hackathonId },
            isExcluded: false,
          },
        }),
      ]);
      console.log(
        `${npcs.length} NPC judges · ${active} active visits · ${evaluations} saved evaluations · ${npcs.reduce((sum, n) => sum + n.completed, 0)} visits completed this run`,
      );
      lastSummary = Date.now();
    }
    await delay(pollMs);
  }
}
try {
  await run();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'NPC simulation failed.',
  );
  process.exitCode = 1;
} finally {
  if (
    npcs.length &&
    hackathonId &&
    (
      await db.hackathon.findUnique({
        where: { id: hackathonId },
        select: { status: true },
      })
    )?.status === 'JUDGING'
  ) {
    await parallel(npcs, async (npc) => {
      try {
        const current = await judging.getJudgeCurrentAssignment(
          context(npc),
          {},
        );
        if (current.visit)
          await judging.skipJudgingVisit(context(npc), {
            visitId: current.visit.id,
            reason: 'NPC simulation stopped.',
          });
      } catch {
        console.error(
          `${npc.name}: unfinished visit will be released when its reservation expires.`,
        );
      }
    });
  }
  await db.$disconnect();
  if (lock !== undefined) {
    closeSync(lock);
    unlinkSync(lockPath);
  }
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
}
