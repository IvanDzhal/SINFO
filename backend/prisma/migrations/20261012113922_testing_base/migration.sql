/*
  Warnings:

  - You are about to drop the column `employmentStartDate` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('single', 'multiple', 'matching', 'input');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "employmentStartDate";

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT,
    "linkedItemId" TEXT,
    "status" "TestStatus" NOT NULL DEFAULT 'draft',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "deadline" TIMESTAMP(3),
    "questionCount" INTEGER NOT NULL DEFAULT 20,
    "timeLimitMinutes" INTEGER NOT NULL DEFAULT 25,
    "passingScorePercent" INTEGER NOT NULL DEFAULT 80,
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestVisibility" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "kind" "VisibilityKind" NOT NULL,
    "targetId" TEXT,

    CONSTRAINT "TestVisibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestQuestion" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "explanation" TEXT NOT NULL DEFAULT '',
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "points" INTEGER NOT NULL DEFAULT 2,
    "position" INTEGER NOT NULL DEFAULT 0,
    "accepted" JSONB,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "TestQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "matchLabel" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Test_status_idx" ON "Test"("status");

-- CreateIndex
CREATE INDEX "TestQuestion_testId_idx" ON "TestQuestion"("testId");

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KnowledgeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_linkedItemId_fkey" FOREIGN KEY ("linkedItemId") REFERENCES "KnowledgeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestVisibility" ADD CONSTRAINT "TestVisibility_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestQuestion" ADD CONSTRAINT "TestQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestOption" ADD CONSTRAINT "TestOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "TestQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
