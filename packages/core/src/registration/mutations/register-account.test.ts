import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@critiq/db';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { createSystemContext } = await import('../../context');
import type { AppErrorCode as ErrorCode } from '../../shared/errors';
const { AppError, AppErrorCode } = await import('../../shared/errors');
const { registerAccount } = await import('./register-account');
const { beginSetup } = await import('./begin-setup');
const { getRegistrationAccess } =
  await import('../queries/get-registration-access');
import { registerAccountSchema } from '../schemas/register-account-schema';

const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const input = {
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  password: 'a-long-password',
  agreementRules: true as const,
  agreementPrivacy: true as const,
};
const passwordCredentials = {
  mode: 'password' as const,
  passwordHash: 'hashed-password',
};
function database({
  claimed = true,
  invitation = null,
  failAudit = false,
}: { claimed?: boolean; invitation?: any; failAudit?: boolean } = {}) {
  let state = {
    installation: { id: 1, claimedAt: claimed ? new Date() : null },
    users: [] as any[],
    audits: [] as any[],
    redemptions: [] as any[],
    memberships: [] as any[],
    invitation: structuredClone(invitation),
    verifications: [
      {
        id: 'setup',
        identifier: 'setup-grant',
        value: hash('setup-token'),
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        id: 'proof',
        identifier: `registration-proof:${input.email}`,
        value: hash('email-token'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    ],
  };
  let queue = Promise.resolve();
  const db = {
    installation: { findUnique: async () => state.installation },
    verification: {
      findFirst: async ({ where }: any) =>
        state.verifications.find(
          (item) =>
            item.identifier === where.identifier &&
            item.value === where.value &&
            item.expiresAt > where.expiresAt.gt,
        ),
    },
    hackathon: { findFirst: async () => ({ id: 'hackathon' }) },
    invitation: {
      findUnique: async ({ where }: any) =>
        state.invitation?.tokenHash === where.tokenHash
          ? state.invitation
          : null,
    },
    async $transaction(run: (tx: any) => Promise<unknown>) {
      let release!: () => void;
      const before = queue;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await before;
      const draft = structuredClone(state);
      const tx = {
        $queryRaw: async () => [],
        installation: {
          findUnique: async () => draft.installation,
          upsert: async () => draft.installation,
          update: async ({ data }: any) =>
            Object.assign(draft.installation, data),
        },
        verification: {
          findFirst: async ({ where }: any) =>
            draft.verifications.find(
              (item) =>
                item.identifier === where.identifier &&
                (!where.value || item.value === where.value) &&
                item.expiresAt > where.expiresAt.gt,
            ),
          create: async ({ data }: any) => {
            draft.verifications.push(data);
            return data;
          },
          update: async ({ where, data }: any) => {
            const current = draft.verifications.find(
              (item) => item.id === where.id,
            )!;
            Object.assign(current, data);
            return current;
          },
          delete: async ({ where }: any) => {
            draft.verifications = draft.verifications.filter(
              (item) => item.id !== where.id,
            );
          },
        },
        hackathon: { findFirst: async () => ({ id: 'hackathon' }) },
        invitation: {
          findUnique: async ({ where }: any) =>
            draft.invitation?.tokenHash === where.tokenHash
              ? draft.invitation
              : null,
          updateMany: async () => {
            draft.invitation.usedCount++;
            return { count: 1 };
          },
        },
        user: {
          findUnique: async ({ where }: { where: { email: string } }) =>
            draft.users.find((user) => user.email === where.email) ?? null,
          create: async ({ data }: any) => {
            if (draft.users.some((user) => user.email === data.email))
              throw new AppError(AppErrorCode.CONFLICT, 'Account exists.');
            draft.users.push(data);
            return data;
          },
        },
        invitationRedemption: {
          create: async ({ data }: any) => draft.redemptions.push(data),
        },
        judgeCategory: {
          createMany: async ({ data }: any) => draft.memberships.push(...data),
        },
        auditLog: {
          create: async ({ data }: any) => {
            if (failAudit) throw new Error('Simulated audit failure');
            draft.audits.push(data);
          },
        },
      };
      try {
        const result = await run(tx);
        state = draft;
        return result;
      } finally {
        release();
      }
    },
  } as unknown as PrismaClient;
  return {
    ctx: createSystemContext({
      service: 'registration',
      source: 'web-action',
      db,
    }),
    read: () => state,
  };
}
const invitation = {
  id: 'invite',
  tokenHash: hash('invite-token'),
  role: 'JUDGE',
  hackathonId: 'hackathon',
  email: input.email,
  status: 'ACTIVE',
  expiresAt: new Date(Date.now() + 60_000),
  usedCount: 0,
  maxUses: 1,
  categories: [
    { categoryId: 'category', category: { hackathonId: 'hackathon' } },
  ],
};

const invitedInput = { ...input, invitationToken: 'invite-token' };

function rejectsCode(promise: Promise<unknown>, code: ErrorCode) {
  return assert.rejects(
    promise,
    (error: unknown) => error instanceof AppError && error.code === code,
  );
}

test('names require two words, email is normalized, agreements are required', () => {
  assert.equal(
    registerAccountSchema.safeParse({ ...input, name: 'Ada' }).success,
    false,
  );
  assert.equal(
    registerAccountSchema.safeParse({ ...input, agreementRules: false })
      .success,
    false,
  );
  assert.equal(
    registerAccountSchema.safeParse({ ...input, agreementPrivacy: false })
      .success,
    false,
  );
  assert.equal(
    registerAccountSchema.safeParse({ ...input, password: 'short' }).success,
    false,
  );
  assert.equal(
    registerAccountSchema.parse({ ...input, email: 'ADA@example.test' }).email,
    input.email,
  );
});
test('unclaimed installation requires a valid setup grant', async () => {
  const db = database({ claimed: false });
  await rejectsCode(
    registerAccount(db.ctx, input, passwordCredentials),
    AppErrorCode.FORBIDDEN,
  );
  assert.equal(db.read().users.length, 0);
  assert.equal(db.read().installation.claimedAt, null);
});
test('concurrent owner registrations claim only once', async () => {
  const db = database({ claimed: false });
  const results = await Promise.allSettled([
    registerAccount(db.ctx, input, {
      ...passwordCredentials,
      setupToken: 'setup-token',
    }),
    registerAccount(
      db.ctx,
      { ...input, email: 'second@example.test' },
      { ...passwordCredentials, setupToken: 'setup-token' },
    ),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(db.read().users.length, 1);
  assert.equal(db.read().users[0].role, 'OWNER');
  assert.ok(db.read().installation.claimedAt);
  assert.equal(db.read().audits[0].action, 'installation.claim');
});
test('claimed installation remains invite only when no owner exists', async () => {
  const db = database({ invitation });
  await rejectsCode(
    registerAccount(db.ctx, input, passwordCredentials),
    AppErrorCode.FORBIDDEN,
  );
  await registerAccount(db.ctx, invitedInput, passwordCredentials);
  assert.equal(db.read().users[0].role, 'JUDGE');
});
test('OTP registration requires an invitation and email-bound proof, and never stores a password', async () => {
  const db = database({ invitation: { ...invitation, email: null } });
  await rejectsCode(
    registerAccount(db.ctx, input, {
      mode: 'otp',
      emailProofToken: 'email-token',
    }),
    AppErrorCode.FORBIDDEN,
  );
  await rejectsCode(
    registerAccount(db.ctx, invitedInput, { mode: 'otp' }),
    AppErrorCode.FORBIDDEN,
  );
  await rejectsCode(
    registerAccount(
      db.ctx,
      { ...invitedInput, email: 'different@example.test' },
      { mode: 'otp', emailProofToken: 'email-token' },
    ),
    AppErrorCode.FORBIDDEN,
  );
  await registerAccount(db.ctx, invitedInput, {
    mode: 'otp',
    emailProofToken: 'email-token',
  });
  assert.equal(db.read().users[0].emailVerified, true);
  assert.equal(db.read().users[0].accounts, undefined);
  assert.equal(
    db.read().verifications.some((item) => item.id === 'proof'),
    false,
  );
});
test('invitation redemption assigns authorized categories and consumes one use', async () => {
  const db = database({ invitation });
  await registerAccount(
    db.ctx,
    { ...input, invitationToken: 'invite-token' },
    passwordCredentials,
  );
  assert.equal(db.read().invitation.usedCount, 1);
  assert.equal(db.read().redemptions.length, 1);
  assert.equal(db.read().memberships[0].categoryId, 'category');
  await rejectsCode(
    registerAccount(
      db.ctx,
      { ...input, invitationToken: 'invite-token' },
      passwordCredentials,
    ),
    AppErrorCode.INVALID_STATE,
  );
});
test('invalid invitations cannot grant roles or category access', async () => {
  for (const changes of [
    { role: 'OWNER' },
    { hackathonId: 'other-hackathon' },
    { email: 'other@example.test' },
    { status: 'REVOKED' },
    { usedCount: 1 },
    { expiresAt: new Date(0) },
    {
      categories: [
        {
          categoryId: 'other-category',
          category: { hackathonId: 'other-hackathon' },
        },
      ],
    },
  ]) {
    const db = database({ invitation: { ...invitation, ...changes } });
    await rejectsCode(
      registerAccount(
        db.ctx,
        { ...input, invitationToken: 'invite-token' },
        passwordCredentials,
      ),
      AppErrorCode.INVALID_STATE,
    );
    assert.equal(db.read().users.length, 0);
  }
});
test('audit failure rolls back the owner, claim, and consumed grant', async () => {
  const db = database({ claimed: false, failAudit: true });
  await rejectsCode(
    registerAccount(db.ctx, input, {
      ...passwordCredentials,
      setupToken: 'setup-token',
    }),
    AppErrorCode.INTERNAL_SERVER_ERROR,
  );
  assert.equal(db.read().users.length, 0);
  assert.equal(db.read().installation.claimedAt, null);
  assert.ok(db.read().verifications.some((item) => item.id === 'setup'));
});
test('authenticated user actors cannot invoke account provisioning', async () => {
  const db = database();
  await rejectsCode(
    registerAccount(
      { ...db.ctx, actor: { type: 'user', userId: 'someone', role: 'OWNER' } },
      input,
      passwordCredentials,
    ),
    AppErrorCode.FORBIDDEN,
  );
});

test('failed setup passcodes persist attempts and block repeated guessing', async () => {
  process.env.SETUP_PASSCODE = 'a-unique-setup-passcode';
  const db = database({ claimed: false });
  for (let attempt = 0; attempt < 5; attempt++)
    await rejectsCode(
      beginSetup(db.ctx, { passcode: 'incorrect-passcode' }),
      AppErrorCode.FORBIDDEN,
    );
  assert.equal(
    db.read().verifications.find((item) => item.identifier === 'setup-attempts')
      ?.value,
    '5',
  );
  await rejectsCode(
    beginSetup(db.ctx, { passcode: process.env.SETUP_PASSCODE }),
    AppErrorCode.FORBIDDEN,
  );
});
test('correct setup passcode grants access without claiming the installation', async () => {
  process.env.SETUP_PASSCODE = 'a-unique-setup-passcode';
  const db = database({ claimed: false });
  const result = await beginSetup(db.ctx, {
    passcode: process.env.SETUP_PASSCODE,
  });
  assert.ok(
    db
      .read()
      .verifications.some(
        (item) =>
          item.identifier === 'setup-grant' &&
          item.value === hash(result.token),
      ),
  );
  assert.equal(db.read().installation.claimedAt, null);
});
test('setup cannot reopen a claimed installation', async () => {
  process.env.SETUP_PASSCODE = 'a-unique-setup-passcode';
  await rejectsCode(
    beginSetup(database().ctx, { passcode: process.env.SETUP_PASSCODE }),
    AppErrorCode.INVALID_STATE,
  );
});

test('duplicate invited registration returns a safe email error without consuming another use', async () => {
  const db = database({ invitation: { ...invitation, maxUses: 2 } });
  await registerAccount(db.ctx, invitedInput, passwordCredentials);
  await assert.rejects(
    registerAccount(db.ctx, invitedInput, passwordCredentials),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === AppErrorCode.CONFLICT &&
      Boolean(error.fieldErrors?.email),
  );
  assert.equal(db.read().users.length, 1);
  assert.equal(db.read().audits.length, 1);
  assert.equal(db.read().invitation.usedCount, 1);
});

test('registration passwords require eight characters and reject whitespace or invisible padding', () => {
  assert.equal(
    registerAccountSchema.safeParse({ ...input, password: 'Abc123!?' }).success,
    true,
  );
  for (const password of [
    '',
    '1234567',
    '        ',
    ' abc1234',
    'abc1234 ',
    'abcd efgh',
    'abcd\tefgh',
    'abcd\nefgh',
    'abcd\u00a0efgh',
    'abcd\u200befgh',
    'abcd\u0000efgh',
  ]) {
    const parsed = registerAccountSchema.safeParse({ ...input, password });
    assert.equal(parsed.success, false);
    if (!parsed.success)
      assert.ok(
        parsed.error.issues.some((issue) => issue.path[0] === 'password'),
      );
  }
});

test('first registration cannot bypass the setup passcode with an invitation or forged grant', async () => {
  for (const setupToken of [undefined, 'forged-token']) {
    const db = database({ claimed: false, invitation });
    await rejectsCode(
      getRegistrationAccess(db.ctx, {
        setupToken,
        invitationToken: 'invite-token',
      }),
      AppErrorCode.FORBIDDEN,
    );
    await rejectsCode(
      registerAccount(db.ctx, invitedInput, {
        ...passwordCredentials,
        setupToken,
      }),
      AppErrorCode.FORBIDDEN,
    );
    assert.equal(db.read().users.length, 0);
    assert.equal(db.read().installation.claimedAt, null);
    assert.equal(db.read().invitation.usedCount, 0);
  }
});
test('expired setup grants cannot open registration or claim an owner', async () => {
  const db = database({ claimed: false });
  db.read().verifications.find((item) => item.id === 'setup')!.expiresAt =
    new Date(0);
  await rejectsCode(
    getRegistrationAccess(db.ctx, { setupToken: 'setup-token' }),
    AppErrorCode.FORBIDDEN,
  );
  await rejectsCode(
    registerAccount(db.ctx, input, {
      ...passwordCredentials,
      setupToken: 'setup-token',
    }),
    AppErrorCode.FORBIDDEN,
  );
  assert.equal(db.read().users.length, 0);
});
test('registration access rejects missing, invalid, or email-mismatched invitations before code delivery', async () => {
  const db = database({ invitation });
  await rejectsCode(getRegistrationAccess(db.ctx, {}), AppErrorCode.FORBIDDEN);
  await rejectsCode(
    getRegistrationAccess(db.ctx, { invitationToken: 'forged-token' }),
    AppErrorCode.INVALID_STATE,
  );
  await rejectsCode(
    getRegistrationAccess(db.ctx, {
      invitationToken: 'invite-token',
      email: 'other@example.test',
    }),
    AppErrorCode.INVALID_STATE,
  );
  assert.deepEqual(
    await getRegistrationAccess(db.ctx, {
      invitationToken: 'invite-token',
      email: input.email,
    }),
    { setup: false, email: input.email },
  );
  assert.equal(db.read().invitation.usedCount, 0);
});
test('setup registration access requires a real grant and does not consume it before account creation', async () => {
  const db = database({ claimed: false });
  assert.deepEqual(
    await getRegistrationAccess(db.ctx, { setupToken: 'setup-token' }),
    { setup: true, email: null },
  );
  assert.ok(db.read().verifications.some((item) => item.id === 'setup'));
  assert.equal(db.read().installation.claimedAt, null);
});
test('concurrent invitation redemptions cannot exceed its last use', async () => {
  const db = database({ invitation: { ...invitation, email: null } });
  const results = await Promise.allSettled([
    registerAccount(db.ctx, invitedInput, passwordCredentials),
    registerAccount(
      db.ctx,
      { ...invitedInput, email: 'second@example.test' },
      passwordCredentials,
    ),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(db.read().users.length, 1);
  assert.equal(db.read().invitation.usedCount, 1);
  assert.equal(db.read().redemptions.length, 1);
});

test('bulk QR invitations admit distinct judges concurrently up to their limit and retain track scope', async () => {
  const db = database({
    invitation: { ...invitation, email: null, maxUses: 2 },
  });
  const results = await Promise.allSettled([
    registerAccount(db.ctx, invitedInput, passwordCredentials),
    registerAccount(
      db.ctx,
      { ...invitedInput, email: 'second@example.test' },
      passwordCredentials,
    ),
    registerAccount(
      db.ctx,
      { ...invitedInput, email: 'third@example.test' },
      passwordCredentials,
    ),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    2,
  );
  assert.equal(db.read().users.length, 2);
  assert.equal(db.read().invitation.usedCount, 2);
  assert.equal(db.read().redemptions.length, 2);
  assert.equal(
    new Set(db.read().redemptions.map((row: { userId: string }) => row.userId))
      .size,
    2,
  );
  assert.equal(db.read().memberships.length, 2);
  assert.ok(
    db
      .read()
      .memberships.every(
        (row: { categoryId: string }) => row.categoryId === 'category',
      ),
  );
});

test('opening a valid invitation does not bypass later revocation, expiry, or exhaustion when creating an account', async () => {
  for (const changes of [
    { status: 'REVOKED' },
    { expiresAt: new Date(0) },
    { usedCount: invitation.maxUses },
  ]) {
    const db = database({ invitation });
    await getRegistrationAccess(db.ctx, { invitationToken: 'invite-token' });
    Object.assign(db.read().invitation, changes);
    await rejectsCode(
      getRegistrationAccess(db.ctx, { invitationToken: 'invite-token' }),
      AppErrorCode.INVALID_STATE,
    );
    await rejectsCode(
      registerAccount(db.ctx, invitedInput, passwordCredentials),
      AppErrorCode.INVALID_STATE,
    );
    assert.equal(db.read().users.length, 0);
    assert.equal(db.read().redemptions.length, 0);
  }
});
