import { createSystemContext } from '@critiq/core/context';
import { getEntryState } from '@critiq/core/registration';
import { getAuthContext } from '@/lib/auth/auth-context';
import { cache } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';

export const getAuthEntryState = cache(async () => {
  await connection();
  return getEntryState(
    createSystemContext({ service: 'registration', source: 'web-page' }),
    {},
  );
});
export async function redirectSignedInUser() {
  const session = await getAuthContext();
  if (session) redirect(session.isJudge() ? '/judging' : '/admin');
}
