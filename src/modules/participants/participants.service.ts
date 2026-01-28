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
    addedByUserId?: string;
  }) {
    const thread = await this.prisma.thread.findUnique({ where: { id: input.threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.orgId !== input.orgId) throw new ForbiddenException("Forbidden");

    // Find any participant record for this user in this thread (active or left)
    const existing = await this.prisma.threadParticipant.findFirst({
      where: {
        orgId: input.orgId,
        threadId: input.threadId,
        userId: input.userId
      }
    });

    if (existing) {
      if (existing.leftAt) {
        // Re-join: they had left, now being re-added
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

          // System message: "X re-joined" / "Y re-added X"
          if (input.addedByUserId) {
            const sysMsg = await tx.message.create({
              data: {
                orgId: input.orgId,
                threadId: input.threadId,
                authorUserId: input.addedByUserId,
                authorMembershipId: null,
                kind: "SYSTEM",
                urgency: "NORMAL",
                requiresResponse: false,
                metadataJson: {
                  system_type: "participant_rejoined",
                  added_user_id: input.userId,
                  added_by_user_id: input.addedByUserId
                }
              }
            });
            await tx.messageVersion.create({
              data: {
                orgId: input.orgId,
                messageId: sysMsg.id,
                version: 1,
                body: "Participant re-joined the thread",
                format: "PLAIN",
                editorUserId: input.addedByUserId
              }
            });
            await tx.thread.update({
              where: { id: input.threadId },
              data: { lastActivityAt: new Date() }
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

      // System message so the thread shows "X joined" / "Y added X" when listing messages
      const thread = await tx.thread.findUnique({ where: { id: input.threadId } });
      if (thread && input.addedByUserId) {
        const sysMsg = await tx.message.create({
          data: {
            orgId: input.orgId,
            threadId: input.threadId,
            authorUserId: input.addedByUserId,
            authorMembershipId: null,
            kind: "SYSTEM",
            urgency: "NORMAL",
            requiresResponse: false,
            metadataJson: {
              system_type: "participant_added",
              added_user_id: input.userId,
              added_by_user_id: input.addedByUserId
            }
          }
        });
        await tx.messageVersion.create({
          data: {
            orgId: input.orgId,
            messageId: sysMsg.id,
            version: 1,
            body: "Participant joined the thread",
            format: "PLAIN",
            editorUserId: input.addedByUserId
          }
        });
        await tx.thread.update({
          where: { id: input.threadId },
          data: { lastActivityAt: new Date() }
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
