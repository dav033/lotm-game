-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Element" (
    "id" TEXT NOT NULL,
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
    "unlockedByType" TEXT,
    "unlockedBySequenceNumber" INTEGER,
    "unlockedAtDiscoveryCount" INTEGER,
    "availableFromPhaseId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Element_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionPhase" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL,
    "unlockAtDiscoveryCount" INTEGER NOT NULL,
    "advancementRuleJson" TEXT NOT NULL DEFAULT '{"type":"ALWAYS"}',
    "celebrationMessage" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressionPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureGate" (
    "key" TEXT NOT NULL,
    "minimumPhaseSortOrder" INTEGER NOT NULL,

    CONSTRAINT "FeatureGate_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ElementUnlockTrigger" (
    "elementId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,

    CONSTRAINT "ElementUnlockTrigger_pkey" PRIMARY KEY ("elementId","triggerId")
);

-- CreateTable
CREATE TABLE "ElementUnlockRequirement" (
    "elementId" TEXT NOT NULL,
    "requiredElementId" TEXT NOT NULL,

    CONSTRAINT "ElementUnlockRequirement_pkey" PRIMARY KEY ("elementId","requiredElementId")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElementCategory" (
    "elementId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ElementCategory_pkey" PRIMARY KEY ("elementId","categoryId")
);

-- CreateTable
CREATE TABLE "Pathway" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT NOT NULL,
    "iconKey" TEXT,
    "imageUrl" TEXT,
    "isHiddenUntilDiscovered" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "elementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "inputKey" TEXT NOT NULL,
    "sourceSequenceId" TEXT NOT NULL,
    "targetSequenceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceIngredient" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AdvanceIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ritual" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputKey" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "requiredSequenceNumber" INTEGER NOT NULL DEFAULT 6,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ritual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RitualIngredient" (
    "id" TEXT NOT NULL,
    "ritualId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RitualIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RitualFailureOutput" (
    "ritualId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,

    CONSTRAINT "RitualFailureOutput_pkey" PRIMARY KEY ("ritualId","elementId")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "iconKey" TEXT NOT NULL DEFAULT 'trophy',
    "triggerElementId" TEXT,
    "triggerSequenceId" TEXT,
    "isHiddenUntilUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "inputKey" TEXT NOT NULL,
    "successText" TEXT,
    "hintText" TEXT,
    "minimumDiscoveries" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeSeedSuppression" (
    "inputKey" TEXT NOT NULL,
    "suppressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeSeedSuppression_pkey" PRIMARY KEY ("inputKey")
);

-- CreateTable
CREATE TABLE "RecipeOutput" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "chance" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetAt" TIMESTAMP(3),

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAdvance" (
    "profileId" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "firstObtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timesCreated" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PlayerAdvance_pkey" PRIMARY KEY ("profileId","advanceId")
);

-- CreateTable
CREATE TABLE "PlayerAchievement" (
    "profileId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "PlayerAchievement_pkey" PRIMARY KEY ("profileId","achievementId")
);

-- CreateTable
CREATE TABLE "PlayerRitual" (
    "profileId" TEXT NOT NULL,
    "ritualId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerRitual_pkey" PRIMARY KEY ("profileId","ritualId")
);

-- CreateTable
CREATE TABLE "PlayerDiscovery" (
    "profileId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "firstDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timesCreated" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PlayerDiscovery_pkey" PRIMARY KEY ("profileId","elementId")
);

-- CreateTable
CREATE TABLE "PlayerPathwayUnlock" (
    "profileId" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerPathwayUnlock_pkey" PRIMARY KEY ("profileId","pathwayId")
);

