import { Module } from "@nestjs/common";

import { StorageModule } from "../../shared/storage/storage.module";
import { ReactionsController } from "./reactions.controller";
import { ReactionsService } from "./reactions.service";

@Module({
  imports: [StorageModule],
  controllers: [ReactionsController],
  providers: [ReactionsService]
})
export class ReactionsModule {}

