-- CreateEnum
CREATE TYPE "KnowledgeType" AS ENUM ('instruction', 'material', 'news');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "VisibilityKind" AS ENUM ('GLOBAL', 'REGION', 'STORE', 'ROLE');

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL,
    "type" "KnowledgeType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "content" JSONB,
    "contentText" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT,
    "authorId" TEXT NOT NULL,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "readingTimeMinutes" INTEGER NOT NULL DEFAULT 1,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeVisibility" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "kind" "VisibilityKind" NOT NULL,
    "targetId" TEXT,

    CONSTRAINT "KnowledgeVisibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storeId" TEXT,
    "regionId" TEXT,

    CONSTRAINT "KnowledgeRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeItem_type_status_idx" ON "KnowledgeItem"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeRead_userId_itemId_key" ON "KnowledgeRead"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KnowledgeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeVisibility" ADD CONSTRAINT "KnowledgeVisibility_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRead" ADD CONSTRAINT "KnowledgeRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRead" ADD CONSTRAINT "KnowledgeRead_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
