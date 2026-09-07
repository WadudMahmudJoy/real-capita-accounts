import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import {
  COMPANY_MEDIA_UPLOAD_CEILING_BYTES,
  CompanyMediaService,
  type CompanyMediaUploadedFile,
} from "./company-media.service";
import { CompanyService } from "./company.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

@Controller("company")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly companyMediaService: CompanyMediaService,
  ) {}

  // Compatibility endpoint: returns the office selected by the caller's
  // session (404 semantics preserved for first-time company creation).
  @Get()
  findSelected(@Req() request: AuthenticatedRequest) {
    return this.companyService.findSelectedCompany(
      request.authSession.activeCompanyId,
    );
  }

  @Get("list")
  list(@Req() request: AuthenticatedRequest) {
    return this.companyService.listCompanies(
      request.authSession.activeCompanyId,
    );
  }

  @Post()
  create(
    @Body() dto: CreateCompanyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.companyService.create(dto, {
      id: request.authSession.id,
      activeCompanyId: request.authSession.activeCompanyId,
    });
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCompanyDto) {
    return this.companyService.update(id, dto);
  }

  @Post(":id/switch")
  switch(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.companyService.switchCompany(id, {
      id: request.authSession.id,
      activeCompanyId: request.authSession.activeCompanyId,
    });
  }

  // Media uploads are generic office branding assets; any Company may be
  // configured by any authenticated ACCOUNTANT (matching the D1 MVP
  // authorization model), including inactive offices.
  @Post(":id/media/:kind")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: COMPANY_MEDIA_UPLOAD_CEILING_BYTES },
    }),
  )
  uploadMedia(
    @Param("id") id: string,
    @Param("kind") kind: string,
    @UploadedFile() file: CompanyMediaUploadedFile,
  ) {
    if (!file) {
      throw new BadRequestException("A file is required.");
    }
    return this.companyMediaService.upload(id, kind, file);
  }

  @Delete(":id/media/:kind")
  @HttpCode(HttpStatus.OK)
  removeMedia(@Param("id") id: string, @Param("kind") kind: string) {
    return this.companyMediaService.remove(id, kind);
  }
}
