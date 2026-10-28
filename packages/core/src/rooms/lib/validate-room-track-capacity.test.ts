import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { validateRoomTrackCapacity } =
  await import('./validate-room-track-capacity');
test('capacity includes unassigned and current-room projects, allows continued numbers and rejects excess coverage', async () => {
  const ctx = {
    hackathonId: 'event',
    db: {
      project: {
        count: async ({ where }: { where: unknown }) => {
          assert.deepEqual(where, {
            hackathonId: 'event',
            trackId: 'overall',
            OR: [{ roomId: null }, { roomId: 'room' }],
          });
          return 77;
        },
      },
    },
  } as unknown as AppContext;
  await validateRoomTrackCapacity(ctx, 'room', [
    { trackId: 'overall', ranges: [{ fromNumber: 25, toNumber: 101 }] },
  ]);
  await assert.rejects(
    validateRoomTrackCapacity(ctx, 'room', [
      { trackId: 'overall', ranges: [{ fromNumber: 25, toNumber: 102 }] },
    ]),
    { code: 'VALIDATION_ERROR' },
  );
  await validateRoomTrackCapacity(ctx, 'room', [
    {
      trackId: 'overall',
      ranges: [
        { fromNumber: 25, toNumber: 70 },
        { fromNumber: 50, toNumber: 101 },
      ],
    },
  ]);
});
