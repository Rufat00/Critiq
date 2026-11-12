import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppContext } from '../../context';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { createRoom } = await import('./create-room');
const { updateRoom } = await import('./update-room');
const { deleteRoom } = await import('./delete-room');
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
  capacity: number;
};

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
        capacity: 5,
      },
    ] as Link[],
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
        delete: async ({
          where,
        }: {
          where: { id: string; hackathonId: string };
        }) => {
          s.rooms = s.rooms.filter(
            (room) =>
              room.id !== where.id || room.hackathonId !== where.hackathonId,
          );
          s.links = s.links.filter((link) => link.roomId !== where.id);
        },
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
            .map((l) => ({ ...l })),
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
        },
        upsert: async ({
          where,
          create,
          update,
        }: {
          where: { trackId_roomId: { trackId: string; roomId: string } };
          create: { trackId: string; roomId: string; capacity: number };
          update: { capacity: number };
        }) => {
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
          Object.assign(link, update);
          return link;
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
      capacity: 11,
    },
    { trackId: 'track-b', capacity: 6 },
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
      () => deleteRoom(ctx, { roomId: 'room' }),
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
    await rejects(deleteRoom(f.ctx, { roomId: 'room' }), 'INVALID_STATE');
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
      tracks: [{ trackId: 'foreign', capacity: 0 }],
    }),
    'NOT_FOUND',
  );
  await rejects(deleteRoom(f.ctx, { roomId: 'foreign' }), 'NOT_FOUND');
  await rejects(
    deleteRoom({ ...f.ctx, hackathonId: 'foreign' }, { roomId: 'room' }),
    'INVALID_STATE',
  );
  assert.equal(f.read().audits.length, 0);
});
test('capacity edits and zero spots preserve rotation metadata, and clearing access removes links', async () => {
  const f = fixture();
  await setRoomTrackAccess(f.ctx, access);
  assert.equal(f.read().links[0]!.capacity, 11);
  assert.equal(f.read().links[0]!.sortOrder, 7);
  assert.equal(f.read().links[0]!.isActive, false);
  await setRoomTrackAccess(f.ctx, {
    roomId: 'room',
    tracks: [{ trackId: 'track-a', capacity: 0 }],
  });
  assert.equal(f.read().links.length, 1);
  assert.equal(f.read().links[0]!.capacity, 0);
  await setRoomTrackAccess(f.ctx, { roomId: 'room', tracks: [] });
  assert.equal(f.read().links.length, 0);
  assert.equal(f.read().audits.length, 3);
});
test('negative, fractional, oversized spots and duplicate tracks fail without writes', async () => {
  const f = fixture();
  const before = structuredClone(f.read());
  for (const capacity of [-1, 1.5, 2147483648]) {
    await rejects(
      setRoomTrackAccess(f.ctx, {
        roomId: 'room',
        tracks: [{ trackId: 'track-a', capacity }],
      }),
      'VALIDATION_ERROR',
    );
  }
  await rejects(
    setRoomTrackAccess(f.ctx, {
      ...access,
      tracks: [access.tracks[0]!, access.tracks[0]!],
    }),
    'VALIDATION_ERROR',
  );
  await rejects(createRoom(f.ctx, { name: ' ' }), 'VALIDATION_ERROR');
  assert.deepEqual(f.read(), before);
});
test('audit failure rolls back room creation, status edits, link removals and capacity writes', async () => {
  const f = fixture({ failAudit: true });
  const before = structuredClone(f.read());
  await rejects(createRoom(f.ctx, { name: 'New' }), 'INTERNAL_SERVER_ERROR');
  await rejects(
    updateRoom(f.ctx, { roomId: 'room', name: 'Changed', isActive: false }),
    'INTERNAL_SERVER_ERROR',
  );
  await rejects(setRoomTrackAccess(f.ctx, access), 'INTERNAL_SERVER_ERROR');
  await rejects(deleteRoom(f.ctx, { roomId: 'room' }), 'INTERNAL_SERVER_ERROR');
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

test('Overall uses the same room access and capacity writes as other tracks', async () => {
  const f = fixture();
  await setRoomTrackAccess(f.ctx, {
    roomId: 'room',
    tracks: [
      {
        trackId: 'overall-track',
        capacity: 8,
      },
    ],
  });
  assert.equal(f.read().links.length, 1);
  assert.equal(f.read().links[0]!.trackId, 'overall-track');
  assert.equal(f.read().links[0]!.capacity, 8);
  assert.equal(f.read().audits.length, 1);
});

test('deleting a room removes its track capacities and audits the original room state', async () => {
  const f = fixture();
  const deleted = await deleteRoom(f.ctx, { roomId: 'room' });
  assert.equal(deleted.isActive, true);
  assert.equal(f.read().rooms.length, 0);
  assert.equal(f.read().links.length, 0);
  assert.equal(f.read().audits.length, 1);
  await rejects(deleteRoom(f.ctx, { roomId: 'room' }), 'NOT_FOUND');
  assert.equal(f.read().audits.length, 1);
});
