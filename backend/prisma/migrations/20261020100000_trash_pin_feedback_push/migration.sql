-- AlterEnum
ALTER TYPE "KnowledgeStatus" ADD VALUE 'trashed';
ALTER TYPE "TestStatus" ADD VALUE 'trashed';

-- AlterTable
ALTER TABLE "KnowledgeCategory" ADD COLUMN     "trashedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "KnowledgeItem" ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "trashedAt" TIMESTAMP(3),
ADD COLUMN     "trashedFrom" "KnowledgeStatus";

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "trashedAt" TIMESTAMP(3),
ADD COLUMN     "trashedFrom" "TestStatus";

-- CreateTable
CREATE TABLE "KnowledgeFeedback" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "KnowledgeFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeFeedback_status_createdAt_idx" ON "KnowledgeFeedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeFeedback_itemId_idx" ON "KnowledgeFeedback"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "KnowledgeFeedback" ADD CONSTRAINT "KnowledgeFeedback_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeFeedback" ADD CONSTRAINT "KnowledgeFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
