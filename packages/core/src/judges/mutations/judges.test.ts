import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { AppContext } from '../../context';

process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
const { judgeDatabase } = await import('../lib/judges.fixture');
const { createJudgeInvitation } = await import('./create-judge-invitation');
const { moveJudge } = await import('./move-judge');
const { removeJudge } = await import('./remove-judge');
const { revokeJudgeInvitation } = await import('./revoke-judge-invitation');
const { AppError } = await import('../../shared/errors');
const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (error: unknown) => error instanceof AppError && error.code === code,
  );

test('QR invitations have random hashed tokens, bulk use, track scope, 20-minute expiry, and no secret in audits', async () => {
  const db = judgeDatabase();
  const first = await createJudgeInvitation(db.ctx, { categoryId: 'overall' });
  const second = await createJudgeInvitation(db.ctx, { categoryId: 'overall' });
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/u);
  assert.notEqual(first.token, second.token);
  const [old, current] = db.read().invitations;
  assert.equal(old!.status, 'REVOKED');
  assert.equal(current!.status, 'ACTIVE');
  assert.equal(current!.maxUses, 100);
  assert.equal(
    current!.tokenHash,
    createHash('sha256').update(second.token).digest('hex'),
  );
  assert.equal(current!.categories.create.categoryId, 'overall');
  assert.ok(current!.expiresAt.getTime() - Date.now() <= 20 * 60_000);
  assert.ok(current!.expiresAt.getTime() - Date.now() > 19 * 60_000);
  assert.ok(!JSON.stringify(db.read().audits).includes(first.token));
  assert.ok(!JSON.stringify(db.read().audits).includes(current!.tokenHash));
});

test('QR rotation is isolated to its track and concurrent generation leaves one active invitation', async () => {
  const db = judgeDatabase();
  await createJudgeInvitation(db.ctx, { categoryId: 'track' });
  await Promise.all([
    createJudgeInvitation(db.ctx, { categoryId: 'overall' }),
    createJudgeInvitation(db.ctx, { categoryId: 'overall' }),
  ]);
  assert.equal(
    db.read().invitations.filter((row) => row.status === 'ACTIVE').length,
    2,
  );
});

test('email invitations normalize email, bind the recipient and expire in 24 hours; no-email mode blocks server calls', async () => {
  const prior = process.env.NO_EMAIL_LOWER_SECURITY_MODE;
  try {
    process.env.NO_EMAIL_LOWER_SECURITY_MODE = 'false';
    const db = judgeDatabase();
    const result = await createJudgeInvitation(db.ctx, {
      categoryId: 'track',
      email: ' Judge@Example.com ',
    });
    assert.equal(result.email, 'judge@example.com');
    assert.ok(
      new Date(result.expiresAt).getTime() - Date.now() > 23 * 60 * 60_000,
    );
    await rejects(
      createJudgeInvitation(db.ctx, {
        categoryId: 'track',
        email: 'existing@example.com',
      }),
      'CONFLICT',
    );
    process.env.NO_EMAIL_LOWER_SECURITY_MODE = 'true';
    await rejects(
      createJudgeInvitation(db.ctx, {
        categoryId: 'track',
        email: 'new@example.com',
      }),
      'INVALID_STATE',
    );
    assert.equal(db.read().invitations.length, 1);
  } finally {
    if (prior === undefined) delete process.env.NO_EMAIL_LOWER_SECURITY_MODE;
    else process.env.NO_EMAIL_LOWER_SECURITY_MODE = prior;
  }
});

test('organizer permissions, draft state, track scope, and validation are enforced', async () => {
  const db = judgeDatabase();
  for (const actor of [
    { type: 'user', userId: 'judge', role: 'JUDGE' },
    { type: 'system', service: 'test' },
  ] as AppContext['actor'][]) {
    await rejects(
      createJudgeInvitation({ ...db.ctx, actor }, { categoryId: 'overall' }),
      'FORBIDDEN',
    );
    await rejects(
      removeJudge(
        { ...db.ctx, actor },
        { userId: 'judge', categoryId: 'overall' },
      ),
      'FORBIDDEN',
    );
    await rejects(
      moveJudge(
        { ...db.ctx, actor },
        { userId: 'judge', categoryId: 'overall', targetCategoryId: 'track' },
      ),
      'FORBIDDEN',
    );
  }
  await rejects(
    createJudgeInvitation(db.ctx, { categoryId: 'foreign' }),
    'NOT_FOUND',
  );
  await rejects(
    createJudgeInvitation(db.ctx, { categoryId: 'overall', email: 'invalid' }),
    'VALIDATION_ERROR',
  );
  await rejects(
    createJudgeInvitation(
      { ...db.ctx, hackathonId: 'foreign' },
      { categoryId: 'overall' },
    ),
    'INVALID_STATE',
  );
  await rejects(
    createJudgeInvitation(judgeDatabase({ status: 'JUDGING' }).ctx, {
      categoryId: 'overall',
    }),
    'INVALID_STATE',
  );
  assert.equal(db.read().audits.length, 0);
});

