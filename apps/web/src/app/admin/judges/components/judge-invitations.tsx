'use client';
import { RiUserLine } from '@remixicon/react';
import type { JudgeInvitations as JudgeInvitationsData } from '@critiq/core/judges';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { RevokeInvitation } from './revoke-invitation';

export function JudgeInvitations({
  invitations,
  search,
  pending,
  onReset,
}: {
  invitations: JudgeInvitationsData;
  search: string;
  pending: boolean;
  onReset: () => void;
}) {
  return invitations.items.length === 0 ? (
    <EmptyState
      icon={<RiUserLine />}
      title="No pending invitations"
      description={
        search
          ? 'Try a different email address.'
          : 'Unused invitations will appear here until they expire or are revoked.'
      }
      action={
        <Button variant="secondary" disabled={pending} onClick={onReset}>
          Refresh invitations
        </Button>
      }
    />
  ) : (
    <div className="flex flex-col gap-3">
      {invitations.items.map((invitation) => (
        <article
          key={invitation.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <p className="break-all font-medium">
              {invitation.email ?? 'Bulk QR invitation'}
            </p>
            <p className="text-sm text-muted-foreground">
              Expires{' '}
              <time dateTime={invitation.expiresAt}>
                {new Intl.DateTimeFormat('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'America/Chicago',
                }).format(new Date(invitation.expiresAt))}{' '}
                CT
              </time>
            </p>
          </div>
          <RevokeInvitation id={invitation.id} />
        </article>
      ))}
    </div>
  );
}
