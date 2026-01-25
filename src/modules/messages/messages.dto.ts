import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateMessageRequestDto {
  @IsUUID()
  thread_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;

  @IsOptional()
  @IsIn(["NORMAL", "URGENT"])
  urgency?: "NORMAL" | "URGENT";

  @IsOptional()
  @IsBoolean()
  requires_response?: boolean;
}

export class CreateMessageVersionRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;
}

