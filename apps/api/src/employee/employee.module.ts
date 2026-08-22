import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { EmployeeController } from "./employee.controller";
import { EmployeeService } from "./employee.service";

@Module({
  controllers: [EmployeeController],
  imports: [AuthModule, PrismaModule],
  providers: [EmployeeService],
})
export class EmployeeModule {}
