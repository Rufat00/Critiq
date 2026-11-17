-- AlterTable
ALTER TABLE "JudgingCategory" ADD COLUMN     "maxEvaluations" INTEGER NOT NULL DEFAULT 9,
ALTER COLUMN "minEvaluations" SET DEFAULT 3;

-- AlterTable
ALTER TABLE "JudgingAssignment" ADD COLUMN     "visitId" TEXT;

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "ordinalRating" INTEGER,
ADD COLUMN     "scoringRevision" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "JudgingConfiguration" (
    "hackathonId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "policy" JSONB NOT NULL,
    "plan" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgingConfiguration_pkey" PRIMARY KEY ("hackathonId")
);

-- CreateTable
CREATE TABLE "RoomStayEpoch" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "reachableProjectIds" TEXT[],
    "physicalRoomSize" INTEGER NOT NULL,
    "thresholdPercent" INTEGER NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "moveReason" TEXT,
    "travelMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "RoomStayEpoch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgingVisit" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "epochId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "reason" TEXT NOT NULL,
    "estimatedMinutes" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "JudgingVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingRevision" (
    "categoryId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RankingRevision_pkey" PRIMARY KEY ("categoryId","judgeId")
);

-- CreateTable
CREATE TABLE "CompetitionResultSnapshot" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "scoringRevision" INTEGER NOT NULL,
    "evidence" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "exceptionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionResultSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomStayEpoch_hackathonId_judgeId_idx" ON "RoomStayEpoch"("hackathonId", "judgeId");

-- CreateIndex
CREATE INDEX "JudgingVisit_hackathonId_status_expiresAt_idx" ON "JudgingVisit"("hackathonId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "JudgingVisit_hackathonId_judgeId_requestKey_key" ON "JudgingVisit"("hackathonId", "judgeId", "requestKey");

-- CreateIndex
CREATE INDEX "CompetitionResultSnapshot_categoryId_createdAt_idx" ON "CompetitionResultSnapshot"("categoryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_categoryId_judgeId_projectId_key" ON "Evaluation"("categoryId", "judgeId", "projectId");

-- AddForeignKey
ALTER TABLE "JudgingAssignment" ADD CONSTRAINT "JudgingAssignment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "JudgingVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingConfiguration" ADD CONSTRAINT "JudgingConfiguration_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomStayEpoch" ADD CONSTRAINT "RoomStayEpoch_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomStayEpoch" ADD CONSTRAINT "RoomStayEpoch_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomStayEpoch" ADD CONSTRAINT "RoomStayEpoch_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingVisit" ADD CONSTRAINT "JudgingVisit_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingVisit" ADD CONSTRAINT "JudgingVisit_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingVisit" ADD CONSTRAINT "JudgingVisit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingVisit" ADD CONSTRAINT "JudgingVisit_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingVisit" ADD CONSTRAINT "JudgingVisit_epochId_fkey" FOREIGN KEY ("epochId") REFERENCES "RoomStayEpoch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingRevision" ADD CONSTRAINT "RankingRevision_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "JudgingCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingRevision" ADD CONSTRAINT "RankingRevision_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResultSnapshot" ADD CONSTRAINT "CompetitionResultSnapshot_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "JudgingCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Coverage and observations are independent of retries and physical visit count.
ALTER TABLE "JudgingCategory" ADD CONSTRAINT "JudgingCategory_maximum_coverage"
  CHECK ("maxEvaluations" >= "minEvaluations" AND ("targetEvaluations" IS NULL OR "targetEvaluations" <= "maxEvaluations"));
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_ordinal_bounds" CHECK ("ordinalRating" IS NULL OR "ordinalRating" BETWEEN 1 AND 5);
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_scoring_revision" CHECK ("scoringRevision" > 0);
ALTER TABLE "JudgingConfiguration" ADD CONSTRAINT "JudgingConfiguration_revision" CHECK ("revision" > 0);
ALTER TABLE "RankingRevision" ADD CONSTRAINT "RankingRevision_revision" CHECK ("revision" >= 0);
ALTER TABLE "RoomStayEpoch" ADD CONSTRAINT "RoomStayEpoch_bounds" CHECK ("thresholdPercent" BETWEEN 0 AND 100 AND "physicalRoomSize" >= cardinality("reachableProjectIds") AND cardinality("reachableProjectIds") > 0 AND "travelMinutes" >= 0);
ALTER TABLE "JudgingVisit" ADD CONSTRAINT "JudgingVisit_duration" CHECK ("estimatedMinutes" > 0 AND "expiresAt" > "createdAt");
CREATE UNIQUE INDEX "JudgingVisit_one_active_per_judge" ON "JudgingVisit" ("judgeId") WHERE "status" IN ('ASSIGNED', 'IN_PROGRESS');
CREATE UNIQUE INDEX "JudgingVisit_one_active_per_project" ON "JudgingVisit" ("projectId") WHERE "status" IN ('ASSIGNED', 'IN_PROGRESS');
CREATE UNIQUE INDEX "RoomStayEpoch_one_current_per_judge" ON "RoomStayEpoch" ("judgeId") WHERE "exitedAt" IS NULL;

ALTER TABLE "Evaluation" ADD COLUMN "isExcluded" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "exclusionReason" TEXT;
ALTER TABLE "CompetitionResultSnapshot" ADD COLUMN "supersededAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "isJudgingAvailable" BOOLEAN NOT NULL DEFAULT true;
-- Align the historical database default with the approved current schema.
ALTER TABLE "Hackathon" ALTER COLUMN "scoreScale" SET DEFAULT 5;
