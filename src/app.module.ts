import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./shared/auth/auth.module";
import { HealthModule } from "./shared/health/health.module";
import { StorageModule } from "./shared/storage/storage.module";
import { ChannelsModule } from "./modules/channels/channels.module";
import { ThreadsModule } from "./modules/threads/threads.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { ReactionsModule } from "./modules/reactions/reactions.module";
import { ParticipantsModule } from "./modules/participants/participants.module";
import { UserStateModule } from "./modules/user-state/user-state.module";
import { InboxModule } from "./modules/inbox/inbox.module";
import { OutboxModule } from "./modules/outbox/outbox.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    StorageModule,
    HealthModule,
    OutboxModule,
    ChannelsModule,
    ThreadsModule,
    MessagesModule,
    ReactionsModule,
    ParticipantsModule,
    UserStateModule,
    InboxModule
  ]
})
export class AppModule {}

