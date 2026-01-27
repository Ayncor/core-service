import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";

import { JwtAuthGuard, type RequestWithPrincipal } from "../../shared/auth/auth.guard";
import { InboxService } from "./inbox.service";

@Controller("inbox")
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  async getInbox(
    @Req() req: RequestWithPrincipal,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string
  ) {
    const p = req.principal!;
    return this.inbox.getInbox({
      orgId: p.org_id,
      userId: p.user_id,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor
    });
  }
}
