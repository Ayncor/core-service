import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateMessageRequestDto {
  @IsUUID()
  thread_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;

  @IsOptional()
  @IsIn(["TEXT", "SYSTEM"])
  kind?: "TEXT" | "SYSTEM";

  @IsOptional()
  @IsIn(["NORMAL", "URGENT"])
  urgency?: "NORMAL" | "URGENT";

  @IsOptional()
  @IsBoolean()
  requires_response?: boolean;

  @IsOptional()
  @IsUUID()
  reply_to_message_id?: string;

  @IsOptional()
  metadata_json?: Record<string, any>;
}

export class CreateMessageVersionRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;

  @IsOptional()
  @IsIn(["PLAIN", "MARKDOWN"])
  format?: "PLAIN" | "MARKDOWN";
}

