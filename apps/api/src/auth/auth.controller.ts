import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ACCOUNTANT_ROLE } from "./auth.constants";
import { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./auth.types";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Roles } from "./decorators/roles.decorator";
import { LoginDto } from "./dto/login.dto";
import { AuthGuard } from "./guards/auth.guard";
import { RolesGuard } from "./guards/roles.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      loginDto.email,
      loginDto.password,
      request,
    );

    response.cookie(result.cookieName, result.token, result.cookieOptions);

    return {
      message: "Login successful.",
      status: "ok" as const,
      user: result.user,
    };
  }

  @Get("me")
  @Roles(ACCOUNTANT_ROLE)
  @UseGuards(AuthGuard, RolesGuard)
  getMe(@CurrentUser() user: AuthenticatedRequest["user"]) {
    return {
      status: "ok" as const,
      user,
    };
  }

  @Get("session")
  @Roles(ACCOUNTANT_ROLE)
  @UseGuards(AuthGuard, RolesGuard)
  getSession(@Req() request: AuthenticatedRequest) {
    return this.authService.buildSessionResponse(
      request.user,
      request.authSession.expiresAt,
    );
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @Roles(ACCOUNTANT_ROLE)
  @UseGuards(AuthGuard, RolesGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie(
      this.authService.getCookieName(),
      this.authService.buildClearCookieOptions(),
    );

    return this.authService.logout(
      request.user,
      request.authSession.id,
      request,
    );
  }
}
