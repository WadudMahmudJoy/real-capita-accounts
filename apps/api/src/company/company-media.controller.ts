import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Res,
  StreamableFile,
} from "@nestjs/common";
import type { Response } from "express";
import { CompanyMediaService } from "./company-media.service";

// Public read-only delivery of the three non-sensitive Company branding
// assets. This controller intentionally carries no auth guards: callers may
// only request a company id plus one of the closed media kinds — never an
// arbitrary filesystem path. Company metadata is never exposed here.
@Controller("company-media")
export class CompanyMediaController {
  constructor(private readonly companyMediaService: CompanyMediaService) {}

  @Get(":id/:kind")
  @Header("Cache-Control", "public, max-age=300")
  @Header("Content-Disposition", "inline")
  @Header("X-Content-Type-Options", "nosniff")
  async readMedia(
    @Param("id") id: string,
    @Param("kind") kind: string,
    @Res({ passthrough: true }) reply: Response,
  ): Promise<StreamableFile> {
    const media = await this.companyMediaService.readMedia(id, kind);

    if (media === null) {
      throw new NotFoundException("Company media was not found.");
    }

    reply.setHeader("Content-Type", media.contentType);
    return new StreamableFile(media.stream);
  }
}
