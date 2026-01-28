import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../shared/storage/prisma.service";
import type { OutboxTransaction } from "../outbox/outbox.service";
import { OutboxService } from "../outbox/outbox.service";
import type { EventEnvelope } from "../../shared/events/event-envelope";
import { EVENT_TYPES } from "../../shared/events/event-envelope";

@Injectable()
export class ThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService
  ) {}

  async createThread(input: {
    orgId: string;
    channelId: string;
    title: string;
    purpose?: string | null;
    createdByUserId?: string | null;
    createdByMembershipId?: string | null;
  }) {
    const channel = await this.prisma.channel.findUnique({ where: { id: input.channelId } });
    if (!channel) throw new NotFoundException("Channel not found");
    if (channel.orgId !== input.orgId) throw new ForbiddenException("Forbidden");
    if (channel.archivedAt) throw new ForbiddenException("Channel is archived");

    return await this.prisma.$transaction(async (tx) => {
      const thread = await tx.thread.create({
        data: {
          orgId: input.orgId,
          channelId: input.channelId,
          title: input.title,
          purpose: input.purpose ?? null,
          createdByUserId: input.createdByUserId ?? null,
          createdByMembershipId: input.createdByMembershipId ?? null
        }
      });

      // Auto-create participant (creator is OWNER)
      if (input.createdByUserId) {
        await tx.threadParticipant.create({
          data: {
            orgId: input.orgId,
            threadId: thread.id,
            userId: input.createdByUserId,
            role: "OWNER"
          }
        });

        // Auto-create user state (IN_INBOX)
        await tx.threadUserState.create({
          data: {
            orgId: input.orgId,
            threadId: thread.id,
            userId: input.createdByUserId
          }
        });
      }

      const occurredAt = new Date();
      const envelope: EventEnvelope = {
        event_id: randomUUID(),
        event_type: EVENT_TYPES.CoreThreadCreated,
        schema_version: 1,
        occurred_at: occurredAt.toISOString(),
        org_id: input.orgId,
        actor_user_id: input.createdByUserId ?? null,
        trace_id: null,
        ordering_key: thread.id,
        entity_ref: { type: "thread", id: thread.id },
        payload: {
          thread_id: thread.id,
          channel_id: input.channelId,
          title: input.title,
          purpose: input.purpose ?? null,
          state: thread.state,
          created_by: input.createdByUserId ?? "",
          participant_user_ids: input.createdByUserId ? [input.createdByUserId] : []
        }
      };
      await this.outbox.appendInTransaction(tx as unknown as OutboxTransaction, envelope);

      return thread;
    });
  }

  async listThreads(orgId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException("Channel not found");
    if (channel.orgId !== orgId) throw new ForbiddenException("Forbidden");

    return await this.prisma.thread.findMany({
      where: { orgId, channelId, archivedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
  }

  async setThreadState(input: { orgId: string; threadId: string; nextState: "OPEN" | "BLOCKED" | "DECIDED" | "ARCHIVED" }) {
    const thread = await this.prisma.thread.findUnique({ where: { id: input.threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.orgId !== input.orgId) throw new ForbiddenException("Forbidden");

    if (thread.state === "ARCHIVED" || thread.archivedAt) {
      throw new ConflictException("Thread is archived");
    }

    const next = input.nextState;
    if (!["OPEN", "BLOCKED", "DECIDED", "ARCHIVED"].includes(next)) {
      throw new ConflictException("Invalid thread state");
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.thread.update({
        where: { id: input.threadId },
        data: {
          state: next as any,
          archivedAt: next === "ARCHIVED" ? new Date() : null
        }
      });

      const occurredAt = new Date();
      const envelope: EventEnvelope = {
        event_id: randomUUID(),
        event_type: EVENT_TYPES.CoreThreadStateChanged,
        schema_version: 1,
        occurred_at: occurredAt.toISOString(),
        org_id: input.orgId,
        actor_user_id: null,
        trace_id: null,
        ordering_key: input.threadId,
        entity_ref: { type: "thread", id: input.threadId },
        payload: {
          thread_id: input.threadId,
          from_state: thread.state,
          to_state: next,
          reason: "user_request"
        }
      };
      await this.outbox.appendInTransaction(tx as unknown as OutboxTransaction, envelope);

      return updated;
    });
  }
}

