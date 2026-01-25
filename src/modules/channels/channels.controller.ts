import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";

import { JwtAuthGuard, type RequestWithPrincipal } from "../../shared/auth/auth.guard";
import { CreateChannelRequestDto } from "./channels.dto";
import { ChannelsService } from "./channels.service";

@Controller("channels")
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Post()
  async create(@Req() req: RequestWithPrincipal, @Body() body: CreateChannelRequestDto) {
    const p = req.principal!;
    const ch = await this.channels.createChannel({
      orgId: p.org_id,
      name: body.name,
      slug: body.slug,
      visibility: body.visibility,
      createdByUserId: p.user_id
    });
    return {
      channel: {
        id: ch.id,
        org_id: ch.orgId,
        name: ch.name,
        slug: ch.slug,
        visibility: ch.visibility,
        created_at: ch.createdAt.toISOString()
      }
    };
  }

  @Get()
  async list(@Req() req: RequestWithPrincipal) {
    const p = req.principal!;
    const items = await this.channels.listChannels(p.org_id);
    return {
      channels: items.map((c) => ({
        id: c.id,
        org_id: c.orgId,
        name: c.name,
        slug: c.slug,
        visibility: c.visibility,
        created_at: c.createdAt.toISOString()
      }))
    };
  }
}

