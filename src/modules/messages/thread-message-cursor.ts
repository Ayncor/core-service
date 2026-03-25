import { BadRequestException } from "@nestjs/common";

type CursorPayload = {
  ca: string;
  id: string;
  tid: string;
  oid: string;
};

export function encodeThreadMessageCursor(createdAt: Date, id: string, threadId: string, orgId: string): string {
  const payload: CursorPayload = {
    ca: createdAt.toISOString(),
    id,
    tid: threadId,
    oid: orgId
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeThreadMessageCursor(
  cursor: string,
  expectedThreadId: string,
  expectedOrgId: string
): { createdAt: Date; id: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new BadRequestException("Invalid cursor");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("ca" in parsed) ||
    !("id" in parsed) ||
    !("tid" in parsed) ||
    !("oid" in parsed)
  ) {
    throw new BadRequestException("Invalid cursor");
  }
  const p = parsed as CursorPayload;
  if (typeof p.ca !== "string" || typeof p.id !== "string" || typeof p.tid !== "string" || typeof p.oid !== "string") {
    throw new BadRequestException("Invalid cursor");
  }
  if (p.tid !== expectedThreadId || p.oid !== expectedOrgId) {
    throw new BadRequestException("Invalid cursor");
  }
  const createdAt = new Date(p.ca);
  if (Number.isNaN(createdAt.getTime())) {
    throw new BadRequestException("Invalid cursor");
  }
  return { createdAt, id: p.id };
}
