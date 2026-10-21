import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/client';

// Uses temporary rows and rolls back even after successful checks.
const rollback = new Error('Category constraint check complete');
try {
  await db.$transaction(async (tx) => {
    const hackathon = await tx.hackathon.findFirstOrThrow();
    const create = (
      kind: 'TRACK' | 'CHALLENGE',
      method?: 'RELATIVE' | 'RUBRIC' | 'RATING_SCALE',
    ) =>
      tx.judgingCategory.create({
        data: {
          hackathonId: hackathon.id,
          kind,
          name: `Constraint check ${randomUUID()}`,
          ...(method ? { method } : {}),
          ...(kind === 'TRACK'
            ? { track: { create: { hackathonId: hackathon.id } } }
            : { challenge: { create: { hackathonId: hackathon.id } } }),
        },
      });
    assert.equal((await create('TRACK')).method, 'RELATIVE');
    assert.equal((await create('CHALLENGE')).method, 'RATING_SCALE');
    assert.equal((await create('TRACK', 'RUBRIC')).method, 'RUBRIC');
    assert.equal((await create('CHALLENGE', 'RUBRIC')).method, 'RUBRIC');
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    async function rejected(run: () => Promise<unknown>) {
      await tx.$executeRawUnsafe('SAVEPOINT category_check');
      await assert.rejects(run);
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT category_check');
    }
    await rejected(() => create('TRACK', 'RATING_SCALE'));
    await rejected(() => create('CHALLENGE', 'RELATIVE'));
    const overall = await tx.judgingCategory.findFirstOrThrow({
      where: { hackathonId: hackathon.id, kind: 'OVERALL' },
      include: { track: true },
    });
    assert.ok(overall.track, 'Overall must have an explicit Track.');
    await rejected(() =>
      tx.judgingCategory.delete({ where: { id: overall.id } }),
    );
    await rejected(() =>
      tx.judgingCategory.update({
        where: { id: overall.id },
        data: { kind: 'TRACK' },
      }),
    );
    await rejected(() => tx.track.delete({ where: { id: overall.track!.id } }));
    // An incomplete category is rejected when deferred invariants are checked.
    await rejected(async () => {
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');
      await tx.judgingCategory.create({
        data: { hackathonId: hackathon.id, kind: 'TRACK', name: randomUUID() },
      });
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    });
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');
    const category = await create('TRACK');
    const track = await tx.track.findUniqueOrThrow({
      where: { categoryId: category.id },
    });
    await tx.project.create({
      data: {
        name: `Project ${randomUUID()}`,
        hackathonId: hackathon.id,
        trackId: track.id,
      },
    });
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    await rejected(() => tx.track.delete({ where: { id: track.id } }));
    await rejected(() =>
      tx.track.create({
        data: { hackathonId: hackathon.id, categoryId: category.id },
      }),
    );
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
  console.info(
    'Category methods, subtype completeness, Overall protection, and required project tracks passed. All temporary changes rolled back.',
  );
} finally {
  await db.$disconnect();
}
