/**
 * Event envelope (v1). Matches contracts/v1/events/envelope.schema.json.
 * Used for outbox and relay → realtime-gateway.
 */
export interface EventEnvelope {
  event_id: string;
  event_type: string;
  schema_version: number;
  occurred_at: string;
  org_id: string;
  actor_user_id?: string | null;
  trace_id?: string | null;
  ordering_key?: string | null;
  entity_ref: { type: string; id: string };
  payload: Record<string, unknown>;
}

export const EVENT_TYPES = {
  CoreMessageCreated: "Core.MessageCreated",
  CoreMessageVersionCreated: "Core.MessageVersionCreated",
  CoreThreadCreated: "Core.ThreadCreated",
  CoreThreadStateChanged: "Core.ThreadStateChanged",
  CoreThreadUserStateChanged: "Core.ThreadUserStateChanged",
  CoreThreadParticipantAdded: "Core.ThreadParticipantAdded",
  CoreReactionAdded: "Core.ReactionAdded",
} as const;
