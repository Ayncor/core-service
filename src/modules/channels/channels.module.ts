import { Module } from "@nestjs/common";

import { StorageModule } from "../../shared/storage/storage.module";
import { ChannelsController } from "./channels.controller";
import { ChannelsService } from "./channels.service";

@Module({
  imports: [StorageModule],
  controllers: [ChannelsController],
  providers: [ChannelsService]
})
export class ChannelsModule {}

