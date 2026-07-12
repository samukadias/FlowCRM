-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('STAGE_CHANGE', 'EMAIL', 'NOTE', 'ATTACHMENT');

-- AlterTable
ALTER TABLE "WorkflowEvent" ADD COLUMN     "content" TEXT,
ADD COLUMN     "eventType" "EventType" NOT NULL DEFAULT 'STAGE_CHANGE',
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "subject" TEXT,
ALTER COLUMN "paraStage" DROP NOT NULL;
