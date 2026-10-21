import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: unknown) =>
    Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === code,
    ),
  );

test(
  'project workflows persist scoped memberships and moves, list by track, filter imports, prevent duplicate imports, and audit in PostgreSQL',
  { skip: process.env.CRITIQ_DB_INTEGRATION !== '1' },
  async () => {
    const { db } = await import('@critiq/db');
    const { createCategory } =
      await import('../../categories/mutations/create-category');
    const { createProject } = await import('./create-project');
    const { updateProject } = await import('./update-project');
    const { deleteProject } = await import('./delete-project');
    const { importProjects } = await import('./import-projects');
    const { listProjects } = await import('../queries/list-projects');
    const { previewProjectImport } =
      await import('../queries/preview-project-import');
    const { DEVPOST_COLUMNS } = await import('../lib/parse-project-csv');
    const rollback = new Error('Project verification complete');
    let hackathonId = '',
      createdId = '';
    try {
      await db.$transaction(
        async (tx) => {
          const hackathon = await tx.hackathon.findFirstOrThrow();
          hackathonId = hackathon.id;
          assert.equal(hackathon.status, 'DRAFT');
          const organizer = await tx.user.findFirstOrThrow({
            where: { role: { in: ['OWNER', 'ADMIN'] }, isActive: true },
          });
          const ctx = {
            db: tx,
            hackathonId,
            actor: {
              type: 'user' as const,
              userId: organizer.id,
              role: organizer.role,
            },
            source: 'web-action' as const,
            request: { ipAddress: null, userAgent: null },
          };
          const overallTrack = await tx.track.findFirstOrThrow({
            where: { hackathonId, category: { kind: 'OVERALL' } },
          });
          const name = (prefix: string) => `${prefix} ${randomUUID()}`;
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
            name: name('Prize'),
            method: 'RATING_SCALE',
            trackIds: [overallTrack.id, trackRow.id],
          });
          const challengeRow = await tx.challenge.findUniqueOrThrow({
            where: { categoryId: challenge.id },
          });
          const restricted = await createCategory(ctx, {
            kind: 'CHALLENGE',
            name: name('Restricted'),
            method: 'RATING_SCALE',
            trackIds: [trackRow.id],
          });
          const restrictedRow = await tx.challenge.findUniqueOrThrow({
            where: { categoryId: restricted.id },
          });
          const project = await createProject(ctx, {
            name: name('Project'),
            trackId: trackRow.id,
            challengeIds: [challengeRow.id],
          });
          createdId = project.id;
          assert.equal(
            await tx.projectChallenge.count({
              where: { projectId: project.id },
            }),
            1,
          );
          const judge = {
            ...ctx,
            actor: {
              type: 'user' as const,
              userId: organizer.id,
              role: 'JUDGE' as const,
            },
          };
          await rejects(
            createProject(judge, {
              trackId: overallTrack.id,
              name: 'Forbidden',
            }),
            'FORBIDDEN',
          );
          await rejects(
            updateProject(judge, {
              projectId: project.id,
              trackId: overallTrack.id,
              name: 'Forbidden',
            }),
            'FORBIDDEN',
          );
          await rejects(
            deleteProject(judge, { projectId: project.id }),
            'FORBIDDEN',
          );
          await rejects(
            previewProjectImport(judge, {
              format: 'csv',
              csv: 'Name,,,,,,,Submitted',
            }),
            'FORBIDDEN',
          );
          await rejects(
            importProjects(judge, {
              format: 'csv',
              csv: 'Name,,,,,,,Submitted',
            }),
            'FORBIDDEN',
          );
          await rejects(
            listProjects(judge, { filters: { trackId: overallTrack.id } }),
            'FORBIDDEN',
          );
          await rejects(
            createProject(ctx, {
              trackId: overallTrack.id,
              name: 'Bad URL',
              demoUrl: 'javascript:alert(1)',
            }),
            'VALIDATION_ERROR',
          );
          await rejects(
            createProject(ctx, { name: 'Bad track', trackId: 'foreign' }),
            'NOT_FOUND',
          );
          await rejects(
            createProject(ctx, {
              trackId: overallTrack.id,
              name: 'Bad challenge',
              challengeIds: ['foreign'],
            }),
            'VALIDATION_ERROR',
          );
          await rejects(
            createProject(ctx, {
              trackId: overallTrack.id,
              name: 'Wrong track challenge',
              challengeIds: [restrictedRow.id],
            }),
            'VALIDATION_ERROR',
          );
          await rejects(
            updateProject(ctx, {
              projectId: 'foreign',
              trackId: overallTrack.id,
              name: 'Missing',
            }),
            'NOT_FOUND',
          );
          await rejects(
            updateProject(
              { ...ctx, hackathonId: 'foreign' },
              {
                projectId: project.id,
                trackId: overallTrack.id,
                name: 'Missing',
              },
            ),
            'INVALID_STATE',
          );
          const room = await tx.room.create({
            data: { hackathonId, name: name('Room') },
          });
          await tx.project.update({
            where: { id: project.id },
            data: { roomId: room.id, tableNumber: 9 },
          });
          await updateProject(ctx, {
            projectId: project.id,
            name: project.name,
            trackId: overallTrack.id,
            challengeIds: [challengeRow.id],
          });
          const moved = await tx.project.findUniqueOrThrow({
            where: { id: project.id },
            include: { challenges: true },
          });
          assert.equal(moved.trackId, overallTrack.id);
          assert.equal(moved.roomId, null);
          assert.equal(moved.tableNumber, null);
          assert.equal(moved.challenges[0]!.challengeId, challengeRow.id);
          const list = await listProjects(ctx, {
            filters: { trackId: overallTrack.id },
            search: project.name,
          });
          assert.deepEqual(
            list.items.map((p) => p.id),
            [project.id],
          );
          assert.equal(list.pagination.totalItems, 1);
          assert.equal(
            (
              await listProjects(ctx, {
                filters: { trackId: trackRow.id },
                search: project.name,
              })
            ).pagination.totalItems,
            0,
          );
          const empty = await listProjects(ctx, {
            filters: { trackId: overallTrack.id },
            search: 'missing-' + randomUUID(),
            pagination: { page: 8, pageSize: 10 },
          });
          assert.deepEqual(empty.pagination, {
            page: 8,
            pageSize: 10,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          });
          await rejects(
            listProjects(ctx, { filters: { trackId: 'foreign' } }),
            'NOT_FOUND',
          );
          const importName = name('Import');
          const url = `https://devpost.com/submissions/${Date.now()}-test`;
          const csv = `${Object.values(DEVPOST_COLUMNS).join(',')}\n${importName},About,${url},,,${track.name},${challenge.name},Submitted\nDraft,,not-a-url,,,Unknown,Unknown,Draft\n${importName},About,${url},,,${track.name},${challenge.name},Submitted`;
          const preview = await previewProjectImport(ctx, {
            format: 'devpost',
            csv,
          });
          assert.equal(preview.projects.length, 1);
          assert.equal(preview.notSubmitted, 1);
          assert.equal(preview.duplicates, 1);
          const imported = await importProjects(ctx, {
            format: 'devpost',
            csv,
          });
          assert.equal(imported.added, 1);
          assert.equal(imported.duplicates, 1);
          assert.equal(
            (await importProjects(ctx, { format: 'devpost', csv })).added,
            0,
          );
          assert.equal(
            await tx.projectChallenge.count({
              where: { projectId: imported.ids[0] },
            }),
            1,
          );
          const invalidTitle = name('Should not exist');
          await rejects(
            importProjects(ctx, {
              format: 'csv',
              csv: `${invalidTitle},,,,,,,Submitted\nBad,,,,,Unknown,,Submitted`,
            }),
            'VALIDATION_ERROR',
          );
          assert.equal(
            await tx.project.count({
              where: { name: invalidTitle, hackathonId },
            }),
            0,
          );
          const headerlessName = name('Headerless');
          assert.equal(
            (
              await importProjects(ctx, {
                format: 'csv',
                csv: `${headerlessName},,,,,,,Submitted`,
              })
            ).added,
            1,
          );
          assert.equal(
            (
              await importProjects(ctx, {
                format: 'csv',
                csv: `${headerlessName},,,,,,,Submitted`,
              })
            ).duplicates,
            1,
          );
          for (const status of [
            'READY',
            'JUDGING',
            'PAUSED',
            'DELIBERATION',
            'COMPLETED',
          ] as const) {
            await tx.hackathon.update({
              where: { id: hackathonId },
              data: { status },
            });
            await rejects(
              createProject(ctx, { trackId: overallTrack.id, name: 'Locked' }),
              'INVALID_STATE',
            );
            await rejects(
              updateProject(ctx, {
                projectId: project.id,
                trackId: overallTrack.id,
                name: 'Locked',
              }),
              'INVALID_STATE',
            );
            await rejects(
              deleteProject(ctx, { projectId: project.id }),
              'INVALID_STATE',
            );
            await rejects(
              importProjects(ctx, {
                format: 'csv',
                csv: 'Locked,,,,,,,Submitted',
              }),
              'INVALID_STATE',
            );
          }
          await tx.hackathon.update({
            where: { id: hackathonId },
            data: { status: 'DRAFT' },
          });
          const judgeUser = await tx.user.create({
            data: {
              id: randomUUID(),
              name: 'Temporary project test judge',
              email: `${randomUUID()}@example.test`,
              role: 'JUDGE',
            },
          });
          const assignment = await tx.judgingAssignment.create({
            data: {
              categoryId: track.id,
              judgeId: judgeUser.id,
              projectId: imported.ids[0]!,
            },
          });
          await rejects(
            deleteProject(ctx, { projectId: imported.ids[0]! }),
            'INVALID_STATE',
          );
          await rejects(
            updateProject(ctx, {
              projectId: imported.ids[0]!,
              name: 'Cannot edit judged project',
              trackId: overallTrack.id,
            }),
            'INVALID_STATE',
          );
          await tx.judgingAssignment.delete({ where: { id: assignment.id } });
          await deleteProject(ctx, { projectId: project.id });
          assert.equal(
            await tx.project.findUnique({ where: { id: project.id } }),
            null,
          );
          assert.equal(
            await tx.projectChallenge.count({
              where: { projectId: project.id },
            }),
            0,
          );
          await rejects(
            deleteProject(ctx, { projectId: project.id }),
            'NOT_FOUND',
          );
          const audit = await tx.auditLog.findFirstOrThrow({
            where: {
              hackathonId,
              entityId: project.id,
              action: 'projects.update',
            },
          });
          assert.equal(audit.actorId, organizer.id);
          assert.equal(
            (audit.metadata as { before: { trackId: string } }).before.trackId,
            trackRow.id,
          );
          throw rollback;
        },
        { timeout: 30000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      if (createdId)
        assert.equal(await db.project.count({ where: { id: createdId } }), 0);
      await db.$disconnect();
    }
  },
);

