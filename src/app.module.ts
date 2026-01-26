import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./shared/auth/auth.module";
import { HealthModule } from "./shared/health/health.module";
import { StorageModule } from "./shared/storage/storage.module";
import { ChannelsModule } from "./modules/channels/channels.module";
import { ThreadsModule } from "./modules/threads/threads.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { ReactionsModule } from "./modules/reactions/reactions.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    StorageModule,
    HealthModule,
    ChannelsModule,
    ThreadsModule,
    MessagesModule,
    ReactionsModule
  ]
})
export class AppModule {}

