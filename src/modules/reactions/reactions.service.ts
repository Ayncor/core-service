import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../shared/storage/prisma.service";

@Injectable()
export class ReactionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getMessageOrThrow(orgId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException("Message not found");
    if (msg.orgId !== orgId) throw new ForbiddenException("Forbidden");
    if (msg.deletedAt) throw new ForbiddenException("Message deleted");
    return msg;
  }

  async toggleReaction(input: {
    orgId: string;
    messageId: string;
    emoji: string;
    actorUserId: string;
    actorMembershipId: string;
  }) {
    await this.getMessageOrThrow(input.orgId, input.messageId);

    const existingActive = await this.prisma.reaction.findFirst({
      where: {
        orgId: input.orgId,
        messageId: input.messageId,
        emoji: input.emoji,
        actorUserId: input.actorUserId,
        removedAt: null
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });

    const msg = await this.getMessageOrThrow(input.orgId, input.messageId);

    if (existingActive) {
      const updated = await this.prisma.reaction.update({
        where: { id: existingActive.id },
        data: { removedAt: new Date() }
      });
      return { action: "removed" as const, reaction: updated };
    }

    return await this.prisma.$transaction(async (tx) => {
      const created = await tx.reaction.create({
        data: {
          orgId: input.orgId,
          messageId: input.messageId,
          emoji: input.emoji,
          actorUserId: input.actorUserId,
          actorMembershipId: input.actorMembershipId
        }
      });

      // Update thread lastActivityAt
      await tx.thread.update({
        where: { id: msg.threadId },
        data: { lastActivityAt: new Date() }
      });

      return { action: "added" as const, reaction: created };
    });
  }

  async listForMessage(input: { orgId: string; messageId: string; actorUserId: string }) {
    await this.getMessageOrThrow(input.orgId, input.messageId);

    const reactions = await this.prisma.reaction.findMany({
      where: {
        orgId: input.orgId,
        messageId: input.messageId,
        removedAt: null
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });

    const counts = new Map<string, { emoji: string; count: number; me: boolean }>();
    for (const r of reactions) {
      const curr = counts.get(r.emoji) ?? { emoji: r.emoji, count: 0, me: false };
      curr.count += 1;
      if (r.actorUserId === input.actorUserId) curr.me = true;
      counts.set(r.emoji, curr);
    }

    return Array.from(counts.values()).sort((a, b) => (a.emoji < b.emoji ? -1 : a.emoji > b.emoji ? 1 : 0));
  }
}

