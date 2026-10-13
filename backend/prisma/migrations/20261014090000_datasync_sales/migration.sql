-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('pending', 'running', 'success', 'partial', 'failed');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "code" TEXT;

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google_sheets',
    "externalId" TEXT NOT NULL,
    "sheetName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataMapping" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "cells" TEXT[],

    CONSTRAINT "DataMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesMetricDef" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'base',
    "unit" TEXT NOT NULL DEFAULT 'currency',
    "numerator" TEXT,
    "denominator" TEXT,
    "thresholds" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalesMetricDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'auto',
    "status" "SyncStatus" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsSaved" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "details" JSONB,
    "triggeredById" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesSnapshot" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "daysPassed" INTEGER,
    "daysLeft" INTEGER,
    "raw" JSONB NOT NULL,
    "sourceId" TEXT,
    "syncId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesMetric" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "metricCode" TEXT NOT NULL,
    "plan" DOUBLE PRECISION,
    "fact" DOUBLE PRECISION,
    "dayFact" DOUBLE PRECISION,
    "sourceId" TEXT,
    "syncId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_storeId_key" ON "DataSource"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "DataMapping_sourceId_key_key" ON "DataMapping"("sourceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SalesMetricDef_code_key" ON "SalesMetricDef"("code");

-- CreateIndex
CREATE INDEX "SyncRun_sourceId_startedAt_idx" ON "SyncRun"("sourceId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesSnapshot_storeId_date_key" ON "SalesSnapshot"("storeId", "date");

-- CreateIndex
CREATE INDEX "SalesMetric_date_metricCode_idx" ON "SalesMetric"("date", "metricCode");

-- CreateIndex
CREATE UNIQUE INDEX "SalesMetric_storeId_date_metricCode_key" ON "SalesMetric"("storeId", "date", "metricCode");

-- CreateIndex
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");

-- AddForeignKey
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataMapping" ADD CONSTRAINT "DataMapping_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesSnapshot" ADD CONSTRAINT "SalesSnapshot_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesSnapshot" ADD CONSTRAINT "SalesSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesSnapshot" ADD CONSTRAINT "SalesSnapshot_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "SyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesMetric" ADD CONSTRAINT "SalesMetric_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesMetric" ADD CONSTRAINT "SalesMetric_metricCode_fkey" FOREIGN KEY ("metricCode") REFERENCES "SalesMetricDef"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesMetric" ADD CONSTRAINT "SalesMetric_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesMetric" ADD CONSTRAINT "SalesMetric_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "SyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

