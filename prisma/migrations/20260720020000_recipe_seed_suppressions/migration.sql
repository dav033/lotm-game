-- Docker ejecuta el seed en cada arranque. Esta tabla conserva la decisión
-- explícita de retirar una receta para que el seed no vuelva a crearla.
CREATE TABLE "RecipeSeedSuppression" (
  "inputKey" TEXT NOT NULL PRIMARY KEY,
  "suppressedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
