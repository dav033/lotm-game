-- Requisitos AND para desbloqueos espontáneos.
-- Un elemento solo se desbloquea cuando el jugador ha descubierto TODOS los
-- elementos requeridos de esta tabla.
CREATE TABLE "ElementUnlockRequirement" (
    "elementId" TEXT NOT NULL,
    "requiredElementId" TEXT NOT NULL,

    PRIMARY KEY ("elementId", "requiredElementId"),
    CONSTRAINT "ElementUnlockRequirement_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElementUnlockRequirement_requiredElementId_fkey" FOREIGN KEY ("requiredElementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ElementUnlockRequirement_requiredElementId_idx" ON "ElementUnlockRequirement"("requiredElementId");