test(
  'project and import writes roll back when required audit persistence fails',
  { skip: process.env.CRITIQ_DB_INTEGRATION !== '1' },
  async () => {
    const { db } = await import('@critiq/db');
    const { createProject } = await import('./create-project');
    const { importProjects } = await import('./import-projects');
    const hackathon = await db.hackathon.findFirstOrThrow();
    const organizer = await db.user.findFirstOrThrow({
      where: { role: { in: ['OWNER', 'ADMIN'] }, isActive: true },
    });
    const faultyDb = {
      $transaction: (run: (tx: unknown) => Promise<unknown>) =>
        db.$transaction((tx) =>
          run(
            new Proxy(tx, {
              get(target, key) {
                if (key === 'auditLog')
                  return {
                    create: async () => {
                      throw new Error('Simulated audit failure');
                    },
                  };
                return Reflect.get(target, key);
              },
            }),
          ),
        ),
    };
    const ctx = {
      db: faultyDb,
      hackathonId: hackathon.id,
      actor: { type: 'user', userId: organizer.id, role: organizer.role },
      source: 'web-action',
      request: { ipAddress: null, userAgent: null },
    } as unknown as import('../../context').AppContext;
    const overallTrack = await db.track.findFirstOrThrow({
      where: { hackathonId: hackathon.id, category: { kind: 'OVERALL' } },
    });
    const title = `Rollback ${randomUUID()}`;
    try {
      await rejects(
        createProject(ctx, { name: title, trackId: overallTrack.id }),
        'INTERNAL_SERVER_ERROR',
      );
      assert.equal(
        await db.project.count({
          where: { hackathonId: hackathon.id, name: title },
        }),
        0,
      );
      await rejects(
        importProjects(ctx, { format: 'csv', csv: `${title},,,,,,,Submitted` }),
        'INTERNAL_SERVER_ERROR',
      );
      assert.equal(
        await db.project.count({
          where: { hackathonId: hackathon.id, name: title },
        }),
        0,
      );
    } finally {
      await db.$disconnect();
    }
  },
);

