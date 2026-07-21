CREATE TABLE "ProgressionPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL,
    "unlockAtDiscoveryCount" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "ProgressionPhase_slug_key" ON "ProgressionPhase"("slug");
CREATE UNIQUE INDEX "ProgressionPhase_sortOrder_key" ON "ProgressionPhase"("sortOrder");

ALTER TABLE "Element" ADD COLUMN "availableFromPhaseId" TEXT
    REFERENCES "ProgressionPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
