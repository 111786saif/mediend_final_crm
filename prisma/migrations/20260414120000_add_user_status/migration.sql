-- User availability statuses (Google-Calendar-like presence markers)
CREATE TYPE "UserStatusKind" AS ENUM ('AVAILABLE', 'ONLINE_ONLY', 'UNAVAILABLE', 'CUSTOM');

CREATE TABLE "UserStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "UserStatusKind" NOT NULL,
    "label" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStatus_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserStatus_userId_startsAt_endsAt_idx" ON "UserStatus"("userId", "startsAt", "endsAt");
CREATE INDEX "UserStatus_startsAt_idx" ON "UserStatus"("startsAt");

ALTER TABLE "UserStatus" ADD CONSTRAINT "UserStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
