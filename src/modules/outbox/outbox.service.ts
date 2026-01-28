import { Injectable } from "@nestjs/common";
import type { EventEnvelope } from "../../shared/events/event-envelope";

/** Transaction client shape used for appending to outbox (matches Prisma.TransactionClient after prisma generate). */
export interface OutboxTransaction {
  outboxEvent: { create: (args: { data: { envelope: object; status: "PENDING" } }) => Promise<{ id: string }> };
}

@Injectable()
export class OutboxService {
  /**
   * Append an event envelope to the outbox inside the same DB transaction as the domain write.
   * Relay will later publish it to Redis for realtime-gateway.
   */
  async appendInTransaction(tx: OutboxTransaction, envelope: EventEnvelope): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        envelope: envelope as object,
        status: "PENDING",
      },
    });
  }
}
