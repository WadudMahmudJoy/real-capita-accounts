import {Body,Controller,Get,Header,Post,Req,SetMetadata,UseGuards} from '@nestjs/common';
import type {Request} from 'express';
import {AuthGuard} from '../auth/guards/auth.guard';
import type {AuthenticatedRequest} from '../auth/auth.types';
import {READ_ONLY_AUTH_CONTEXT_METADATA_KEY} from '../auth/auth.constants';
import {OnboardingService} from './onboarding.service';
import {OnboardingGateway} from './onboarding.gateway';
import {assertSameOrigin,OnboardingRateLimit,validateClaim} from './onboarding.dto';

@Controller('onboarding')
@SetMetadata(READ_ONLY_AUTH_CONTEXT_METADATA_KEY,true)
export class OnboardingController{
 constructor(private readonly service:OnboardingService,private readonly gateway:OnboardingGateway,private readonly limiter:OnboardingRateLimit){}
 @Get('status') @Header('Cache-Control','no-store') @UseGuards(AuthGuard) status(@Req() request:AuthenticatedRequest){return this.service.status(request.user.id);}
 @Post('prepare') @Header('Cache-Control','no-store') @UseGuards(AuthGuard) prepare(@Req() request:AuthenticatedRequest,@Body() input:unknown){assertSameOrigin(request.get('origin'));this.limiter.consume(`actor:${request.user.id}`);return this.service.prepare(request,input);}
 @Post('commands') @Header('Cache-Control','no-store') @UseGuards(AuthGuard) execute(@Req() request:AuthenticatedRequest,@Body() input:unknown){assertSameOrigin(request.get('origin'));this.limiter.consume(`actor:${request.user.id}`);return this.service.execute(request,input);}
 @Post('claim') @Header('Cache-Control','no-store') claim(@Req() request:Request,@Body() input:unknown){assertSameOrigin(request.get('origin'));this.limiter.consume(`claim:${request.socket.remoteAddress??'unknown'}`);return this.gateway.claim(validateClaim(input));}
}
