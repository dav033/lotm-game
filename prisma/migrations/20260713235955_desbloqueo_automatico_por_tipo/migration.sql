-- AlterTable
ALTER TABLE "Element" ADD COLUMN "unlockedByType" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "inputKey" TEXT NOT NULL,
    "successText" TEXT,
    "hintText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Recipe" ("createdAt", "hintText", "id", "inputKey", "isActive", "name", "successText", "updatedAt") SELECT "createdAt", "hintText", "id", "inputKey", "isActive", "name", "successText", "updatedAt" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE UNIQUE INDEX "Recipe_inputKey_key" ON "Recipe"("inputKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
