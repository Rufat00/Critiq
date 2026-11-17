import type { SetupSnapshot } from '../../hackathon/lib/read-setup-snapshot';
import { createHash } from 'node:crypto';
const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Exclude stages, timestamps and derived quotas; include every input that can invalidate the frozen plan.
export function judgingSetupFingerprint({ hackathon, judges }: SetupSnapshot) {
  return fingerprint({
    scoreScale: hackathon.scoreScale,
    roomSwitchPercent: hackathon.roomSwitchPercent,
    categories: hackathon.categories
      .filter((c) => c.isEnabled)
      .map((c) => ({
        id: c.id,
        method: c.method,
        judges: c.judges.map((j) => ({
          userId: j.userId,
          isActive: j.isActive,
        })),
        rubric: c.rubric?.criteria.map((r) => ({
          id: r.id,
          weight: Number(r.weight),
        })),
        trackId: c.track?.id,
        challenge: c.challenge
          ? {
              id: c.challenge.id,
              tracks: c.challenge.allowedTracks.map((t) => t.trackId),
            }
          : null,
      })),
    projects: hackathon.projects.map((p) => ({
      id: p.id,
      trackId: p.trackId,
      roomId: p.roomId,
      active: p.isActive,
      disqualified: p.isDisqualified,
      challenges: p.challenges.map((c) => c.challengeId),
    })),
    rooms: hackathon.rooms.map((r) => ({ id: r.id, isActive: r.isActive })),
    judges: judges.map((j) => ({
      id: j.id,
      isActive: j.isActive,
      conflicts: j.conflicts.map((c) => c.projectId),
    })),
  });
}
