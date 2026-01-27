import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../shared/storage/prisma.service";

@Injectable()
export class UserStateService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateUserState(input: { orgId: string; threadId: string; userId: string }) {
    const thread = await this.prisma.thread.findUnique({ where: { id: input.threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.orgId !== input.orgId) throw new ForbiddenException("Forbidden");

    let state = await this.prisma.threadUserState.findUnique({
      where: {
        orgId_threadId_userId: {
          orgId: input.orgId,
          threadId: input.threadId,
          userId: input.userId
        }
      }
    });

    if (!state) {
      state = await this.prisma.threadUserState.create({
        data: {
          orgId: input.orgId,
          threadId: input.threadId,
          userId: input.userId
        }
      });
    }

    return state;
  }

  async updateUserState(input: {
    orgId: string;
    threadId: string;
    userId: string;
    status?: "IN_INBOX" | "ARCHIVED" | "SNOOZED";
    needsResponse?: boolean;
    snoozedUntil?: Date | null;
    lastReadMessageId?: string | null;
    lastReviewedAt?: Date | null;
    priorityOverride?: "NONE" | "LOW" | "HIGH";
  }) {
    const thread = await this.prisma.thread.findUnique({ where: { id: input.threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.orgId !== input.orgId) throw new ForbiddenException("Forbidden");

    // Validate: if status is SNOOZED, snoozedUntil must be set (return 400 per contract)
    if (input.status === "SNOOZED" && !input.snoozedUntil) {
      throw new BadRequestException("snoozed_until is required when status is SNOOZED");
    }

    const existing = await this.prisma.threadUserState.findUnique({
      where: {
        orgId_threadId_userId: {
          orgId: input.orgId,
          threadId: input.threadId,
          userId: input.userId
        }
      }
    });

    if (!existing) {
      return await this.prisma.threadUserState.create({
        data: {
          orgId: input.orgId,
          threadId: input.threadId,
          userId: input.userId,
          status: (input.status ?? "IN_INBOX") as any,
          needsResponse: input.needsResponse ?? false,
          snoozedUntil: input.snoozedUntil ?? null,
          lastReadMessageId: input.lastReadMessageId ?? null,
          lastReviewedAt: input.lastReviewedAt ?? null,
          priorityOverride: (input.priorityOverride ?? "NONE") as any
        }
      });
    }

    return await this.prisma.threadUserState.update({
      where: { id: existing.id },
      data: {
        status: input.status ? (input.status as any) : undefined,
        needsResponse: input.needsResponse !== undefined ? input.needsResponse : undefined,
        snoozedUntil: input.snoozedUntil !== undefined ? input.snoozedUntil : undefined,
        lastReadMessageId: input.lastReadMessageId !== undefined ? input.lastReadMessageId : undefined,
        lastReviewedAt: input.lastReviewedAt !== undefined ? input.lastReviewedAt : undefined,
        priorityOverride: input.priorityOverride ? (input.priorityOverride as any) : undefined
      }
    });
  }

  async getUserState(input: { orgId: string; threadId: string; userId: string }) {
    const thread = await this.prisma.thread.findUnique({ where: { id: input.threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.orgId !== input.orgId) throw new ForbiddenException("Forbidden");

    return await this.getOrCreateUserState(input);
  }
}
