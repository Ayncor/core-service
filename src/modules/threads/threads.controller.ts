import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";

import { JwtAuthGuard, type RequestWithPrincipal } from "../../shared/auth/auth.guard";
import { CreateThreadRequestDto, UpdateThreadStateRequestDto } from "./threads.dto";
import { ThreadsService } from "./threads.service";

@Controller("threads")
@UseGuards(JwtAuthGuard)
export class ThreadsController {
  constructor(private readonly threads: ThreadsService) {}

  @Post()
  async create(@Req() req: RequestWithPrincipal, @Body() body: CreateThreadRequestDto) {
    const p = req.principal!;
    const t = await this.threads.createThread({
      orgId: p.org_id,
      channelId: body.channel_id,
      title: body.title,
      purpose: body.purpose,
      createdByUserId: p.user_id,
      createdByMembershipId: p.membership_id
    });
    return {
      thread: {
        id: t.id,
        org_id: t.orgId,
        channel_id: t.channelId,
        state: t.state,
        title: t.title,
        purpose: t.purpose,
        created_at: t.createdAt.toISOString(),
        last_activity_at: t.lastActivityAt.toISOString()
      }
    };
  }

  @Get("channel/:channelId")
  async listForChannel(@Req() req: RequestWithPrincipal, @Param("channelId") channelId: string) {
    const p = req.principal!;
    const items = await this.threads.listThreads(p.org_id, channelId);
    return {
      threads: items.map((t) => ({
        id: t.id,
        org_id: t.orgId,
        channel_id: t.channelId,
        state: t.state,
        title: t.title,
        purpose: t.purpose,
        created_at: t.createdAt.toISOString(),
        last_activity_at: t.lastActivityAt.toISOString()
      }))
    };
  }

  @Post(":threadId/state")
  async setState(@Req() req: RequestWithPrincipal, @Param("threadId") threadId: string, @Body() body: UpdateThreadStateRequestDto) {
    const p = req.principal!;
    const t = await this.threads.setThreadState({
      orgId: p.org_id,
      threadId,
      nextState: body.state
    });
    return {
      thread: {
        id: t.id,
        org_id: t.orgId,
        channel_id: t.channelId,
        state: t.state,
        title: t.title,
        purpose: t.purpose,
        created_at: t.createdAt.toISOString(),
        last_activity_at: t.lastActivityAt.toISOString(),
        archived_at: t.archivedAt ? t.archivedAt.toISOString() : null
      }
    };
  }
}

