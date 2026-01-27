import { IsIn, IsOptional, IsUUID } from "class-validator";

export class AddParticipantRequestDto {
  @IsUUID()
  user_id!: string;

  @IsOptional()
  @IsIn(["OWNER", "PARTICIPANT", "OBSERVER"])
  role?: "OWNER" | "PARTICIPANT" | "OBSERVER";
}

export class UpdateParticipantRequestDto {
  @IsOptional()
  @IsIn(["OWNER", "PARTICIPANT", "OBSERVER"])
  role?: "OWNER" | "PARTICIPANT" | "OBSERVER";

  @IsOptional()
  muted_until?: string; // ISO date string or null
}
