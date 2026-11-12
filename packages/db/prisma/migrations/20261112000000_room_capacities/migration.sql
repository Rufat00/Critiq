-- Clean pre-production replacement. Never discard existing room configuration silently.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TrackRoomTableRange")
     OR EXISTS (SELECT 1 FROM "Project" WHERE "tableNumber" IS NOT NULL OR "roomId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Room capacities replace table ranges. Use an explicitly approved disposable development reset before deploying this migration to a configured database.';
  END IF;
END $$;

DROP TABLE "TrackRoomTableRange";
ALTER TABLE "TrackRoom" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrackRoom" ADD CONSTRAINT "TrackRoom_capacity_check" CHECK ("capacity" >= 0);
ALTER TABLE "Project" DROP CONSTRAINT "Project_table_number";
ALTER TABLE "Project" ADD CONSTRAINT "Project_tableNumber_check" CHECK ("tableNumber" IS NULL OR "tableNumber" > 0);
-- Deferred uniqueness permits atomic compaction/reordering without temporary numbers.
ALTER TABLE "Project" ADD CONSTRAINT "Project_hackathonId_tableNumber_key"
  UNIQUE ("hackathonId", "tableNumber") DEFERRABLE INITIALLY DEFERRED;
