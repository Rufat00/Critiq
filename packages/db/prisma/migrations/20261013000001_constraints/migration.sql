-- Constraints Prisma cannot currently express in schema.prisma.
-- Keep these in migration history; do not bypass migrations with db push.

CREATE UNIQUE INDEX "User_single_owner"
  ON "User" ("role") WHERE "role" = 'OWNER';

ALTER TABLE "Installation" ADD CONSTRAINT "Installation_singleton_id"
  CHECK ("id" = 1);

CREATE UNIQUE INDEX "Hackathon_single_installation"
  ON "Hackathon" ((true));

CREATE UNIQUE INDEX "JudgingCategory_one_overall"
  ON "JudgingCategory" ("hackathonId") WHERE "kind" = 'OVERALL';

ALTER TABLE "Hackathon" ADD CONSTRAINT "Hackathon_score_scale"
  CHECK ("scoreScale" IN (5, 10));

ALTER TABLE "JudgingCategory" ADD CONSTRAINT "JudgingCategory_judging_limits"
  CHECK (
    "timerSeconds" > 0 AND "minEvaluations" > 0 AND
    ("targetEvaluations" IS NULL OR "targetEvaluations" >= "minEvaluations")
  );

ALTER TABLE "Track" ADD CONSTRAINT "Track_room_switch_percent"
  CHECK ("roomSwitchPercent" BETWEEN 0 AND 100);

ALTER TABLE "TrackRoomTableRange" ADD CONSTRAINT "TrackRoomTableRange_bounds"
  CHECK ("fromNumber" >= 0 AND "toNumber" >= "fromNumber");

ALTER TABLE "Project" ADD CONSTRAINT "Project_table_number"
  CHECK ("tableNumber" IS NULL OR "tableNumber" >= 0);

ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_weight"
  CHECK ("weight" >= 0);

ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_nonnegative"
  CHECK ("score" >= 0);

ALTER TABLE "RelativeRanking" ADD CONSTRAINT "RelativeRanking_position"
  CHECK ("position" >= 1);

ALTER TABLE "JudgingAssignment" ADD CONSTRAINT "JudgingAssignment_attempt"
  CHECK ("attempt" >= 1);

CREATE UNIQUE INDEX "JudgingAssignment_one_active_per_judge_category"
  ON "JudgingAssignment" ("categoryId", "judgeId")
  WHERE "status" IN ('ASSIGNED', 'IN_PROGRESS');

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_use_limits"
  CHECK ("maxUses" >= 1 AND "usedCount" >= 0 AND "usedCount" <= "maxUses");
