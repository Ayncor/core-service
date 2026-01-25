import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";

import { JwtAuthGuard, type RequestWithPrincipal } from "../../shared/auth/auth.guard";
import { CreateMessageRequestDto, CreateMessageVersionRequestDto } from "./messages.dto";
import { MessagesService } from "./messages.service";

@Controller("messages")
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post()
  async create(@Req() req: RequestWithPrincipal, @Body() body: CreateMessageRequestDto) {
    const p = req.principal!;
    const { msg, v } = await this.messages.createMessage({
      orgId: p.org_id,
      threadId: body.thread_id,
      body: body.body,
      urgency: body.urgency,
      requiresResponse: body.requires_response,
      authorUserId: p.user_id,
      authorMembershipId: p.membership_id
    });

    return {
      message: {
        id: msg.id,
        org_id: msg.orgId,
        thread_id: msg.threadId,
        author_user_id: msg.authorUserId,
        author_membership_id: msg.authorMembershipId,
        urgency: msg.urgency,
        requires_response: msg.requiresResponse,
        created_at: msg.createdAt.toISOString(),
        latest_version: v
          ? {
              id: v.id,
              body: v.body,
              created_at: v.createdAt.toISOString()
            }
          : null
      }
    };
  }

  @Get("thread/:threadId")
  async listForThread(@Req() req: RequestWithPrincipal, @Param("threadId") threadId: string) {
    const p = req.principal!;
    const items = await this.messages.listMessages(p.org_id, threadId);
    return {
      messages: items.map(({ message: m, latest: v }) => ({
        id: m.id,
        org_id: m.orgId,
        thread_id: m.threadId,
        author_user_id: m.authorUserId,
        author_membership_id: m.authorMembershipId,
        urgency: m.urgency,
        requires_response: m.requiresResponse,
        created_at: m.createdAt.toISOString(),
        latest_version: v
          ? {
              id: v.id,
              body: v.body,
              created_at: v.createdAt.toISOString()
            }
          : null
      }))
    };
  }

  @Post(":messageId/versions")
  async createVersion(
    @Req() req: RequestWithPrincipal,
    @Param("messageId") messageId: string,
    @Body() body: CreateMessageVersionRequestDto
  ) {
    const p = req.principal!;
    const v = await this.messages.createVersion({
      orgId: p.org_id,
      messageId,
      body: body.body,
      editorUserId: p.user_id,
      editorMembershipId: p.membership_id
    });
    return {
      version: {
        id: v.id,
        message_id: v.messageId,
        body: v.body,
        created_at: v.createdAt.toISOString()
      }
    };
  }

  @Get(":messageId/versions")
  async listVersions(@Req() req: RequestWithPrincipal, @Param("messageId") messageId: string) {
    const p = req.principal!;
    const versions = await this.messages.listVersions({ orgId: p.org_id, messageId });
    return {
      versions: versions.map((v) => ({
        id: v.id,
        message_id: v.messageId,
        body: v.body,
        created_at: v.createdAt.toISOString()
      }))
    };
  }
}

