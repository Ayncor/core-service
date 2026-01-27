import { Module } from "@nestjs/common";

import { StorageModule } from "../../shared/storage/storage.module";
import { UserStateController } from "./user-state.controller";
import { UserStateService } from "./user-state.service";

@Module({
  imports: [StorageModule],
  controllers: [UserStateController],
  providers: [UserStateService],
  exports: [UserStateService]
})
export class UserStateModule {}
