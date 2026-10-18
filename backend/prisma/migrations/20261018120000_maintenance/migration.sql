CREATE TABLE "MaintenanceWindow" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceWindow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceWindow_endsAt_idx" ON "MaintenanceWindow"("endsAt");

-- Право керувати технічними роботами: видаємо ролям, що мають admin.access
INSERT INTO "Permission" ("id", "code")
VALUES (gen_random_uuid()::text, 'admin.maintenance.manage')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "scope")
SELECT gen_random_uuid()::text, rp."roleId", np."id", rp."scope"
FROM "RolePermission" rp
JOIN "Permission" ap ON ap."id" = rp."permissionId" AND ap."code" = 'admin.access'
JOIN "Permission" np ON np."code" = 'admin.maintenance.manage'
ON CONFLICT ("roleId", "permissionId", "scope") DO NOTHING;
