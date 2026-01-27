-- CreateEnum
CREATE TYPE "ThreadParticipantRole" AS ENUM ('OWNER', 'PARTICIPANT', 'OBSERVER');

-- CreateEnum
CREATE TYPE "ThreadUserStatus" AS ENUM ('IN_INBOX', 'ARCHIVED', 'SNOOZED');

-- CreateEnum
CREATE TYPE "PriorityOverride" AS ENUM ('NONE', 'LOW', 'HIGH');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageFormat" AS ENUM ('PLAIN', 'MARKDOWN');

-- AlterTable: Add lastActivityAt to Thread (with default from createdAt)
ALTER TABLE "Thread" ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Thread" SET "lastActivityAt" = "createdAt" WHERE "lastActivityAt" IS NULL;

-- AlterTable: Add new columns to Message
ALTER TABLE "Message" ADD COLUMN "kind" "MessageKind" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "Message" ADD COLUMN "replyToMessageId" UUID;
ALTER TABLE "Message" ADD COLUMN "metadataJson" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Message" ADD COLUMN "deletedBy" UUID;

-- AlterTable: Add version and format to MessageVersion
-- First add as nullable, populate data, then make required
ALTER TABLE "MessageVersion" ADD COLUMN "version" INTEGER;
ALTER TABLE "MessageVersion" ADD COLUMN "format" "MessageFormat" NOT NULL DEFAULT 'MARKDOWN';

-- Populate version numbers for existing MessageVersion rows
-- Assign sequential version numbers (1, 2, 3...) per messageId, ordered by createdAt
DO $$
DECLARE
    msg_record RECORD;
    version_rec RECORD;
    version_num INTEGER;
BEGIN
    FOR msg_record IN SELECT DISTINCT "messageId" FROM "MessageVersion" LOOP
        version_num := 1;
        FOR version_rec IN 
            SELECT "id" FROM "MessageVersion" 
            WHERE "messageId" = msg_record."messageId" 
            ORDER BY "createdAt" ASC, "id" ASC
        LOOP
            UPDATE "MessageVersion" SET "version" = version_num WHERE "id" = version_rec."id";
            version_num := version_num + 1;
        END LOOP;
    END LOOP;
END $$;

-- Now make version required
ALTER TABLE "MessageVersion" ALTER COLUMN "version" SET NOT NULL;

-- CreateTable: ThreadParticipant
CREATE TABLE "ThreadParticipant" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ThreadParticipantRole" NOT NULL DEFAULT 'PARTICIPANT',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),

    CONSTRAINT "ThreadParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ThreadUserState
CREATE TABLE "ThreadUserState" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "ThreadUserStatus" NOT NULL DEFAULT 'IN_INBOX',
    "needsResponse" BOOLEAN NOT NULL DEFAULT false,
    "snoozedUntil" TIMESTAMP(3),
    "lastReadMessageId" UUID,
    "lastReviewedAt" TIMESTAMP(3),
    "priorityOverride" "PriorityOverride" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreadUserState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Thread_orgId_lastActivityAt_idx" ON "Thread"("orgId", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadParticipant_orgId_threadId_userId_key" ON "ThreadParticipant"("orgId", "threadId", "userId");

-- CreateIndex
CREATE INDEX "ThreadParticipant_orgId_threadId_idx" ON "ThreadParticipant"("orgId", "threadId");

-- CreateIndex
CREATE INDEX "ThreadParticipant_userId_joinedAt_idx" ON "ThreadParticipant"("userId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadUserState_orgId_threadId_userId_key" ON "ThreadUserState"("orgId", "threadId", "userId");

-- CreateIndex
CREATE INDEX "ThreadUserState_orgId_userId_status_idx" ON "ThreadUserState"("orgId", "userId", "status");

-- CreateIndex
CREATE INDEX "ThreadUserState_orgId_userId_needsResponse_idx" ON "ThreadUserState"("orgId", "userId", "needsResponse");

-- CreateIndex
CREATE INDEX "ThreadUserState_threadId_idx" ON "ThreadUserState"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageVersion_orgId_messageId_version_key" ON "MessageVersion"("orgId", "messageId", "version");

-- AddForeignKey
ALTER TABLE "ThreadParticipant" ADD CONSTRAINT "ThreadParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadUserState" ADD CONSTRAINT "ThreadUserState_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
