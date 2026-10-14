-- The owner names the hackathon during setup, after initial provisioning.
ALTER TABLE "Hackathon" ALTER COLUMN "name" DROP NOT NULL;
