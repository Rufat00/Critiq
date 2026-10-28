import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { createRoom } = await import('./create-room');
const { updateRoom } = await import('./update-room');
const { setRoomTrackAccess } = await import('./set-room-track-access');
const { getRoom } = await import('../queries/get-room');
const { listRooms } = await import('../queries/list-rooms');
const { AppError } = await import('../../shared/errors');
const { Prisma } = await import('@critiq/db');
type Room = {
  id: string;
  hackathonId: string;
  name: string;
  description: string | null;
  isActive: boolean;
};
type Link = {
  id: string;
  roomId: string;
  trackId: string;
  sortOrder: number;
  isActive: boolean;
};
type Range = { trackRoomId: string; fromNumber: number; toNumber: number };
function fixture({ status = 'DRAFT', failAudit = false } = {}) {
  let state = {
    rooms: [
      {
        id: 'room',
        hackathonId: 'event',
        name: 'Hall',
        description: null,
        isActive: true,
      },
    ] as Room[],
    links: [
      {
        id: 'link',
        roomId: 'room',
        trackId: 'track-a',
        sortOrder: 7,
        isActive: false,
      },
    ] as Link[],
    ranges: [{ trackRoomId: 'link', fromNumber: 1, toNumber: 5 }] as Range[],
    audits: [] as unknown[],
  };
  function client(s: typeof state) {
    return {
      project: { findMany: async () => [], count: async () => 1000 },
      hackathon: {
        updateMany: async ({
          where,
        }: {
          where: { id: string; status: string };
        }) => ({
          count: Number(where.id === 'event' && where.status === status),
        }),
      },
      room: {
        findFirst: async ({
          where,
        }: {
          where: { id: string; hackathonId: string };
        }) =>
          s.rooms.find(
            (r) => r.id === where.id && r.hackathonId === where.hackathonId,
          ) ?? null,
        create: async ({ data }: { data: Omit<Room, 'id' | 'isActive'> }) => {
          if (
            s.rooms.some(
              (r) => r.name === data.name && r.hackathonId === data.hackathonId,
            )
          )
            throw new Prisma.PrismaClientKnownRequestError('duplicate', {
              code: 'P2002',
              clientVersion: 'test',
            });
          const room = {
            ...data,
            id: `room-${s.rooms.length}`,
            isActive: true,
          };
          s.rooms.push(room);
          return room;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string; hackathonId: string };
          data: Partial<Room>;
        }) => {
          const room = s.rooms.find(
            (r) => r.id === where.id && r.hackathonId === where.hackathonId,
          )!;
          Object.assign(room, data);
          return room;
        },
      },
      track: {
        count: async ({
          where,
        }: {
          where: {
            id: { in: string[] };
            hackathonId: string;
            category: unknown;
          };
        }) => {
          assert.deepEqual(where.category, {
            hackathonId: 'event',
            kind: { in: ['OVERALL', 'TRACK'] },
          });
          return where.hackathonId === 'event'
            ? where.id.in.filter((id) =>
                ['overall-track', 'track-a', 'track-b'].includes(id),
              ).length
            : 0;
        },
      },
      trackRoom: {
        findMany: async ({ where }: { where: { roomId: string } }) =>
          s.links
            .filter((l) => l.roomId === where.roomId)
            .map((l) => ({
              ...l,
              tableRanges: s.ranges.filter((r) => r.trackRoomId === l.id),
            })),
        deleteMany: async ({
          where,
        }: {
          where: { roomId: string; trackId: { notIn: string[] } };
        }) => {
          const removed = s.links.filter(
            (l) =>
              l.roomId === where.roomId &&
              !where.trackId.notIn.includes(l.trackId),
          );
          s.links = s.links.filter((l) => !removed.includes(l));
          s.ranges = s.ranges.filter(
            (r) => !removed.some((l) => l.id === r.trackRoomId),
          );
        },
        upsert: async ({
          where,
          create,
          update,
        }: {
          where: { trackId_roomId: { trackId: string; roomId: string } };
          create: { trackId: string; roomId: string };
          update: unknown;
        }) => {
          assert.deepEqual(update, {});
          let link = s.links.find(
            (l) =>
              l.trackId === where.trackId_roomId.trackId &&
              l.roomId === where.trackId_roomId.roomId,
          );
          if (!link) {
            link = {
              ...create,
              id: `link-${s.links.length}`,
              sortOrder: 0,
              isActive: true,
            };
            s.links.push(link);
          }
          return link;
        },
      },
      trackRoomTableRange: {
        deleteMany: async ({ where }: { where: { trackRoomId: string } }) => {
          s.ranges = s.ranges.filter(
            (r) => r.trackRoomId !== where.trackRoomId,
          );
        },
        createMany: async ({ data }: { data: Range[] }) => {
          s.ranges.push(...data);
        },
      },
      auditLog: {
        create: async ({ data }: { data: unknown }) => {
          if (failAudit) throw new Error('Audit failed');
          s.audits.push(data);
        },
      },
    };
  }
  let queue = Promise.resolve();
  const db = {
    ...client(state),
    async $transaction(run: (tx: unknown) => Promise<unknown>) {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      const draft = structuredClone(state);
      try {
        const result = await run(client(draft));
        state = draft;
        return result;
      } finally {
        release();
      }
    },
  };
  const ctx = {
    db,
    actor: { type: 'user', userId: 'owner', role: 'OWNER' },
    hackathonId: 'event',
    source: 'web-action',
    request: {},
  } as unknown as AppContext;
  return { ctx, read: () => state };
}
const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (e: unknown) => e instanceof AppError && e.code === code,
  );
