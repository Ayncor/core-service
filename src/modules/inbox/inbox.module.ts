import { Module } from "@nestjs/common";

import { StorageModule } from "../../shared/storage/storage.module";
import { InboxController } from "./inbox.controller";
import { InboxService } from "./inbox.service";

@Module({
  imports: [StorageModule],
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService]
})
export class InboxModule {}
