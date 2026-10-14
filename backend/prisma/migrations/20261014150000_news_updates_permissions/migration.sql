-- Нові права: окремий перегляд новин і блоку «Останні оновлення».
-- Щоб нічого не зникло, видаємо їх усім ролям, які вже мають knowledge.view (з тим самим scope).
INSERT INTO "Permission" ("id", "code")
SELECT gen_random_uuid()::text, c.code
FROM (VALUES ('knowledge.view_news'), ('knowledge.view_updates')) AS c(code)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "scope")
SELECT gen_random_uuid()::text, rp."roleId", np."id", rp."scope"
FROM "RolePermission" rp
JOIN "Permission" vp ON vp."id" = rp."permissionId" AND vp."code" = 'knowledge.view'
JOIN "Permission" np ON np."code" IN ('knowledge.view_news', 'knowledge.view_updates')
ON CONFLICT ("roleId", "permissionId", "scope") DO NOTHING;
