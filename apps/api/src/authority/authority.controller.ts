import {Body,Controller,Get,Header,Param,Post,Query,UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/guards/auth.guard';
import {CurrentUser} from '../auth/decorators/current-user.decorator';
import type {AuthenticatedUser} from '../auth/auth.types';
import {AuthorityService} from './authority.service';
import {AuthorityDecisionDto,AuthorityQueryDto,AuthorityRequestDto,MdClaimDto} from './authority.dto';
@Controller('authority') @UseGuards(AuthGuard)
export class AuthorityController {
 constructor(private readonly service:AuthorityService){}
 @Header('Cache-Control','no-store') @Get('access') access(@CurrentUser() u:AuthenticatedUser){return this.service.access(u.id);}
 @Header('Cache-Control','no-store') @Get('roles') roles(@Query() q:AuthorityQueryDto,@CurrentUser() u:AuthenticatedUser){return this.service.roles(q,u.id);}
 @Header('Cache-Control','no-store') @Get('grants') grants(@Query() q:AuthorityQueryDto,@CurrentUser() u:AuthenticatedUser){return this.service.grants(q,u.id);}
 @Header('Cache-Control','no-store') @Get('requests') requests(@Query() q:AuthorityQueryDto,@CurrentUser() u:AuthenticatedUser){return this.service.requests(q,u.id);}
 @Header('Cache-Control','no-store') @Get('history/:id') history(@Param('id') id:string,@Query() q:AuthorityQueryDto,@CurrentUser() u:AuthenticatedUser){return this.service.history(id,q,u.id);}
 @Header('Cache-Control','no-store') @Post('requests') request(@Body() input:AuthorityRequestDto,@CurrentUser() u:AuthenticatedUser){return this.service.request(input,u.id);}
 @Header('Cache-Control','no-store') @Post('requests/:id/decision') decide(@Param('id') id:string,@Body() input:AuthorityDecisionDto,@CurrentUser() u:AuthenticatedUser){return this.service.decide(id,input,u.id);}
 @Header('Cache-Control','no-store') @Post('md-claim') claim(@Body() input:MdClaimDto,@CurrentUser() u:AuthenticatedUser){return this.service.claim(input.claimReference,u.id);}
}
