-- Фото, завантажені під час створення нової статті, не були прив'язані до неї,
-- тому їх бачив лише той, хто завантажив. Прив'язуємо їх до статей, у вмісті яких вони згадуються.
UPDATE "KnowledgeFile" f
SET "itemId" = i."id"
FROM "KnowledgeItem" i
WHERE f."itemId" IS NULL
  AND i."content" IS NOT NULL
  AND position(f."id" in i."content"::text) > 0;
