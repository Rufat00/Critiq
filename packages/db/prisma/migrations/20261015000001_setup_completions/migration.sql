ALTER TABLE "setup_reviews" RENAME TO "setup_completions";
ALTER TABLE "setup_completions" RENAME COLUMN "reviewedById" TO "completedById";
ALTER TABLE "setup_completions" RENAME COLUMN "reviewedAt" TO "completedAt";
ALTER TABLE "setup_completions" RENAME CONSTRAINT "setup_reviews_pkey" TO "setup_completions_pkey";
ALTER TABLE "setup_completions" RENAME CONSTRAINT "setup_reviews_hackathonId_fkey" TO "setup_completions_hackathonId_fkey";
ALTER TABLE "setup_completions" RENAME CONSTRAINT "setup_reviews_reviewedById_fkey" TO "setup_completions_completedById_fkey";
ALTER TABLE "setup_completions" DROP CONSTRAINT "setup_reviews_section_check";
ALTER TABLE "setup_completions" ADD CONSTRAINT "setup_completions_section_check"
  CHECK ("section" IN ('event', 'categories', 'projects', 'judges', 'rooms'));
