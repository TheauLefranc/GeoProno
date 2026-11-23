-- CreateTable
CREATE TABLE "Bracket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "participants" TEXT[],
    "outcomes" JSONB NOT NULL,
    "scores" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "betId" TEXT NOT NULL,

    CONSTRAINT "Bracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketEntry" (
    "id" TEXT NOT NULL,
    "picks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bracketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wagerId" TEXT NOT NULL,

    CONSTRAINT "BracketEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bracket_betId_key" ON "Bracket"("betId");

-- CreateIndex
CREATE INDEX "Bracket_createdAt_idx" ON "Bracket"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BracketEntry_wagerId_key" ON "BracketEntry"("wagerId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketEntry_bracketId_userId_key" ON "BracketEntry"("bracketId", "userId");

-- AddForeignKey
ALTER TABLE "Bracket" ADD CONSTRAINT "Bracket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bracket" ADD CONSTRAINT "Bracket_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketEntry" ADD CONSTRAINT "BracketEntry_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketEntry" ADD CONSTRAINT "BracketEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketEntry" ADD CONSTRAINT "BracketEntry_wagerId_fkey" FOREIGN KEY ("wagerId") REFERENCES "Wager"("id") ON DELETE CASCADE ON UPDATE CASCADE;

