ALTER TABLE "ProgressionPhase"
ADD COLUMN "celebrationMessage" TEXT NOT NULL DEFAULT '';

UPDATE "ProgressionPhase"
SET "celebrationMessage" = CASE "sortOrder"
  WHEN 2 THEN 'Vas entendiendo cómo va esto.'
  WHEN 3 THEN 'El tiempo pone todas las cosas en su lugar.'
  WHEN 4 THEN 'Vamos a necesitar un poco más de espacio para todo esto.'
  WHEN 5 THEN 'Ya eres un maestro del misticismo.'
  WHEN 6 THEN 'Se desbloquearon los rituales de ascensión. La verdadera divinidad es solo cuestión de tiempo.'
  ELSE ''
END
WHERE "sortOrder" BETWEEN 2 AND 6;
