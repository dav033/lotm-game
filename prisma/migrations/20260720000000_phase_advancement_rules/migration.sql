-- Reglas editables de avance. El umbral anterior se migra a una hoja de
-- conteo; cero representa la fase inicial abierta siempre.
ALTER TABLE "ProgressionPhase"
ADD COLUMN "advancementRuleJson" TEXT NOT NULL DEFAULT '{"type":"ALWAYS"}';

UPDATE "ProgressionPhase"
SET "advancementRuleJson" = CASE
  WHEN "unlockAtDiscoveryCount" <= 0 THEN '{"type":"ALWAYS"}'
  ELSE '{"type":"DISCOVERY_COUNT","minimum":' || "unlockAtDiscoveryCount" || '}'
END;
