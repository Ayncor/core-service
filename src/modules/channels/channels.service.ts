import { ConflictException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../shared/storage/prisma.service";

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async createChannel(input: {
    orgId: string;
    name: string;
    slug: string;
    description?: string | null;
    visibility?: "ORG" | "PRIVATE";
    createdByUserId?: string | null;
  }) {
    const existing = await this.prisma.channel.findUnique({
      where: {
        orgId_slug: { orgId: input.orgId, slug: input.slug }
      }
    });
    if (existing) throw new ConflictException("Channel slug already exists");

    return await this.prisma.channel.create({
      data: {
        orgId: input.orgId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        visibility: (input.visibility ?? "ORG") as any,
        createdByUserId: input.createdByUserId ?? null
      }
    });
  }

  async listChannels(orgId: string) {
    return await this.prisma.channel.findMany({
      where: { orgId, archivedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
  }
}

