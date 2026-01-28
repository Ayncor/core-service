import { Module } from "@nestjs/common";

import { StorageModule } from "../../shared/storage/storage.module";
import { OutboxModule } from "../outbox/outbox.module";
import { ThreadsController } from "./threads.controller";
import { ThreadsService } from "./threads.service";

@Module({
  imports: [StorageModule, OutboxModule],
  controllers: [ThreadsController],
  providers: [ThreadsService]
})
export class ThreadsModule {}

