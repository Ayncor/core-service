import { Module } from "@nestjs/common";

import { StorageModule } from "../../shared/storage/storage.module";
import { ThreadsController } from "./threads.controller";
import { ThreadsService } from "./threads.service";

@Module({
  imports: [StorageModule],
  controllers: [ThreadsController],
  providers: [ThreadsService]
})
export class ThreadsModule {}

