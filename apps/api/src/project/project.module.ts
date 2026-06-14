import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectController } from "./project.controller";
import { ProjectService } from "./project.service";

@Module({
  controllers: [ProjectController],
  imports: [AuthModule, PrismaModule],
  providers: [ProjectService],
})
export class ProjectModule {}
