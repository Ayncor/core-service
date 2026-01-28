import { Module } from "@nestjs/common";

import { StorageModule } from "../../shared/storage/storage.module";
import { OutboxModule } from "../outbox/outbox.module";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";

@Module({
  imports: [StorageModule, OutboxModule],
  controllers: [MessagesController],
  providers: [MessagesService]
})
export class MessagesModule {}

