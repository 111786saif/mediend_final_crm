-- MD (and flows) finalizing employee normalization — match Prisma NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NORMALIZATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NORMALIZATION_REJECTED';
