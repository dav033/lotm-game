-- CreateTable: RecipeOutput
CREATE TABLE "RecipeOutput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "chance" REAL NOT NULL DEFAULT 1.0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RecipeOutput_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeOutput_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeOutput_recipeId_elementId_key" ON "RecipeOutput"("recipeId", "elementId");

-- Migrate existing data from outputElementId/outputQuantity to RecipeOutput
INSERT INTO "RecipeOutput" ("id", "recipeId", "elementId", "quantity", "chance", "sortOrder")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    "id",
    "outputElementId",
    COALESCE("outputQuantity", 1),
    1.0,
    0
FROM "Recipe"
WHERE "outputElementId" IS NOT NULL;

-- Drop old columns from Recipe table
PRAGMA foreign_keys=off;

-- SQLite doesn't support DROP COLUMN directly in older versions, so we recreate the table
CREATE TABLE "Recipe_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "inputKey" TEXT NOT NULL,
    "successText" TEXT,
    "hintText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "Recipe_new" ("id", "name", "inputKey", "successText", "hintText", "isActive", "createdAt", "updatedAt")
SELECT "id", "name", "inputKey", "successText", "hintText", "isActive", "createdAt", "updatedAt" FROM "Recipe";

DROP TABLE "Recipe";
ALTER TABLE "Recipe_new" RENAME TO "Recipe";

-- Recreate RecipeIngredient with CASCADE DELETE on elementId
DROP INDEX IF EXISTS "RecipeIngredient_recipeId_elementId_key";

CREATE TABLE "RecipeIngredient_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeIngredient_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "RecipeIngredient_new" ("id", "recipeId", "elementId", "quantity")
SELECT "id", "recipeId", "elementId", "quantity" FROM "RecipeIngredient";

DROP TABLE "RecipeIngredient";
ALTER TABLE "RecipeIngredient_new" RENAME TO "RecipeIngredient";
CREATE UNIQUE INDEX "RecipeIngredient_recipeId_elementId_key" ON "RecipeIngredient"("recipeId", "elementId");

PRAGMA foreign_keys=on;
