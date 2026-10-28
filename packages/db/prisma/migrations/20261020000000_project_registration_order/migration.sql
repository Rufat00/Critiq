BEGIN;
-- A durable insertion order also distinguishes projects inserted in one bulk import.
CREATE SEQUENCE "Project_registrationOrder_seq";
ALTER TABLE "Project" ADD COLUMN "registrationOrder" INTEGER;
-- Initialize the new ordering key from the only creation ordering available for existing rows.
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id")::INTEGER AS position
  FROM "Project"
)
UPDATE "Project" p SET "registrationOrder" = ordered.position FROM ordered WHERE p."id" = ordered."id";
SELECT setval('"Project_registrationOrder_seq"', COALESCE(MAX("registrationOrder"), 0) + 1, false) FROM "Project";
ALTER SEQUENCE "Project_registrationOrder_seq" OWNED BY "Project"."registrationOrder";
ALTER TABLE "Project" ALTER COLUMN "registrationOrder" SET DEFAULT nextval('"Project_registrationOrder_seq"');
ALTER TABLE "Project" ALTER COLUMN "registrationOrder" SET NOT NULL;
CREATE UNIQUE INDEX "Project_registrationOrder_key" ON "Project"("registrationOrder");
CREATE INDEX "Project_hackathonId_registrationOrder_idx" ON "Project"("hackathonId", "registrationOrder");
COMMIT;
