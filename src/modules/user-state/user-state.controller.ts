import { Body, Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";

import { JwtAuthGuard, type RequestWithPrincipal } from "../../shared/auth/auth.guard";
import { UpdateThreadUserStateRequestDto } from "./user-state.dto";
import { UserStateService } from "./user-state.service";

@Controller("threads/:threadId/user-state")
@UseGuards(JwtAuthGuard)
export class UserStateController {
  constructor(private readonly userState: UserStateService) {}

  @Get()
  async get(@Req() req: RequestWithPrincipal, @Param("threadId") threadId: string) {
    const p = req.principal!;
    const state = await this.userState.getUserState({
      orgId: p.org_id,
      threadId,
      userId: p.user_id
    });
    return {
      user_state: {
        id: state.id,
        org_id: state.orgId,
        thread_id: state.threadId,
        user_id: state.userId,
        status: state.status,
        needs_response: state.needsResponse,
        snoozed_until: state.snoozedUntil ? state.snoozedUntil.toISOString() : null,
        last_read_message_id: state.lastReadMessageId,
        last_reviewed_at: state.lastReviewedAt ? state.lastReviewedAt.toISOString() : null,
        priority_override: state.priorityOverride,
        created_at: state.createdAt.toISOString(),
        updated_at: state.updatedAt.toISOString()
      }
    };
  }

  @Patch()
  async update(@Req() req: RequestWithPrincipal, @Param("threadId") threadId: string, @Body() body: UpdateThreadUserStateRequestDto) {
    const p = req.principal!;
    const snoozedUntil = body.snoozed_until ? new Date(body.snoozed_until) : body.snoozed_until === null ? null : undefined;
    const lastReviewedAt = body.last_reviewed_at ? new Date(body.last_reviewed_at) : body.last_reviewed_at === null ? null : undefined;
    const state = await this.userState.updateUserState({
      orgId: p.org_id,
      threadId,
      userId: p.user_id,
      status: body.status,
      needsResponse: body.needs_response,
      snoozedUntil,
      lastReadMessageId: body.last_read_message_id,
      lastReviewedAt,
      priorityOverride: body.priority_override
    });
    return {
      user_state: {
        id: state.id,
        org_id: state.orgId,
        thread_id: state.threadId,
        user_id: state.userId,
        status: state.status,
        needs_response: state.needsResponse,
        snoozed_until: state.snoozedUntil ? state.snoozedUntil.toISOString() : null,
        last_read_message_id: state.lastReadMessageId,
        last_reviewed_at: state.lastReviewedAt ? state.lastReviewedAt.toISOString() : null,
        priority_override: state.priorityOverride,
        created_at: state.createdAt.toISOString(),
        updated_at: state.updatedAt.toISOString()
      }
    };
  }
}
