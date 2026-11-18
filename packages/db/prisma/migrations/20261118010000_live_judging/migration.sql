ALTER TABLE "Hackathon" ADD COLUMN "judgingSeconds" INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN "judgingPausedAt" TIMESTAMP(3),
  ADD CONSTRAINT "Hackathon_judging_seconds" CHECK ("judgingSeconds" BETWEEN 60 AND 3600);
ALTER TABLE "JudgingCategory" DROP CONSTRAINT "JudgingCategory_judging_limits";
ALTER TABLE "JudgingCategory" DROP COLUMN "timerSeconds";
ALTER TABLE "JudgingCategory" ADD CONSTRAINT "JudgingCategory_judging_limits"
  CHECK ("minEvaluations" > 0 AND ("targetEvaluations" IS NULL OR "targetEvaluations" >= "minEvaluations"));
ALTER TABLE "JudgingVisit" ADD COLUMN "timerStartedAt" TIMESTAMP(3),
  ADD COLUMN "timerRunningSince" TIMESTAMP(3),
  ADD COLUMN "timerElapsedSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "presentationFinishedAt" TIMESTAMP(3),
  ADD CONSTRAINT "JudgingVisit_timer_elapsed" CHECK ("timerElapsedSeconds" >= 0);