test('moves change track access atomically; duplicate requests and foreign targets fail', async () => {
  const db = judgeDatabase();
  const input = {
    userId: 'judge',
    categoryId: 'overall',
    targetCategoryId: 'track',
  };
  await rejects(
    moveJudge(db.ctx, { ...input, targetCategoryId: 'foreign' }),
    'NOT_FOUND',
  );
  const results = await Promise.allSettled([
    moveJudge(db.ctx, input),
    moveJudge(db.ctx, input),
  ]);
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
  assert.deepEqual(
    db.read().memberships.map((row) => [row.categoryId, row.isActive]),
    [
      ['overall', false],
      ['track', true],
    ],
  );
  assert.equal(db.read().audits.length, 1);
  await rejects(
    moveJudge(db.ctx, { ...input, targetCategoryId: 'overall' }),
    'VALIDATION_ERROR',
  );
});

test('removal preserves membership history and activity prevents changes', async () => {
  const db = judgeDatabase();
  await removeJudge(db.ctx, { userId: 'judge', categoryId: 'overall' });
  assert.equal(db.read().memberships.length, 1);
  assert.equal(db.read().memberships[0]!.isActive, false);
  await rejects(
    removeJudge(db.ctx, { userId: 'judge', categoryId: 'overall' }),
    'NOT_FOUND',
  );
  await rejects(
    removeJudge(judgeDatabase({ activity: 1 }).ctx, {
      userId: 'judge',
      categoryId: 'overall',
    }),
    'INVALID_STATE',
  );
});

test('invitation revocation is scoped and audited', async () => {
  const db = judgeDatabase();
  const invitation = await createJudgeInvitation(db.ctx, {
    categoryId: 'overall',
  });
  await rejects(
    revokeJudgeInvitation(
      { ...db.ctx, hackathonId: 'foreign' },
      { invitationId: invitation.id },
    ),
    'NOT_FOUND',
  );
  await revokeJudgeInvitation(db.ctx, { invitationId: invitation.id });
  assert.equal(db.read().invitations[0]!.status, 'REVOKED');
  assert.equal(db.read().audits.length, 2);
});

test('audit failure rolls back invitations, moves, and removals', async () => {
  const db = judgeDatabase({ failAudit: true });
  await rejects(
    createJudgeInvitation(db.ctx, { categoryId: 'overall' }),
    'INTERNAL_SERVER_ERROR',
  );
  await rejects(
    moveJudge(db.ctx, {
      userId: 'judge',
      categoryId: 'overall',
      targetCategoryId: 'track',
    }),
    'INTERNAL_SERVER_ERROR',
  );
  await rejects(
    removeJudge(db.ctx, { userId: 'judge', categoryId: 'overall' }),
    'INTERNAL_SERVER_ERROR',
  );
  assert.equal(db.read().invitations.length, 0);
  assert.deepEqual(db.read().memberships, [
    { userId: 'judge', categoryId: 'overall', isActive: true },
  ]);
});

test('email delivery runs after commit, returns no bearer URL, and failures revoke the invitation', async () => {
  const { inviteJudge } = await import('./invite-judge');
  const keys = [
    'APP_URL',
    'NO_EMAIL_LOWER_SECURITY_MODE',
    'SENDGRID_API_KEY',
    'EMAIL_HOST',
    'EMAIL_FROM',
  ] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;
  try {
    Object.assign(process.env, {
      APP_URL: 'https://critiq.example.com',
      NO_EMAIL_LOWER_SECURITY_MODE: 'false',
      SENDGRID_API_KEY: 'test-key',
      EMAIL_HOST: '',
      EMAIL_FROM: 'organizer@example.com',
    });
    const db = judgeDatabase();
    globalThis.fetch = async (_url, options) => {
      assert.equal(
        db.read().invitations.length,
        1,
        'invitation is committed before delivery',
      );
      assert.match(
        String(options?.body),
        /https:\/\/critiq.example.com\/invite#token=/u,
      );
      return new Response(null, { status: 202 });
    };
    const sent = await inviteJudge(db.ctx, {
      categoryId: 'overall',
      email: 'new@example.com',
    });
    assert.equal(sent.url, null);
    assert.equal('token' in sent, false);
    globalThis.fetch = async () => new Response(null, { status: 400 });
    await rejects(
      inviteJudge(db.ctx, { categoryId: 'track', email: 'failed@example.com' }),
      'INVALID_STATE',
    );
    assert.equal(db.read().invitations[1]!.status, 'REVOKED');
    assert.equal(db.read().audits.length, 3);
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
