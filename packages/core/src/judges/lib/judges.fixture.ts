import type { AppContext } from '../../context';

type Membership = { userId: string; categoryId: string; isActive: boolean };
type Invitation = {
  id: string;
  hackathonId: string;
  role: string;
  email: string | null;
  tokenHash: string;
  maxUses: number;
  usedCount: number;
  status: string;
  expiresAt: Date;
  categories: { create: { categoryId: string } };
};
export function judgeDatabase({
  failAudit = false,
  status = 'DRAFT',
  activity = 0,
} = {}) {
  let state = {
    memberships: [
      { userId: 'judge', categoryId: 'overall', isActive: true },
    ] as Membership[],
    invitations: [] as Invitation[],
    audits: [] as unknown[],
  };
  let queue = Promise.resolve();
  const whereReads: unknown[] = [];
  function client(draft: typeof state) {
    return {
      $queryRaw: async () => [],
      hackathon: {
        updateMany: async ({ where }: { where: { id: string } }) => ({
          count: Number(where.id === 'event' && status === 'DRAFT'),
        }),
        findUniqueOrThrow: async () => ({ name: 'Test hackathon' }),
      },
      judgingCategory: {
        findFirst: async ({
          where,
        }: {
          where: { id: string; hackathonId: string };
        }) =>
          where.hackathonId === 'event' &&
          ['overall', 'track'].includes(where.id)
            ? { id: where.id, name: where.id }
            : null,
      },
      user: {
        findUnique: async ({ where }: { where: { email: string } }) =>
          where.email === 'existing@example.com' ? { id: 'judge' } : null,
        findUniqueOrThrow: async () => ({ name: 'Organizer' }),
      },
      judgeCategory: {
        findFirst: async ({ where }: { where: Membership }) =>
          draft.memberships.find(
            (row) =>
              row.userId === where.userId &&
              row.categoryId === where.categoryId &&
              row.isActive,
          ) ?? null,
        count: async ({
          where,
        }: {
          where: { categoryId: string | { not: string } };
        }) => {
          if (typeof where.categoryId === 'string') {
            whereReads.push(where);
            return 37;
          }
          const excluded = where.categoryId.not;
          return draft.memberships.filter(
            (row) => row.isActive && row.categoryId !== excluded,
          ).length;
        },
        findMany: async ({
          where,
          skip,
          take,
        }: {
          where: unknown;
          skip: number;
          take: number;
        }) => {
          whereReads.push(where);
          return Array.from(
            { length: Math.max(0, Math.min(take, 37 - skip)) },
            (_, index) => ({
              assignedAt: new Date(0),
              user: {
                id: String(index + skip),
                name: 'Judge',
                email: 'judge@example.com',
              },
            }),
          );
        },
        update: async ({
          where,
          data,
        }: {
          where: { userId_categoryId: { userId: string; categoryId: string } };
          data: { isActive: boolean };
        }) => {
          const row = draft.memberships.find(
            (item) =>
              item.userId === where.userId_categoryId.userId &&
              item.categoryId === where.userId_categoryId.categoryId,
          );
          if (row) row.isActive = data.isActive;
        },
        upsert: async ({ create }: { create: Membership }) => {
          const existing = draft.memberships.find(
            (row) =>
              row.userId === create.userId &&
              row.categoryId === create.categoryId,
          );
          if (existing) existing.isActive = true;
          else draft.memberships.push({ ...create, isActive: true });
        },
      },
      judgingAssignment: { count: async () => activity },
      evaluation: { count: async () => activity },
      relativeRanking: { count: async () => activity },
      invitation: {
        updateMany: async ({
          where,
        }: {
          where: {
            id?: string;
            hackathonId: string;
            email?: string | null;
            categories?: { some: { categoryId: string } };
          };
        }) => {
          let count = 0;
          for (const row of draft.invitations) {
            if (
              row.hackathonId === where.hackathonId &&
              row.status === 'ACTIVE' &&
              (where.id
                ? row.id === where.id
                : row.email === where.email &&
                  row.categories.create.categoryId ===
                    where.categories?.some.categoryId)
            ) {
              row.status = 'REVOKED';
              count++;
            }
          }
          return { count };
        },
        create: async ({
          data,
        }: {
          data: Omit<Invitation, 'id' | 'usedCount' | 'status'>;
        }) => {
          const row = {
            ...data,
            id: `invite-${draft.invitations.length + 1}`,
            usedCount: 0,
            status: 'ACTIVE',
          };
          draft.invitations.push(row);
          return { id: row.id };
        },
      },
      auditLog: {
        create: async ({ data }: { data: unknown }) => {
          if (failAudit) throw new Error('Audit failure');
          draft.audits.push(data);
        },
      },
    };
  }
  const db = {
    ...client(state),
    async $transaction<T>(run: (tx: unknown) => Promise<T>) {
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
  return { ctx, read: () => state, whereReads };
}
