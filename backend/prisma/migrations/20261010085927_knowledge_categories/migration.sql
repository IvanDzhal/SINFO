-- CreateTable
CREATE TABLE "KnowledgeCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeCategory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "KnowledgeCategory" ADD CONSTRAINT "KnowledgeCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KnowledgeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
