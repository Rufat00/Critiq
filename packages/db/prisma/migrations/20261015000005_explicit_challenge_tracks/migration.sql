-- Expand current all-track memberships to explicit existing tracks.
-- New tracks are never enrolled automatically.
ALTER TABLE "Challenge" ADD COLUMN "includesOverall" BOOLEAN NOT NULL DEFAULT true;
UPDATE "Challenge" SET "includesOverall" = "allTracks";
INSERT INTO "ChallengeTrack" ("challengeId", "trackId")
SELECT c."id", t."id" FROM "Challenge" c
JOIN "Track" t ON t."hackathonId" = c."hackathonId"
WHERE c."allTracks" = true
ON CONFLICT ("challengeId", "trackId") DO NOTHING;
ALTER TABLE "Challenge" DROP COLUMN "allTracks";
