ALTER TABLE "Employee"
ADD COLUMN "circle" TEXT;

CREATE INDEX "Employee_circle_idx" ON "Employee"("circle");
