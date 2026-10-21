-- Clean pre-production model change. Do not silently reinterpret existing setup data.
-- Recreate disposable development databases before deploying, then run the setup seed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "JudgingCategory") OR EXISTS (SELECT 1 FROM "Project") THEN
    RAISE EXCEPTION 'Explicit Overall tracks require a fresh development database. Recreate disposable development data, deploy migrations, then seed. No data was changed.';
  END IF;
END;
$$;

-- Run the preflight before opening the explicit transaction so Prisma reports its message.
BEGIN;
ALTER TABLE "Track" DROP CONSTRAINT track_excluded_from_overall;
ALTER TABLE "Track" DROP COLUMN "disqualifiesFromOverall";
ALTER TABLE "Challenge" DROP COLUMN "includesOverall";
ALTER TABLE "Project" DROP CONSTRAINT "Project_trackId_fkey";
ALTER TABLE "Project" ALTER COLUMN "trackId" SET NOT NULL;
ALTER TABLE "Project" ADD CONSTRAINT "Project_trackId_fkey"
  FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defer subtype completeness until commit so nested category/subtype creation is atomic.
CREATE FUNCTION check_category_subtype() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  category_ids TEXT[];
  category_id TEXT;
  category_row "JudgingCategory"%ROWTYPE;
  track_count INTEGER;
  challenge_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'JudgingCategory' THEN
    IF TG_OP = 'INSERT' THEN category_ids := ARRAY[NEW."id"];
    ELSIF TG_OP = 'DELETE' THEN category_ids := ARRAY[OLD."id"];
    ELSE category_ids := ARRAY[OLD."id", NEW."id"];
    END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN category_ids := ARRAY[NEW."categoryId"];
    ELSIF TG_OP = 'DELETE' THEN category_ids := ARRAY[OLD."categoryId"];
    ELSE category_ids := ARRAY[OLD."categoryId", NEW."categoryId"];
    END IF;
  END IF;
  FOREACH category_id IN ARRAY category_ids LOOP
    SELECT * INTO category_row FROM "JudgingCategory" WHERE "id" = category_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT COUNT(*) INTO track_count FROM "Track"
      WHERE "categoryId" = category_id AND "hackathonId" = category_row."hackathonId";
    SELECT COUNT(*) INTO challenge_count FROM "Challenge"
      WHERE "categoryId" = category_id AND "hackathonId" = category_row."hackathonId";
    IF (category_row."kind" IN ('OVERALL', 'TRACK') AND (track_count <> 1 OR challenge_count <> 0))
      OR (category_row."kind" = 'CHALLENGE' AND (challenge_count <> 1 OR track_count <> 0))
      OR EXISTS (SELECT 1 FROM "Track" WHERE "categoryId" = category_id AND "hackathonId" <> category_row."hackathonId")
      OR EXISTS (SELECT 1 FROM "Challenge" WHERE "categoryId" = category_id AND "hackathonId" <> category_row."hackathonId") THEN
      RAISE EXCEPTION 'Category must have exactly one matching subtype in the same hackathon' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER category_subtype AFTER INSERT OR UPDATE OR DELETE ON "JudgingCategory"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_category_subtype();
CREATE CONSTRAINT TRIGGER track_category_subtype AFTER INSERT OR UPDATE OR DELETE ON "Track"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_category_subtype();
CREATE CONSTRAINT TRIGGER challenge_category_subtype AFTER INSERT OR UPDATE OR DELETE ON "Challenge"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_category_subtype();
COMMIT;
