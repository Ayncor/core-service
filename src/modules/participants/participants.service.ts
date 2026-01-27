import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../shared/storage/prisma.service";

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async addParticipant(input: {
    orgId: string;
    threadId: string;
    userId: string;
    role?: "OWNER" | "PARTICIPANT" | "OBSERVER";
  }) {
    const thread = await this.prisma.thread.findUnique({ where: { id: input.threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.orgId !== input.orgId) throw new ForbiddenException("Forbidden");

    // Check if participant already exists (not left)
    const existing = await this.prisma.threadParticipant.findFirst({
      where: {
        orgId: input.orgId,
        threadId: input.threadId,
        userId: input.userId,
        leftAt: null
      }
    });

    if (existing) {
      // Re-join if they left
      if (existing.leftAt) {
        return await this.prisma.$transaction(async (tx) => {
          const participant = await tx.threadParticipant.update({
            where: { id: existing.id },
            data: {
              role: (input.role ?? "PARTICIPANT") as any,
              joinedAt: new Date(),
              leftAt: null,
              mutedUntil: null
            }
          });

          // Ensure user state exists
          const existingState = await tx.threadUserState.findUnique({
            where: {
              orgId_threadId_userId: {
                orgId: input.orgId,
                threadId: input.threadId,
                userId: input.userId
              }
            }
          });

          if (!existingState) {
            await tx.threadUserState.create({
              data: {
                orgId: input.orgId,
                threadId: input.threadId,
                userId: input.userId
              }
            });
          }

          return participant;
        });
      }
      throw new ConflictException("User is already a participant");
    }

    return await this.prisma.$transaction(async (tx) => {
      const participant = await tx.threadParticipant.create({
        data: {
          orgId: input.orgId,
          threadId: input.threadId,
          userId: input.userId,
          role: (input.role ?? "PARTICIPANT") as any
        }
      });

      // Auto-create user state if it doesn't exist
      const existingState = await tx.threadUserState.findUnique({
        where: {
          orgId_threadId_userId: {
            orgId: input.orgId,
            threadId: input.threadId,
            userId: input.userId
          }
        }
      });

      if (!existingState) {
        await tx.threadUserState.create({
          data: {
            orgId: input.orgId,
            threadId: input.threadId,
            userId: input.userId
          }
        });
      }

      return participant;
    });
  }

  async removeParticipant(input: { orgId: string; threadId: string; userId: string }) {
    const participant = await this.prisma.threadParticipant.findFirst({
      where: {
        orgId: input.orgId,
        threadId: input.threadId,
        userId: input.userId,
        leftAt: null
      }
    });

    if (!participant) throw new NotFoundException("Participant not found");

    return await this.prisma.threadParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() }
    });
  }

  async updateParticipant(input: {
    orgId: string;
    threadId: string;
    userId: string;
    role?: "OWNER" | "PARTICIPANT" | "OBSERVER";
    mutedUntil?: Date | null;
  }) {
    const participant = await this.prisma.threadParticipant.findFirst({
      where: {
        orgId: input.orgId,
        threadId: input.threadId,
        userId: input.userId,
        leftAt: null
      }
    });

    if (!participant) throw new NotFoundException("Participant not found");

    return await this.prisma.threadParticipant.update({
      where: { id: participant.id },
      data: {
        role: input.role ? (input.role as any) : undefined,
        mutedUntil: input.mutedUntil !== undefined ? input.mutedUntil : undefined
      }
    });
  }

  async listParticipants(input: { orgId: string; threadId: string }) {
    const thread = await this.prisma.thread.findUnique({ where: { id: input.threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.orgId !== input.orgId) throw new ForbiddenException("Forbidden");

    return await this.prisma.threadParticipant.findMany({
      where: {
        orgId: input.orgId,
        threadId: input.threadId,
        leftAt: null
      },
      orderBy: [{ joinedAt: "asc" }, { id: "asc" }]
    });
  }
}
