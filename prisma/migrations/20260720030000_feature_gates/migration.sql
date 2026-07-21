CREATE TABLE "FeatureGate" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "minimumPhaseSortOrder" INTEGER NOT NULL
);

INSERT INTO "FeatureGate" ("key", "minimumPhaseSortOrder")
VALUES ('ADVANCEMENT_RITUALS', 6);
