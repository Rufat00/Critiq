import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/client';

// Uses only temporary rows and rolls back even after successful checks.
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
        },
      });
    assert.equal((await create('TRACK')).method, 'RELATIVE');
    assert.equal((await create('CHALLENGE')).method, 'RATING_SCALE');
    assert.equal((await create('TRACK', 'RUBRIC')).method, 'RUBRIC');
    assert.equal((await create('CHALLENGE', 'RUBRIC')).method, 'RUBRIC');
    async function rejected(run: () => Promise<unknown>) {
      await tx.$executeRawUnsafe('SAVEPOINT category_check');
      await assert.rejects(run);
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT category_check');
    }
    await rejected(() => create('TRACK', 'RATING_SCALE'));
    await rejected(() => create('CHALLENGE', 'RELATIVE'));
    const overall = await tx.judgingCategory.findFirstOrThrow({
      where: { hackathonId: hackathon.id, kind: 'OVERALL' },
    });
    await rejected(() =>
      tx.judgingCategory.delete({ where: { id: overall.id } }),
    );
    await rejected(() =>
      tx.judgingCategory.update({
        where: { id: overall.id },
        data: { kind: 'TRACK' },
      }),
    );
    const trackCategory = await create('TRACK');
    const track = await tx.track.create({
      data: { hackathonId: hackathon.id, categoryId: trackCategory.id },
    });
    assert.equal(track.disqualifiesFromOverall, true);
    await rejected(() =>
      tx.track.update({
        where: { id: track.id },
        data: { disqualifiesFromOverall: false },
      }),
    );
    const anotherTrackCategory = await create('TRACK');
    await rejected(() =>
      tx.track.create({
        data: {
          hackathonId: hackathon.id,
          categoryId: anotherTrackCategory.id,
          disqualifiesFromOverall: false,
        },
      }),
    );
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
  console.info(
    'Category method defaults, compatibility, Overall protection, and track exclusion passed. All temporary changes rolled back.',
  );
} finally {
  await db.$disconnect();
}
