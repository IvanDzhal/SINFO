-- Право редагувати й видаляти результати тестів; роль «Адмін» отримує його одразу
INSERT INTO "Permission" ("id", "code")
VALUES (gen_random_uuid()::text, 'testing.edit_results')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "scope")
SELECT gen_random_uuid()::text, r."id", p."id", 'GLOBAL'
FROM "Role" r, "Permission" p
WHERE r."name" = 'Адмін' AND p."code" = 'testing.edit_results'
ON CONFLICT ("roleId", "permissionId", "scope") DO NOTHING;
