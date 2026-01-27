import { IsBoolean, IsIn, IsOptional, IsUUID } from "class-validator";

export class UpdateThreadUserStateRequestDto {
  @IsOptional()
  @IsIn(["IN_INBOX", "ARCHIVED", "SNOOZED"])
  status?: "IN_INBOX" | "ARCHIVED" | "SNOOZED";

  @IsOptional()
  @IsBoolean()
  needs_response?: boolean;

  @IsOptional()
  snoozed_until?: string; // ISO date string or null

  @IsOptional()
  @IsUUID()
  last_read_message_id?: string | null;

  @IsOptional()
  last_reviewed_at?: string; // ISO date string or null

  @IsOptional()
  @IsIn(["NONE", "LOW", "HIGH"])
  priority_override?: "NONE" | "LOW" | "HIGH";
}
