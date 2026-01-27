import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";

import { JwtAuthGuard, type RequestWithPrincipal } from "../../shared/auth/auth.guard";
import { AddParticipantRequestDto, UpdateParticipantRequestDto } from "./participants.dto";
import { ParticipantsService } from "./participants.service";

@Controller("threads/:threadId/participants")
@UseGuards(JwtAuthGuard)
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Post()
  async add(@Req() req: RequestWithPrincipal, @Param("threadId") threadId: string, @Body() body: AddParticipantRequestDto) {
    const p = req.principal!;
    const participant = await this.participants.addParticipant({
      orgId: p.org_id,
      threadId,
      userId: body.user_id,
      role: body.role
    });
    return {
      participant: {
        id: participant.id,
        org_id: participant.orgId,
        thread_id: participant.threadId,
        user_id: participant.userId,
        role: participant.role,
        joined_at: participant.joinedAt.toISOString(),
        left_at: participant.leftAt ? participant.leftAt.toISOString() : null,
        muted_until: participant.mutedUntil ? participant.mutedUntil.toISOString() : null
      }
    };
  }

  @Get()
  async list(@Req() req: RequestWithPrincipal, @Param("threadId") threadId: string) {
    const p = req.principal!;
    const items = await this.participants.listParticipants({
      orgId: p.org_id,
      threadId
    });
    return {
      participants: items.map((p) => ({
        id: p.id,
        org_id: p.orgId,
        thread_id: p.threadId,
        user_id: p.userId,
        role: p.role,
        joined_at: p.joinedAt.toISOString(),
        left_at: p.leftAt ? p.leftAt.toISOString() : null,
        muted_until: p.mutedUntil ? p.mutedUntil.toISOString() : null
      }))
    };
  }

  @Patch(":userId")
  async update(
    @Req() req: RequestWithPrincipal,
    @Param("threadId") threadId: string,
    @Param("userId") userId: string,
    @Body() body: UpdateParticipantRequestDto
  ) {
    const p = req.principal!;
    const mutedUntil = body.muted_until ? new Date(body.muted_until) : body.muted_until === null ? null : undefined;
    const participant = await this.participants.updateParticipant({
      orgId: p.org_id,
      threadId,
      userId,
      role: body.role,
      mutedUntil
    });
    return {
      participant: {
        id: participant.id,
        org_id: participant.orgId,
        thread_id: participant.threadId,
        user_id: participant.userId,
        role: participant.role,
        joined_at: participant.joinedAt.toISOString(),
        left_at: participant.leftAt ? participant.leftAt.toISOString() : null,
        muted_until: participant.mutedUntil ? participant.mutedUntil.toISOString() : null
      }
    };
  }

  @Delete(":userId")
  async remove(@Req() req: RequestWithPrincipal, @Param("threadId") threadId: string, @Param("userId") userId: string) {
    const p = req.principal!;
    await this.participants.removeParticipant({
      orgId: p.org_id,
      threadId,
      userId
    });
    return { status: "removed" };
  }
}
