import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CompanyController } from "./company.controller";
import { CompanyService } from "./company.service";

@Module({
  controllers: [CompanyController],
  imports: [AuthModule, PrismaModule],
  providers: [CompanyService],
})
export class CompanyModule {}
