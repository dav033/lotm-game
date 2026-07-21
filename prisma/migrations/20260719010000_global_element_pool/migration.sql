-- Null pasa a significar pool global. Las asignaciones de fase se reservan
-- para concesiones automáticas al abrir cada etapa.
INSERT OR IGNORE INTO "ProgressionPhase" (
  "id", "slug", "name", "description", "sortOrder",
  "unlockAtDiscoveryCount", "isActive", "createdAt", "updatedAt"
) VALUES (
  'phase-3', 'fase-3', 'Fase 3', 'Frontera futura que comienza con Edad.', 3,
  90, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

UPDATE "Element"
SET "availableFromPhaseId" = NULL
WHERE "isStarter" = 0;

UPDATE "Element"
SET "availableFromPhaseId" = (
  SELECT "id"
  FROM "ProgressionPhase"
  WHERE "isActive" = 1
  ORDER BY "sortOrder"
  LIMIT 1
)
WHERE "isStarter" = 1;

-- Misticismo, Beyonder y Agua son las aperturas explícitas de Fase 2.
UPDATE "Element"
SET "availableFromPhaseId" = (
  SELECT "id" FROM "ProgressionPhase" WHERE "slug" = 'fase-2'
)
WHERE "slug" IN ('misticismo', 'beyonder', 'agua')
  AND EXISTS (SELECT 1 FROM "ProgressionPhase" WHERE "slug" = 'fase-2');

UPDATE "Element"
SET "unlockedAtDiscoveryCount" = NULL
WHERE "slug" IN ('misticismo', 'beyonder', 'agua');

UPDATE "Element"
SET "availableFromPhaseId" = (
  SELECT "id" FROM "ProgressionPhase" WHERE "slug" = 'fase-3'
)
WHERE "slug" = 'edad'
  AND EXISTS (SELECT 1 FROM "ProgressionPhase" WHERE "slug" = 'fase-3');
