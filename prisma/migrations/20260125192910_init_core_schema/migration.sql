-- CreateEnum
CREATE TYPE "ChannelVisibility" AS ENUM ('ORG', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ThreadState" AS ENUM ('OPEN', 'BLOCKED', 'DECIDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('NORMAL', 'URGENT');

-- CreateTable
CREATE TABLE "Channel" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "visibility" "ChannelVisibility" NOT NULL DEFAULT 'ORG',
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Thread" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "state" "ThreadState" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "createdByUserId" UUID,
    "createdByMembershipId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "authorUserId" UUID,
    "authorMembershipId" UUID,
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "requiresResponse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageVersion" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editorUserId" UUID,

    CONSTRAINT "MessageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "actorUserId" UUID,
    "actorMembershipId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Channel_orgId_createdAt_idx" ON "Channel"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_orgId_slug_key" ON "Channel"("orgId", "slug");

-- CreateIndex
CREATE INDEX "Thread_orgId_createdAt_idx" ON "Thread"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Thread_channelId_createdAt_idx" ON "Thread"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_orgId_createdAt_idx" ON "Message"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageVersion_messageId_createdAt_idx" ON "MessageVersion"("messageId", "createdAt");

-- CreateIndex
CREATE INDEX "Reaction_messageId_createdAt_idx" ON "Reaction"("messageId", "createdAt");

-- CreateIndex
CREATE INDEX "Reaction_orgId_createdAt_idx" ON "Reaction"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageVersion" ADD CONSTRAINT "MessageVersion_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
