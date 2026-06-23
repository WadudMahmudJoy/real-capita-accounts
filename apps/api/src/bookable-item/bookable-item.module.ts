import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { BookableItemController } from "./bookable-item.controller";
import { BookableItemService } from "./bookable-item.service";

@Module({
  controllers: [BookableItemController],
  imports: [AuthModule, PrismaModule],
  providers: [BookableItemService],
})
export class BookableItemModule {}
