import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../shared/storage/prisma.service";

@Injectable()
export class ThreadsService {
  constructor(private readonly prisma: PrismaService) {}

  async createThread(input: {
    orgId: string;
    channelId: string;
    title: string;
    purpose?: string | null;
    createdByUserId?: string | null;
    createdByMembershipId?: string | null;
  }) {
    const channel = await this.prisma.channel.findUnique({ where: { id: input.channelId } });
    if (!channel) throw new NotFoundException("Channel not found");
    if (channel.orgId !== input.orgId) throw new ForbiddenException("Forbidden");
    if (channel.archivedAt) throw new ForbiddenException("Channel is archived");

    return await this.prisma.thread.create({
      data: {
        orgId: input.orgId,
        channelId: input.channelId,
        title: input.title,
        purpose: input.purpose ?? null,
        createdByUserId: input.createdByUserId ?? null,
        createdByMembershipId: input.createdByMembershipId ?? null
      }
    });
  }

  async listThreads(orgId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException("Channel not found");
    if (channel.orgId !== orgId) throw new ForbiddenException("Forbidden");

    return await this.prisma.thread.findMany({
      where: { orgId, channelId, archivedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
  }
}

