import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../shared/storage/prisma.service";

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async createMessage(input: {
    orgId: string;
    threadId: string;
    body: string;
    urgency?: "NORMAL" | "URGENT";
    requiresResponse?: boolean;
    authorUserId?: string | null;
    authorMembershipId?: string | null;
  }) {
    const thread = await this.prisma.thread.findUnique({ where: { id: input.threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.orgId !== input.orgId) throw new ForbiddenException("Forbidden");
    if (thread.archivedAt || thread.state === "ARCHIVED") throw new ForbiddenException("Thread is archived");

    return await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          orgId: input.orgId,
          threadId: input.threadId,
          authorUserId: input.authorUserId ?? null,
          authorMembershipId: input.authorMembershipId ?? null,
          urgency: (input.urgency ?? "NORMAL") as any,
          requiresResponse: input.requiresResponse ?? false
        }
      });

      const v = await tx.messageVersion.create({
        data: {
          orgId: input.orgId,
          messageId: msg.id,
          body: input.body,
          editorUserId: input.authorUserId ?? null
        }
      });

      return { msg, v };
    });
  }

  async listMessages(orgId: string, threadId: string) {
    const thread = await this.prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.orgId !== orgId) throw new ForbiddenException("Forbidden");

    const msgs = await this.prisma.message.findMany({
      where: { orgId, threadId, deletedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });

    const versions = await this.prisma.messageVersion.findMany({
      where: { orgId, messageId: { in: msgs.map((m) => m.id) } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });

    const latestByMessageId = new Map<string, (typeof versions)[number]>();
    for (const v of versions) {
      if (!latestByMessageId.has(v.messageId)) latestByMessageId.set(v.messageId, v);
    }

    return msgs.map((m) => ({
      message: m,
      latest: latestByMessageId.get(m.id) ?? null
    }));
  }
}