const access = {
  roomId: 'room',
  tracks: [
    {
      trackId: 'track-a',
      ranges: [
        { fromNumber: 1, toNumber: 8 },
        { fromNumber: 20, toNumber: 22 },
      ],
    },
    { trackId: 'track-b', ranges: [{ fromNumber: 5, toNumber: 10 }] },
  ],
};
test('room creation and edits trim values, preserve scope, toggle status and audit', async () => {
  const f = fixture();
  const created = await createRoom(f.ctx, {
    name: ' Annex ',
    description: ' North wing ',
  });
  assert.equal(created.name, 'Annex');
  assert.equal(created.description, 'North wing');
  assert.equal(created.isActive, true);
  await updateRoom(f.ctx, {
    roomId: created.id,
    name: ' Annex 2 ',
    description: '',
    isActive: false,
  });
  assert.equal(f.read().rooms[1]!.name, 'Annex 2');
  assert.equal(f.read().rooms[1]!.description, null);
  assert.equal(f.read().rooms[1]!.isActive, false);
  assert.equal(f.read().audits.length, 2);
});
test('all room operations reject judges and system actors', async () => {
  const f = fixture();
  for (const actor of [
    { type: 'user', userId: 'judge', role: 'JUDGE' },
    { type: 'system', service: 'test' },
  ] as AppContext['actor'][]) {
    const ctx = { ...f.ctx, actor };
    for (const action of [
      () => createRoom(ctx, { name: 'Hall' }),
      () => updateRoom(ctx, { roomId: 'room', name: 'Hall', isActive: false }),
      () => setRoomTrackAccess(ctx, access),
      () => getRoom(ctx, { roomId: 'room' }),
      () => listRooms(ctx, {}),
    ])
      await rejects(action(), 'FORBIDDEN');
  }
  assert.equal(f.read().audits.length, 0);
});
test('configuration writes reject non-draft stages and foreign room/track IDs', async () => {
  for (const status of [
    'READY',
    'JUDGING',
    'PAUSED',
    'DELIBERATION',
    'COMPLETED',
  ]) {
    const f = fixture({ status });
    await rejects(createRoom(f.ctx, { name: 'New' }), 'INVALID_STATE');
    await rejects(
      updateRoom(f.ctx, { roomId: 'room', name: 'Hall', isActive: false }),
      'INVALID_STATE',
    );
    await rejects(setRoomTrackAccess(f.ctx, access), 'INVALID_STATE');
    assert.equal(f.read().audits.length, 0);
  }
  const f = fixture();
  await rejects(
    getRoom({ ...f.ctx, hackathonId: 'foreign' }, { roomId: 'room' }),
    'NOT_FOUND',
  );
  await rejects(
    updateRoom(f.ctx, { roomId: 'foreign', name: 'Hall', isActive: true }),
    'NOT_FOUND',
  );
  await rejects(
    setRoomTrackAccess(f.ctx, { ...access, roomId: 'foreign' }),
    'NOT_FOUND',
  );
  await rejects(
    setRoomTrackAccess(f.ctx, {
      roomId: 'room',
      tracks: [{ trackId: 'foreign', ranges: [] }],
    }),
    'NOT_FOUND',
  );
  assert.equal(f.read().audits.length, 0);
});
test('ranges support gaps, overlaps within/across tracks, and access without ranges while preserving rotation metadata', async () => {
  const f = fixture();
  const input = structuredClone(access);
  input.tracks[0]!.ranges.push({ fromNumber: 3, toNumber: 10 });
  await setRoomTrackAccess(f.ctx, input);
  assert.equal(f.read().ranges.length, 4);
  assert.equal(f.read().links[0]!.sortOrder, 7);
  assert.equal(f.read().links[0]!.isActive, false);
  await setRoomTrackAccess(f.ctx, {
    roomId: 'room',
    tracks: [{ trackId: 'track-a', ranges: [] }],
  });
  assert.equal(f.read().links.length, 1);
  assert.equal(f.read().ranges.length, 0);
  await setRoomTrackAccess(f.ctx, { roomId: 'room', tracks: [] });
  assert.equal(f.read().links.length, 0);
  assert.equal(f.read().audits.length, 3);
});
test('invalid numbers, reversed ranges and exact duplicates fail validation without writing', async () => {
  const f = fixture();
  for (const range of [
    { fromNumber: 0, toNumber: 1 },
    { fromNumber: 2, toNumber: 1 },
    { fromNumber: 1.5, toNumber: 3 },
    { fromNumber: 1, toNumber: 2147483648 },
  ])
    await rejects(
      setRoomTrackAccess(f.ctx, {
        roomId: 'room',
        tracks: [{ trackId: 'track-a', ranges: [range] }],
      }),
      'VALIDATION_ERROR',
    );
  await rejects(
    setRoomTrackAccess(f.ctx, {
      ...access,
      tracks: [access.tracks[0]!, access.tracks[0]!],
    }),
    'VALIDATION_ERROR',
  );
  await rejects(
    setRoomTrackAccess(f.ctx, {
      roomId: 'room',
      tracks: [
        {
          trackId: 'track-a',
          ranges: [
            { fromNumber: 1, toNumber: 2 },
            { fromNumber: 1, toNumber: 2 },
          ],
        },
      ],
    }),
    'VALIDATION_ERROR',
  );
  await rejects(createRoom(f.ctx, { name: ' ' }), 'VALIDATION_ERROR');
  assert.equal(f.read().audits.length, 0);
  assert.equal(f.read().ranges.length, 1);
});
test('audit failure rolls back room creation, status edits, link removals and range writes', async () => {
  const f = fixture({ failAudit: true });
  const before = structuredClone(f.read());
  await rejects(createRoom(f.ctx, { name: 'New' }), 'INTERNAL_SERVER_ERROR');
  await rejects(
    updateRoom(f.ctx, { roomId: 'room', name: 'Changed', isActive: false }),
    'INTERNAL_SERVER_ERROR',
  );
  await rejects(setRoomTrackAccess(f.ctx, access), 'INTERNAL_SERVER_ERROR');
  await rejects(
    setRoomTrackAccess(f.ctx, { roomId: 'room', tracks: [] }),
    'INTERNAL_SERVER_ERROR',
  );
  assert.deepEqual(f.read(), before);
});
test('concurrent duplicate creation commits one room and audit, returns a safe conflict', async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    createRoom(f.ctx, { name: 'New' }),
    createRoom(f.ctx, { name: 'New' }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = results.find((r) => r.status === 'rejected');
  assert.ok(
    rejected?.status === 'rejected' &&
      rejected.reason instanceof AppError &&
      rejected.reason.code === 'CONFLICT',
  );
  assert.equal(f.read().rooms.length, 2);
  assert.equal(f.read().audits.length, 1);
});

test('Overall uses the same room access and sparse range writes as other tracks', async () => {
  const f = fixture();
  await setRoomTrackAccess(f.ctx, {
    roomId: 'room',
    tracks: [
      {
        trackId: 'overall-track',
        ranges: [
          { fromNumber: 1, toNumber: 4 },
          { fromNumber: 9, toNumber: 12 },
        ],
      },
    ],
  });
  assert.equal(f.read().links.length, 1);
  assert.equal(f.read().links[0]!.trackId, 'overall-track');
  assert.equal(f.read().ranges.length, 2);
  assert.equal(f.read().audits.length, 1);
});
