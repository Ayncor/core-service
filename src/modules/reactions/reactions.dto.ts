import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class ToggleReactionRequestDto {
  @IsUUID()
  message_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  emoji!: string;
}