-- CreateTable
CREATE TABLE "PlayerCombinationStat" (
    "profileId" TEXT NOT NULL,
    "inputKey" TEXT NOT NULL,
    "recipeId" TEXT,
    "advanceId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "successes" INTEGER NOT NULL DEFAULT 0,
    "firstAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerCombinationStat_pkey" PRIMARY KEY ("profileId","inputKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "Element_slug_key" ON "Element"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressionPhase_slug_key" ON "ProgressionPhase"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressionPhase_sortOrder_key" ON "ProgressionPhase"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Pathway_slug_key" ON "Pathway"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_elementId_key" ON "Sequence"("elementId");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_pathwayId_number_key" ON "Sequence"("pathwayId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Advance_inputKey_key" ON "Advance"("inputKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceIngredient_advanceId_elementId_key" ON "AdvanceIngredient"("advanceId", "elementId");

-- CreateIndex
CREATE UNIQUE INDEX "Ritual_inputKey_key" ON "Ritual"("inputKey");

-- CreateIndex
CREATE UNIQUE INDEX "RitualIngredient_ritualId_elementId_key" ON "RitualIngredient"("ritualId", "elementId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_inputKey_key" ON "Recipe"("inputKey");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeOutput_recipeId_elementId_key" ON "RecipeOutput"("recipeId", "elementId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredient_recipeId_elementId_key" ON "RecipeIngredient"("recipeId", "elementId");

-- CreateIndex
CREATE INDEX "PlayerCombinationStat_inputKey_idx" ON "PlayerCombinationStat"("inputKey");

-- AddForeignKey
ALTER TABLE "Element" ADD CONSTRAINT "Element_availableFromPhaseId_fkey" FOREIGN KEY ("availableFromPhaseId") REFERENCES "ProgressionPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementUnlockTrigger" ADD CONSTRAINT "ElementUnlockTrigger_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementUnlockTrigger" ADD CONSTRAINT "ElementUnlockTrigger_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementUnlockRequirement" ADD CONSTRAINT "ElementUnlockRequirement_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementUnlockRequirement" ADD CONSTRAINT "ElementUnlockRequirement_requiredElementId_fkey" FOREIGN KEY ("requiredElementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementCategory" ADD CONSTRAINT "ElementCategory_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementCategory" ADD CONSTRAINT "ElementCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pathway" ADD CONSTRAINT "Pathway_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_sourceSequenceId_fkey" FOREIGN KEY ("sourceSequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_targetSequenceId_fkey" FOREIGN KEY ("targetSequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceIngredient" ADD CONSTRAINT "AdvanceIngredient_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceIngredient" ADD CONSTRAINT "AdvanceIngredient_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ritual" ADD CONSTRAINT "Ritual_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RitualIngredient" ADD CONSTRAINT "RitualIngredient_ritualId_fkey" FOREIGN KEY ("ritualId") REFERENCES "Ritual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RitualIngredient" ADD CONSTRAINT "RitualIngredient_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RitualFailureOutput" ADD CONSTRAINT "RitualFailureOutput_ritualId_fkey" FOREIGN KEY ("ritualId") REFERENCES "Ritual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RitualFailureOutput" ADD CONSTRAINT "RitualFailureOutput_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_triggerElementId_fkey" FOREIGN KEY ("triggerElementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_triggerSequenceId_fkey" FOREIGN KEY ("triggerSequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeOutput" ADD CONSTRAINT "RecipeOutput_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeOutput" ADD CONSTRAINT "RecipeOutput_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAdvance" ADD CONSTRAINT "PlayerAdvance_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAdvance" ADD CONSTRAINT "PlayerAdvance_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAchievement" ADD CONSTRAINT "PlayerAchievement_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAchievement" ADD CONSTRAINT "PlayerAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRitual" ADD CONSTRAINT "PlayerRitual_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRitual" ADD CONSTRAINT "PlayerRitual_ritualId_fkey" FOREIGN KEY ("ritualId") REFERENCES "Ritual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDiscovery" ADD CONSTRAINT "PlayerDiscovery_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDiscovery" ADD CONSTRAINT "PlayerDiscovery_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerPathwayUnlock" ADD CONSTRAINT "PlayerPathwayUnlock_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerPathwayUnlock" ADD CONSTRAINT "PlayerPathwayUnlock_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCombinationStat" ADD CONSTRAINT "PlayerCombinationStat_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCombinationStat" ADD CONSTRAINT "PlayerCombinationStat_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCombinationStat" ADD CONSTRAINT "PlayerCombinationStat_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
