-- CreateTable
CREATE TABLE "Advance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "internalName" TEXT NOT NULL,
    "inputKey" TEXT NOT NULL,
    "sourceSequenceId" TEXT NOT NULL,
    "targetSequenceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Advance_sourceSequenceId_fkey" FOREIGN KEY ("sourceSequenceId") REFERENCES "Sequence" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Advance_targetSequenceId_fkey" FOREIGN KEY ("targetSequenceId") REFERENCES "Sequence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdvanceIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "advanceId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AdvanceIngredient_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdvanceIngredient_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerAdvance" (
    "profileId" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "firstObtainedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObtainedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timesCreated" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("profileId", "advanceId"),
    CONSTRAINT "PlayerAdvance_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerAdvance_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlayerCombinationStat" (
    "profileId" TEXT NOT NULL,
    "inputKey" TEXT NOT NULL,
    "recipeId" TEXT,
    "advanceId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "successes" INTEGER NOT NULL DEFAULT 0,
    "firstAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("profileId", "inputKey"),
    CONSTRAINT "PlayerCombinationStat_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerCombinationStat_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlayerCombinationStat_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlayerCombinationStat" ("attempts", "firstAttemptAt", "inputKey", "lastAttemptAt", "profileId", "recipeId", "successes") SELECT "attempts", "firstAttemptAt", "inputKey", "lastAttemptAt", "profileId", "recipeId", "successes" FROM "PlayerCombinationStat";
DROP TABLE "PlayerCombinationStat";
ALTER TABLE "new_PlayerCombinationStat" RENAME TO "PlayerCombinationStat";
CREATE INDEX "PlayerCombinationStat_inputKey_idx" ON "PlayerCombinationStat"("inputKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Advance_inputKey_key" ON "Advance"("inputKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceIngredient_advanceId_elementId_key" ON "AdvanceIngredient"("advanceId", "elementId");
