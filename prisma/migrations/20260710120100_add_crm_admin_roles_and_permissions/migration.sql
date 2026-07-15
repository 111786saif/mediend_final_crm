ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CRM_ADMIN';

CREATE TABLE "UserCrmPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "grantedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCrmPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCrmPermission_userId_permissionKey_key" ON "UserCrmPermission"("userId", "permissionKey");
CREATE INDEX "UserCrmPermission_userId_idx" ON "UserCrmPermission"("userId");
CREATE INDEX "UserCrmPermission_permissionKey_idx" ON "UserCrmPermission"("permissionKey");

ALTER TABLE "UserCrmPermission"
ADD CONSTRAINT "UserCrmPermission_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserCrmPermission"
ADD CONSTRAINT "UserCrmPermission_grantedById_fkey"
FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
