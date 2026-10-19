-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "TrainingLesson" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Test_slug_key" ON "Test"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingLesson_slug_key" ON "TrainingLesson"("slug");
