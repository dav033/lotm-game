-- CreateTable
CREATE TABLE "ContentInstallation" (
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentInstallation_pkey" PRIMARY KEY ("key")
);
