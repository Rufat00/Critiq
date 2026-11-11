-- Rotation is configured once for the entire hackathon.
ALTER TABLE "Hackathon" ADD COLUMN "roomSwitchPercent" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "Hackathon" ADD CONSTRAINT "Hackathon_room_switch_percent"
  CHECK ("roomSwitchPercent" BETWEEN 0 AND 100 AND "roomSwitchPercent" % 5 = 0);
ALTER TABLE "Track" DROP COLUMN "roomSwitchPercent";
