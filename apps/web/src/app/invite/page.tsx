import type { Metadata } from 'next';
import { authMode } from '@critiq/auth';
import { getAuthEntryState, redirectSignedInUser } from '../(auth)/queries';
import { InvitationLanding } from './invitation-landing';

export const metadata: Metadata = {
  title: 'Judge invitation · Critiq',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};
export default async function Page() {
  await redirectSignedInUser();
  const state = await getAuthEntryState();
  return <InvitationLanding mode={authMode} name={state.hackathonName} />;
}
