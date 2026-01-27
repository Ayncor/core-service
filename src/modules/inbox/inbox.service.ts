import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../shared/storage/prisma.service";

type InboxNextAction = "REVIEW" | "RESPOND" | "WAIT" | "NONE";

interface InboxThread {
  thread_id: string;
  thread_title: string;
  thread_purpose: string | null;
  thread_state: string;
  thread_last_activity_at: string;
  user_status: string;
  needs_response: boolean;
  has_urgent_unread: boolean;
  unread_count: number;
  latest_message_preview: string | null;
  next_action: InboxNextAction;
  priority_override: string;
  sort_key: string; // Opaque server-defined ordering
}

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async getInbox(input: { orgId: string; userId: string; limit?: number; cursor?: string }) {
    const limit = input.limit ?? 50;
    const maxLimit = 100;
    const actualLimit = Math.min(limit, maxLimit);

    // Cursor-based pagination: order includes id for stable cursor; fetch one extra to detect next page.
    const userStates = await this.prisma.threadUserState.findMany({
      where: {
        orgId: input.orgId,
        userId: input.userId,
        status: "IN_INBOX"
      },
      include: {
        thread: true
      },
      orderBy: [
        { priorityOverride: "desc" },
        { needsResponse: "desc" },
        { thread: { lastActivityAt: "desc" } },
        { id: "asc" }
      ],
      take: actualLimit + 1,
      skip: input.cursor ? 1 : 0,
      ...(input.cursor ? { cursor: { id: input.cursor } } : {})
    });

    const hasMore = userStates.length > actualLimit;
    const page = hasMore ? userStates.slice(0, actualLimit) : userStates;

    if (page.length === 0) {
      return { items: [], next_cursor: undefined };
    }

    const threadIds = page.map((s) => s.thread.id);

    // Get latest message for each thread
    // Use a subquery approach: get max createdAt per thread, then fetch those messages
    const latestMessagesByThread = await Promise.all(
      threadIds.map(async (threadId) => {
        const latest = await this.prisma.message.findFirst({
          where: {
            orgId: input.orgId,
            threadId,
            deletedAt: null
          },
          orderBy: { createdAt: "desc" },
          include: {
            versions: {
              orderBy: { version: "desc" },
              take: 1
            }
          }
        });
        return latest ? { threadId, message: latest } : null;
      })
    );

    const latestByThreadId = new Map(
      latestMessagesByThread.filter((x): x is { threadId: string; message: any } => x !== null).map((x) => [x.threadId, x.message])
    );

    // Total message count per thread (for threads with no lastReadMessageId)
    const totalCountsByThread = await this.prisma.message.groupBy({
      by: ["threadId"],
      where: {
        orgId: input.orgId,
        threadId: { in: threadIds },
        deletedAt: null
      },
      _count: true
    });
    const totalCountsMap = new Map(totalCountsByThread.map((g) => [g.threadId, g._count]));

    // lastReadMessageId-based unread: for each state with lastReadMessageId, count messages after that message
    const lastReadMessageIds = page.map((s) => s.lastReadMessageId).filter((id): id is string => id != null);
    const lastReadMessages =
      lastReadMessageIds.length > 0
        ? await this.prisma.message.findMany({
            where: { id: { in: lastReadMessageIds } },
            select: { id: true, createdAt: true }
          })
        : [];
    const lastReadAtByMessageId = new Map(lastReadMessages.map((m) => [m.id, m.createdAt]));

    const lastReadUnreadCounts = await Promise.all(
      page.map(async (s) => {
        if (!s.lastReadMessageId) return { threadId: s.thread.id, count: null as number | null };
        const lastReadAt = lastReadAtByMessageId.get(s.lastReadMessageId);
        if (!lastReadAt) return { threadId: s.thread.id, count: totalCountsMap.get(s.thread.id) ?? 0 };
        const count = await this.prisma.message.count({
          where: {
            orgId: input.orgId,
            threadId: s.thread.id,
            deletedAt: null,
            createdAt: { gt: lastReadAt }
          }
        });
        return { threadId: s.thread.id, count };
      })
    );
    const lastReadBasedUnreadMap = new Map(
      lastReadUnreadCounts.filter((x) => x.count != null).map((x) => [x.threadId, x.count!])
    );

    // Get urgent messages (batch query)
    const urgentThreads = await this.prisma.message.findMany({
      where: {
        orgId: input.orgId,
        threadId: { in: threadIds },
        deletedAt: null,
        urgency: "URGENT"
      },
      distinct: ["threadId"],
      select: { threadId: true }
    });

    const urgentThreadIds = new Set(urgentThreads.map((m) => m.threadId));

    // Build inbox items
    const inboxItems: InboxThread[] = [];

    for (const state of page) {
      const thread = state.thread;
      const latestMessage = latestByThreadId.get(thread.id);
      const latestVersion = latestMessage?.versions[0];

      // Unread count: when lastReadMessageId is set, count messages with createdAt > that message; otherwise total messages in thread
      const totalCount = totalCountsMap.get(thread.id) ?? 0;
      const unreadCount = lastReadBasedUnreadMap.get(thread.id) ?? totalCount;

      const hasUrgentUnread = urgentThreadIds.has(thread.id) && unreadCount > 0;

      // Determine next action
      let nextAction: InboxNextAction = "NONE";
      if (state.needsResponse) {
        nextAction = "RESPOND";
      } else if (unreadCount > 0) {
        nextAction = "REVIEW";
      } else if (thread.state === "BLOCKED") {
        nextAction = "WAIT";
      }

      // Sort key: priority_override desc, needs_response desc, last_activity_at desc
      const sortKey = `${state.priorityOverride}_${state.needsResponse ? "1" : "0"}_${thread.lastActivityAt.getTime()}`;

      inboxItems.push({
        thread_id: thread.id,
        thread_title: thread.title,
        thread_purpose: thread.purpose,
        thread_state: thread.state,
        thread_last_activity_at: thread.lastActivityAt.toISOString(),
        user_status: state.status,
        needs_response: state.needsResponse,
        has_urgent_unread: hasUrgentUnread,
        unread_count: unreadCount,
        latest_message_preview: latestVersion?.body.substring(0, 200) ?? null,
        next_action: nextAction,
        priority_override: state.priorityOverride,
        sort_key: sortKey
      });
    }

    const next_cursor = hasMore ? page[page.length - 1].id : undefined;
    return { items: inboxItems, next_cursor };
  }
}
