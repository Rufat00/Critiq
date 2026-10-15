ALTER TABLE "JudgingCategory" ADD COLUMN "isEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "setup_reviews" (
  "hackathonId" TEXT NOT NULL,
  "section" TEXT NOT NULL CHECK ("section" IN ('event', 'categories', 'projects', 'judges')),
  "fingerprint" TEXT NOT NULL,
  "reviewedById" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "setup_reviews_pkey" PRIMARY KEY ("hackathonId", "section"),
  CONSTRAINT "setup_reviews_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "setup_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
