-- AlterTable
ALTER TABLE "AppSettings" ALTER COLUMN "refillThreshold" SET DEFAULT 100;

-- Existing installs: move the daily refill from 1000 to 100, unless an admin
-- already changed it to something else.
UPDATE "AppSettings" SET "refillThreshold" = 100 WHERE "refillThreshold" = 1000;
