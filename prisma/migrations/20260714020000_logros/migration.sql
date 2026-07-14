-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "iconKey" TEXT NOT NULL DEFAULT 'trophy',
    "triggerElementId" TEXT,
    "triggerSequenceId" TEXT,
    "isHiddenUntilUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Achievement_triggerElementId_fkey" FOREIGN KEY ("triggerElementId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Achievement_triggerSequenceId_fkey" FOREIGN KEY ("triggerSequenceId") REFERENCES "Sequence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerAchievement" (
    "profileId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" DATETIME,

    PRIMARY KEY ("profileId", "achievementId"),
    CONSTRAINT "PlayerAchievement_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement"("slug");
