-- Specialized-track inclusion in Overall is not supported.
ALTER TABLE "Track" ALTER COLUMN "disqualifiesFromOverall" SET DEFAULT true;
UPDATE "Track" SET "disqualifiesFromOverall" = true WHERE "disqualifiesFromOverall" = false;
ALTER TABLE "Track" ADD CONSTRAINT track_excluded_from_overall CHECK ("disqualifiesFromOverall" = true);
