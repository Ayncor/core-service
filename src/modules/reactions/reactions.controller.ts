import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";

import { JwtAuthGuard, type RequestWithPrincipal } from "../../shared/auth/auth.guard";
import { ToggleReactionRequestDto } from "./reactions.dto";
import { ReactionsService } from "./reactions.service";

@Controller("reactions")
@UseGuards(JwtAuthGuard)
export class ReactionsController {
  constructor(private readonly reactions: ReactionsService) {}

  @Post()
  async toggle(@Req() req: RequestWithPrincipal, @Body() body: ToggleReactionRequestDto) {
    const p = req.principal!;
    const res = await this.reactions.toggleReaction({
      orgId: p.org_id,
      messageId: body.message_id,
      emoji: body.emoji,
      actorUserId: p.user_id,
      actorMembershipId: p.membership_id
    });

    return {
      action: res.action,
      reaction: {
        id: res.reaction.id,
        org_id: res.reaction.orgId,
        message_id: res.reaction.messageId,
        emoji: res.reaction.emoji,
        created_at: res.reaction.createdAt.toISOString(),
        removed_at: res.reaction.removedAt ? res.reaction.removedAt.toISOString() : null
      }
    };
  }

  @Get("message/:messageId")
  async listForMessage(@Req() req: RequestWithPrincipal, @Param("messageId") messageId: string) {
    const p = req.principal!;
    const reactions = await this.reactions.listForMessage({ orgId: p.org_id, messageId, actorUserId: p.user_id });
    return { reactions };
  }
}

