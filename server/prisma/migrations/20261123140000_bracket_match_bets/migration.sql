-- Per-match bets of a bracket + kick-off times.
-- Idempotent on purpose: a few development databases already received these
-- columns through an earlier, rewritten version of 20261123120000_brackets.

-- AlterTable
ALTER TABLE "Bet" ADD COLUMN IF NOT EXISTS "bracketMatchIndex" INTEGER,
ADD COLUMN IF NOT EXISTS "bracketSlots" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN IF NOT EXISTS "matchBracketId" TEXT;

-- AlterTable
ALTER TABLE "Bracket" ADD COLUMN IF NOT EXISTS "times" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bet_matchBracketId_idx" ON "Bet"("matchBracketId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bet_matchBracketId_fkey') THEN
    ALTER TABLE "Bet" ADD CONSTRAINT "Bet_matchBracketId_fkey" FOREIGN KEY ("matchBracketId") REFERENCES "Bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