test(
  'concurrent repeated imports serialize and add only one project',
  { skip: process.env.CRITIQ_DB_INTEGRATION !== '1' },
  async () => {
    const { db } = await import('@critiq/db');
    const { importProjects } = await import('./import-projects');
    const hackathon = await db.hackathon.findFirstOrThrow();
    const organizer = await db.user.findFirstOrThrow({
      where: { role: { in: ['OWNER', 'ADMIN'] }, isActive: true },
    });
    const requestId = randomUUID();
    const name = `Concurrent import ${randomUUID()}`;
    const ctx = {
      db,
      hackathonId: hackathon.id,
      actor: {
        type: 'user' as const,
        userId: organizer.id,
        role: organizer.role,
      },
      source: 'web-action' as const,
      request: { requestId, ipAddress: null, userAgent: null },
    };
    try {
      const results = await Promise.all([
        importProjects(ctx, { format: 'csv', csv: `${name},,,,,,,Submitted` }),
        importProjects(ctx, { format: 'csv', csv: `${name},,,,,,,Submitted` }),
      ]);
      assert.deepEqual(results.map((r) => r.added).sort(), [0, 1]);
      assert.equal(
        results.reduce((total, result) => total + result.duplicates, 0),
        1,
      );
      assert.equal(
        await db.project.count({ where: { hackathonId: hackathon.id, name } }),
        1,
      );
    } finally {
      await db.$transaction(async (tx) => {
        await tx.project.deleteMany({
          where: { hackathonId: hackathon.id, name },
        });
        await tx.auditLog.deleteMany({
          where: {
            hackathonId: hackathon.id,
            action: 'projects.import',
            metadata: { path: ['requestId'], equals: requestId },
          },
        });
      });
      await db.$disconnect();
    }
  },
);
