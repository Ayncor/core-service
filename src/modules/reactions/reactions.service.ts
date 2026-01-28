import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../shared/storage/prisma.service";
import type { OutboxTransaction } from "../outbox/outbox.service";
import { OutboxService } from "../outbox/outbox.service";
import type { EventEnvelope } from "../../shared/events/event-envelope";
import { EVENT_TYPES } from "../../shared/events/event-envelope";

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService
  ) {}

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

      const occurredAt = new Date();
      const envelope: EventEnvelope = {
        event_id: randomUUID(),
        event_type: EVENT_TYPES.CoreReactionAdded,
        schema_version: 1,
        occurred_at: occurredAt.toISOString(),
        org_id: input.orgId,
        actor_user_id: input.actorUserId,
        trace_id: null,
        ordering_key: input.messageId,
        entity_ref: { type: "reaction", id: created.id },
        payload: {
          reaction_id: created.id,
          message_id: input.messageId,
          user_id: input.actorUserId,
          emoji: input.emoji
        }
      };
      await this.outbox.appendInTransaction(tx as unknown as OutboxTransaction, envelope);

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

