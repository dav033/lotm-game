-- CreateTable
CREATE TABLE "ElementUnlockTrigger" (
    "elementId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,

    PRIMARY KEY ("elementId", "triggerId"),
    CONSTRAINT "ElementUnlockTrigger_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElementUnlockTrigger_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "Element" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
