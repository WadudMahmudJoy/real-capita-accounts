import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { DepartmentController } from "./department.controller";
import { DepartmentService } from "./department.service";

@Module({
  controllers: [DepartmentController],
  imports: [AuthModule, PrismaModule],
  providers: [DepartmentService],
})
export class DepartmentModule {}
