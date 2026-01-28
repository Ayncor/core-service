import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../shared/storage/prisma.service";
import type { OutboxTransaction } from "../outbox/outbox.service";
import { OutboxService } from "../outbox/outbox.service";
import type { EventEnvelope } from "../../shared/events/event-envelope";
import { EVENT_TYPES } from "../../shared/events/event-envelope";

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService
  ) {}

  async createMessage(input: {
    orgId: string;
    threadId: string;
    body: string;
    kind?: "TEXT" | "SYSTEM";
    urgency?: "NORMAL" | "URGENT";
    requiresResponse?: boolean;
    replyToMessageId?: string | null;
    metadataJson?: Record<string, any> | null;
    format?: "PLAIN" | "MARKDOWN";
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
          kind: (input.kind ?? "TEXT") as any,
          urgency: (input.urgency ?? "NORMAL") as any,
          requiresResponse: input.requiresResponse ?? false,
          replyToMessageId: input.replyToMessageId ?? null,
          metadataJson: input.metadataJson ?? {}
        }
      });

      // Get the next version number
      const existingVersions = await tx.messageVersion.findMany({
        where: { orgId: input.orgId, messageId: msg.id },
        orderBy: { version: "desc" },
        take: 1
      });
      const nextVersion = existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;

      const v = await tx.messageVersion.create({
        data: {
          orgId: input.orgId,
          messageId: msg.id,
          version: nextVersion,
          body: input.body,
          format: (input.format ?? "MARKDOWN") as any,
          editorUserId: input.authorUserId ?? null
        }
      });

      // Update thread lastActivityAt
      await tx.thread.update({
        where: { id: input.threadId },
        data: { lastActivityAt: new Date() }
      });

      const occurredAt = new Date();
      const envelope: EventEnvelope = {
        event_id: randomUUID(),
        event_type: EVENT_TYPES.CoreMessageCreated,
        schema_version: 1,
        occurred_at: occurredAt.toISOString(),
        org_id: input.orgId,
        actor_user_id: input.authorUserId ?? null,
        trace_id: null,
        ordering_key: input.threadId,
        entity_ref: { type: "message", id: msg.id },
        payload: {
          message_id: msg.id,
          thread_id: input.threadId,
          author_id: input.authorUserId ?? msg.authorUserId ?? "",
          kind: msg.kind,
          urgency: msg.urgency,
          requires_response: msg.requiresResponse,
          reply_to_message_id: msg.replyToMessageId ?? null,
          metadata_json: msg.metadataJson ?? {},
          latest_version: {
            version: v.version,
            body: v.body,
            format: v.format,
            created_at: v.createdAt.toISOString(),
            created_by: v.editorUserId ?? input.authorUserId ?? ""
          }
        }
      };
      await this.outbox.appendInTransaction(tx as unknown as OutboxTransaction, envelope);

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

  async createVersion(input: {
    orgId: string;
    messageId: string;
    body: string;
    format?: "PLAIN" | "MARKDOWN";
    editorUserId: string;
    editorMembershipId: string;
  }) {
    const msg = await this.prisma.message.findUnique({ where: { id: input.messageId } });
    if (!msg) throw new NotFoundException("Message not found");
    if (msg.orgId !== input.orgId) throw new ForbiddenException("Forbidden");
    if (msg.deletedAt) throw new ForbiddenException("Message deleted");

    const thread = await this.prisma.thread.findUnique({ where: { id: msg.threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.orgId !== input.orgId) throw new ForbiddenException("Forbidden");
    if (thread.archivedAt || thread.state === "ARCHIVED") throw new ForbiddenException("Thread is archived");

    return await this.prisma.$transaction(async (tx) => {
      // Get the next version number
      const existingVersions = await tx.messageVersion.findMany({
        where: { orgId: input.orgId, messageId: input.messageId },
        orderBy: { version: "desc" },
        take: 1
      });
      const nextVersion = existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;

      const version = await tx.messageVersion.create({
        data: {
          orgId: input.orgId,
          messageId: input.messageId,
          version: nextVersion,
          body: input.body,
          format: (input.format ?? "MARKDOWN") as any,
          editorUserId: input.editorUserId
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
        event_type: EVENT_TYPES.CoreMessageVersionCreated,
        schema_version: 1,
        occurred_at: occurredAt.toISOString(),
        org_id: input.orgId,
        actor_user_id: input.editorUserId,
        trace_id: null,
        ordering_key: input.messageId,
        entity_ref: { type: "message", id: input.messageId },
        payload: {
          message_id: input.messageId,
          version: nextVersion,
          body: input.body,
          format: (input.format ?? "MARKDOWN") as string,
          created_at: version.createdAt.toISOString(),
          created_by: input.editorUserId
        }
      };
      await this.outbox.appendInTransaction(tx as unknown as OutboxTransaction, envelope);

      return version;
    });
  }

  async listVersions(input: { orgId: string; messageId: string }) {
    const msg = await this.prisma.message.findUnique({ where: { id: input.messageId } });
    if (!msg) throw new NotFoundException("Message not found");
    if (msg.orgId !== input.orgId) throw new ForbiddenException("Forbidden");

    return await this.prisma.messageVersion.findMany({
      where: { orgId: input.orgId, messageId: input.messageId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
  }
}

