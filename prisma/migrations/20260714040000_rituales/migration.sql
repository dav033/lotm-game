-- CreateTable
CREATE TABLE "Ritual" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "inputKey" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "requiredSequenceNumber" INTEGER NOT NULL DEFAULT 6,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ritual_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RitualIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ritualId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "RitualIngredient_ritualId_fkey" FOREIGN KEY ("ritualId") REFERENCES "Ritual" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RitualIngredient_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "RitualFailureOutput" (
    "ritualId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    PRIMARY KEY ("ritualId", "elementId"),
    CONSTRAINT "RitualFailureOutput_ritualId_fkey" FOREIGN KEY ("ritualId") REFERENCES "Ritual" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RitualFailureOutput_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PlayerRitual" (
    "profileId" TEXT NOT NULL,
    "ritualId" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("profileId", "ritualId"),
    CONSTRAINT "PlayerRitual_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerRitual_ritualId_fkey" FOREIGN KEY ("ritualId") REFERENCES "Ritual" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Ritual_inputKey_key" ON "Ritual"("inputKey");
CREATE UNIQUE INDEX "Ritual_advanceId_key" ON "Ritual"("advanceId");
CREATE UNIQUE INDEX "RitualIngredient_ritualId_elementId_key" ON "RitualIngredient"("ritualId", "elementId");
