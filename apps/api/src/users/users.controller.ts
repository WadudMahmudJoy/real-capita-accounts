import {Body,Controller,Get,Header,Param,Post,Query,UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/guards/auth.guard';
import {CurrentUser} from '../auth/decorators/current-user.decorator';
import type {AuthenticatedUser} from '../auth/auth.types';
import {UsersService} from './users.service';
import {CreateUserDto,PendingUserDto,UserActionDto,UserQueryDto} from './users.dto';
@Controller('users') @UseGuards(AuthGuard)
export class UsersController {
 constructor(private readonly service:UsersService){}
 @Get('access') @Header('Cache-Control','no-store') access(@CurrentUser() u:AuthenticatedUser){return this.service.access(u.id);}
 @Get('employee-options') @Header('Cache-Control','no-store') employees(@Query() q:UserQueryDto,@CurrentUser() u:AuthenticatedUser){return this.service.employees(q,u.id);}
 @Get() @Header('Cache-Control','no-store') list(@Query() q:UserQueryDto,@CurrentUser() u:AuthenticatedUser){return this.service.list(q,u.id);}
 @Get(':id/history') @Header('Cache-Control','no-store') history(@Param('id') id:string,@Query() q:UserQueryDto,@CurrentUser() u:AuthenticatedUser){return this.service.history(id,q,u.id);}
 @Get(':id') @Header('Cache-Control','no-store') get(@Param('id') id:string,@CurrentUser() u:AuthenticatedUser){return this.service.get(id,u.id);}
 @Post() create(@Body() input:CreateUserDto,@CurrentUser() u:AuthenticatedUser){return this.service.create(input,u.id);}
 @Post('pending') pending(@Body() input:PendingUserDto,@CurrentUser() u:AuthenticatedUser){return this.service.createPending(input,u.id);}
 @Post(':id/actions') action(@Param('id') id:string,@Body() input:UserActionDto,@CurrentUser() u:AuthenticatedUser){return this.service.action(id,input,u.id);}
}
