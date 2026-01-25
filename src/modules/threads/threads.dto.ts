import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateThreadRequestDto {
  @IsUUID()
  channel_id!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  purpose?: string;
}

