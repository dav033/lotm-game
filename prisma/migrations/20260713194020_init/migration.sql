-- CreateTable
CREATE TABLE "Element" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "iconKey" TEXT NOT NULL DEFAULT 'sparkles',
    "imageUrl" TEXT,
    "type" TEXT NOT NULL DEFAULT 'OTRO',
    "tier" INTEGER NOT NULL DEFAULT 0,
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "isHiddenUntilDiscovered" BOOLEAN NOT NULL DEFAULT true,
    "isMajorDiscovery" BOOLEAN NOT NULL DEFAULT false,
    "revealTitle" TEXT,
    "revealText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ElementCategory" (
    "elementId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("elementId", "categoryId"),
    CONSTRAINT "ElementCategory_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElementCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pathway" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT NOT NULL,
    "iconKey" TEXT,
    "imageUrl" TEXT,
    "isHiddenUntilDiscovered" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pathway_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pathwayId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "elementId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sequence_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sequence_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "inputKey" TEXT NOT NULL,
    "outputElementId" TEXT NOT NULL,
    "outputQuantity" INTEGER NOT NULL DEFAULT 1,
    "successText" TEXT,
    "hintText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recipe_outputElementId_fkey" FOREIGN KEY ("outputElementId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeIngredient_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetAt" DATETIME
);

-- CreateTable
CREATE TABLE "PlayerDiscovery" (
    "profileId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "firstDiscoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timesCreated" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("profileId", "elementId"),
    CONSTRAINT "PlayerDiscovery_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerDiscovery_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerPathwayUnlock" (
    "profileId" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("profileId", "pathwayId"),
    CONSTRAINT "PlayerPathwayUnlock_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerPathwayUnlock_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerCombinationStat" (
    "profileId" TEXT NOT NULL,
    "inputKey" TEXT NOT NULL,
    "recipeId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "successes" INTEGER NOT NULL DEFAULT 0,
    "firstAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("profileId", "inputKey"),
    CONSTRAINT "PlayerCombinationStat_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerCombinationStat_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Element_slug_key" ON "Element"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Pathway_slug_key" ON "Pathway"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_elementId_key" ON "Sequence"("elementId");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_pathwayId_number_key" ON "Sequence"("pathwayId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_inputKey_key" ON "Recipe"("inputKey");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredient_recipeId_elementId_key" ON "RecipeIngredient"("recipeId", "elementId");

-- CreateIndex
CREATE INDEX "PlayerCombinationStat_inputKey_idx" ON "PlayerCombinationStat"("inputKey");
