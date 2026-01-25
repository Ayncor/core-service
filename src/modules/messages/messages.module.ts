import { Module } from "@nestjs/common";

import { StorageModule } from "../../shared/storage/storage.module";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";

@Module({
  imports: [StorageModule],
  controllers: [MessagesController],
  providers: [MessagesService]
})
export class MessagesModule {}

