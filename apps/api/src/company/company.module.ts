import { Module } from "@nestjs/common";
import path from "node:path";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CompanyController } from "./company.controller";
import { CompanyMediaController } from "./company-media.controller";
import {
  COMPANY_MEDIA_STORAGE_ROOT,
  COMPANY_MEDIA_STORAGE_SUBROOT,
  CompanyMediaService,
} from "./company-media.service";
import { CompanyService } from "./company.service";

@Module({
  controllers: [CompanyController, CompanyMediaController],
  imports: [AuthModule, PrismaModule],
  providers: [
    CompanyService,
    CompanyMediaService,
    {
      provide: COMPANY_MEDIA_STORAGE_ROOT,
      useFactory: () => {
        const override = process.env.COMPANY_MEDIA_ROOT?.trim();
        return override
          ? path.resolve(override)
          : path.resolve(process.cwd(), "storage", COMPANY_MEDIA_STORAGE_SUBROOT);
      },
    },
  ],
})
export class CompanyModule {}
