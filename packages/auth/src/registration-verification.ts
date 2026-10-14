import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { createSystemContext } from '@critiq/core/context';
import { getEntryState } from '@critiq/core/registration';
import { db } from '@critiq/db';
import { createMailProvider, MailError } from '@critiq/mail';
import { hashPassword } from 'better-auth/crypto';
import { auth, authMode } from './auth';

export { hashPassword };
export class RegistrationVerificationError extends Error {}
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');

function translateRegistrationMailError(error: unknown): never {
  if (error instanceof MailError) {
    console.error('Registration email failed.', { mailErrorCode: error.code });
    throw new RegistrationVerificationError(
      error.code === 'CONFIGURATION'
        ? 'Email verification is unavailable. Please contact the organizer.'
        : 'We could not send your code. Please try again.',
    );
  }
  throw error;
}

export async function requestRegistrationCode(email: string) {
  if (authMode !== 'otp')
    throw new RegistrationVerificationError(
      'Email verification is unavailable.',
    );
  const { hackathonName } = await getEntryState(
    createSystemContext({ service: 'auth-email', source: 'worker' }),
    {},
  );
  let mail;
  try {
    mail = createMailProvider(process.env, { hackathonName });
  } catch (error) {
    translateRegistrationMailError(error);
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const challengeId = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(724182, hashtext(${email}))`;
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(724183, 1)`;
    const window = await tx.verification.findFirst({
      where: {
        identifier: 'registration-send-limit',
        expiresAt: { gt: new Date() },
      },
    });
    if (window && Number(window.value) >= 30)
      throw new RegistrationVerificationError(
        'Too many code requests. Please try again in a minute.',
      );
    if (window)
      await tx.verification.update({
        where: { id: window.id },
        data: { value: String(Number(window.value) + 1) },
      });
    else
      await tx.verification.create({
        data: {
          id: randomBytes(16).toString('hex'),
          identifier: 'registration-send-limit',
          value: '1',
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    const identifier = `registration-code:${email}`;
    const current = await tx.verification.findFirst({ where: { identifier } });
    if (current && current.createdAt.getTime() > Date.now() - 60_000)
      throw new RegistrationVerificationError(
        'Please wait a minute before requesting another code.',
      );
    await tx.verification.deleteMany({ where: { identifier } });
    const challenge = await tx.verification.create({
      data: {
        id: randomBytes(16).toString('hex'),
        identifier,
        value: `${digest(code)}:0`,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    return challenge.id;
  });
  try {
    const result = await mail.sendOTP({
      to: email,
      code,
      expiresInMinutes: 10,
    });
    if (result.status !== 'accepted')
      throw new RegistrationVerificationError(
        'Email verification is unavailable.',
      );
  } catch (error) {
    // Remove only this failed request; a later request must keep its own code.
    await db.verification.deleteMany({ where: { id: challengeId } });
    translateRegistrationMailError(error);
  }
}

export async function verifyRegistrationCode(email: string, code: string) {
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(724182, hashtext(${email}))`;
    const current = await tx.verification.findFirst({
      where: { identifier: `registration-code:${email}` },
    });
    if (!current || current.expiresAt <= new Date()) return null;
    const [hash, rawAttempts] = current.value.split(':');
    const attempts = Number(rawAttempts);
    if (!hash || attempts >= 5) return null;
    if (
      !/^\d{6}$/.test(code) ||
      !timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(digest(code), 'hex'),
      )
    ) {
      await tx.verification.update({
        where: { id: current.id },
        data: { value: `${hash}:${attempts + 1}` },
      });
      return null;
    }
    await tx.verification.delete({ where: { id: current.id } });
    const token = randomBytes(32).toString('hex');
    await tx.verification.create({
      data: {
        id: randomBytes(16).toString('hex'),
        identifier: `registration-proof:${email}`,
        value: digest(token),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    return token;
  });
  if (!result)
    throw new RegistrationVerificationError(
      'The code is incorrect or expired. Request a new code if needed.',
    );
  return result;
}

// Called only after core has committed a verified registration. Never expose this as a route.
export async function signInRegisteredAccount(
  email: string,
  password: string,
  headers: Headers,
) {
  if (authMode === 'password')
    return auth.api.signInEmail({
      body: { email, password },
      headers,
      returnHeaders: true,
    });
  const otp = await auth.api.createVerificationOTP({
    body: { email, type: 'sign-in' },
  });
  return auth.api.signInEmailOTP({
    body: { email, otp },
    headers,
    returnHeaders: true,
  });
}
