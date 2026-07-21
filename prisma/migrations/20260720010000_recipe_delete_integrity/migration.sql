-- Retira únicamente recetas estructuralmente inválidas heredadas. Las recetas
-- personalizadas válidas se conservan aunque no formen parte del seed.
DELETE FROM "Recipe"
WHERE
  (SELECT COALESCE(SUM("quantity"), 0)
   FROM "RecipeIngredient"
   WHERE "recipeId" = "Recipe"."id") <> 2
  OR NOT EXISTS (
    SELECT 1 FROM "RecipeOutput" WHERE "recipeId" = "Recipe"."id"
  );

-- Un elemento ya no puede eliminar solo una arista y dejar una Recipe padre
-- corrupta. Las acciones eliminan primero las recetas completas afectadas.
PRAGMA foreign_keys=OFF;

CREATE TABLE "RecipeIngredient_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "recipeId" TEXT NOT NULL,
  "elementId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "RecipeIngredient_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecipeIngredient_elementId_fkey"
    FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "RecipeIngredient_new" ("id", "recipeId", "elementId", "quantity")
SELECT "id", "recipeId", "elementId", "quantity" FROM "RecipeIngredient";

DROP TABLE "RecipeIngredient";
ALTER TABLE "RecipeIngredient_new" RENAME TO "RecipeIngredient";
CREATE UNIQUE INDEX "RecipeIngredient_recipeId_elementId_key"
ON "RecipeIngredient"("recipeId", "elementId");

CREATE TABLE "RecipeOutput_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "recipeId" TEXT NOT NULL,
  "elementId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "chance" REAL NOT NULL DEFAULT 1.0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RecipeOutput_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecipeOutput_elementId_fkey"
    FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "RecipeOutput_new"
  ("id", "recipeId", "elementId", "quantity", "chance", "sortOrder")
SELECT "id", "recipeId", "elementId", "quantity", "chance", "sortOrder"
FROM "RecipeOutput";

DROP TABLE "RecipeOutput";
ALTER TABLE "RecipeOutput_new" RENAME TO "RecipeOutput";
CREATE UNIQUE INDEX "RecipeOutput_recipeId_elementId_key"
ON "RecipeOutput"("recipeId", "elementId");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
