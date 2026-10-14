import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/critiq_test';
process.env.AUTH_SECRET ??= 'test-auth-secret-that-is-long-enough-for-tests';
const { db } = await import('@critiq/db');
const { verifyRegistrationCode, RegistrationVerificationError } =
  await import('./registration-verification');
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const email = 'judge@example.test';

test('registration OTP attempts, expiry, binding, and one-time use', async (t) => {
  const original = db.$transaction;
  let current: {
    id: string;
    identifier: string;
    value: string;
    expiresAt: Date;
  } | null = null;
  let proofs: { identifier: string; value: string; expiresAt: Date }[] = [];
  let queue = Promise.resolve();
  const reset = (expiresAt = new Date(Date.now() + 60_000)) => {
    current = {
      id: 'code',
      identifier: `registration-code:${email}`,
      value: `${digest('123456')}:0`,
      expiresAt,
    };
    proofs = [];
  };
  // Use a serialized auth-store double; no live database or network delivery.
  const transaction = async (run: (tx: unknown) => Promise<unknown>) => {
    const before = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await before;
    const tx = {
      $queryRaw: async () => [],
      verification: {
        findFirst: async ({ where }: { where: { identifier: string } }) =>
          current?.identifier === where.identifier ? current : null,
        update: async ({ data }: { data: { value: string } }) => {
          current!.value = data.value;
        },
        delete: async () => {
          current = null;
        },
        create: async ({ data }: { data: (typeof proofs)[number] }) => {
          proofs.push(data);
        },
      },
    };
    try {
      return await run(tx);
    } finally {
      release();
    }
  };
  db.$transaction = transaction as typeof db.$transaction;
  try {
    await t.test(
      'five incorrect attempts block even a correct code',
      async () => {
        reset();
        for (let index = 0; index < 5; index++)
          await assert.rejects(
            verifyRegistrationCode(email, '999999'),
            RegistrationVerificationError,
          );
        assert.equal(current?.value.split(':')[1], '5');
        await assert.rejects(
          verifyRegistrationCode(email, '123456'),
          RegistrationVerificationError,
        );
        assert.equal(proofs.length, 0);
      },
    );
    await t.test(
      'expired codes cannot create verification proofs',
      async () => {
        reset(new Date(0));
        await assert.rejects(
          verifyRegistrationCode(email, '123456'),
          RegistrationVerificationError,
        );
        assert.equal(proofs.length, 0);
      },
    );
    await t.test('a code cannot verify a different email address', async () => {
      reset();
      await assert.rejects(
        verifyRegistrationCode('other@example.test', '123456'),
        RegistrationVerificationError,
      );
      assert.equal(proofs.length, 0);
    });
    await t.test(
      'concurrent code submissions yield one hashed email-bound proof',
      async () => {
        reset();
        const results = await Promise.allSettled([
          verifyRegistrationCode(email, '123456'),
          verifyRegistrationCode(email, '123456'),
        ]);
        const success = results.find((result) => result.status === 'fulfilled');
        assert.ok(success?.status === 'fulfilled');
        assert.equal(
          results.filter((result) => result.status === 'fulfilled').length,
          1,
        );
        assert.equal(proofs.length, 1);
        assert.equal(proofs[0]?.identifier, `registration-proof:${email}`);
        assert.equal(proofs[0]?.value, digest(success.value));
        assert.equal(current, null);
      },
    );
  } finally {
    db.$transaction = original;
  }
});
