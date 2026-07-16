-- Un avance puede aceptar varias fórmulas rituales alternativas.
DROP INDEX "Ritual_advanceId_key";
CREATE INDEX "Ritual_advanceId_idx" ON "Ritual"("advanceId");
