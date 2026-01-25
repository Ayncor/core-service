import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { JwtAuthGuard } from "./auth.guard";

function isProbablyWeakSecret(secret: string): boolean {
  return secret.length < 32 || secret === "dev-only-change-me";
}

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const secret = cfg.get<string>("JWT_ACCESS_SECRET") ?? "dev-only-change-me";
        const nodeEnv = (cfg.get<string>("NODE_ENV") ?? "development").toLowerCase();
        if (nodeEnv !== "development" && isProbablyWeakSecret(secret)) {
          throw new Error("JWT_ACCESS_SECRET is too weak for non-development environments");
        }
        return {
          secret,
          signOptions: {
            expiresIn: Number(cfg.get<string>("JWT_ACCESS_TTL_SECONDS") ?? "900")
          }
        };
      }
    })
  ],
  providers: [JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard]
})
export class AuthModule {}

