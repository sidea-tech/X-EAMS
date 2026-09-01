-- CreateTable
CREATE TABLE "EmployeeSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workStart" TEXT,
    "workEnd" TEXT,
    "graceMinutes" INTEGER,
    "fullDayMinutes" INTEGER,
    "halfDayMinutes" INTEGER,
    "workingDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "timezone" TEXT,
    "note" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSchedule_userId_key" ON "EmployeeSchedule"("userId");

-- CreateIndex
CREATE INDEX "EmployeeSchedule_userId_idx" ON "EmployeeSchedule"("userId");

-- AddForeignKey
ALTER TABLE "EmployeeSchedule" ADD CONSTRAINT "EmployeeSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSchedule" ADD CONSTRAINT "EmployeeSchedule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

