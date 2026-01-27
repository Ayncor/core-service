import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateChannelRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsOptional()
  @IsIn(["ORG", "PRIVATE"])
  visibility?: "ORG" | "PRIVATE";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

