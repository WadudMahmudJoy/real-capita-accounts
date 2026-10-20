import {LeaveWorkflowService} from './leave-workflow.service';
import {RecommendLeaveDto,MdDecideLeaveDto} from './leave.dto';
import {CategoryInputDto,UserQueryDto} from '../users/users.dto';
import {Body,Controller,Get,Header,Param,Post,Query,UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/guards/auth.guard';
import {CurrentUser} from '../auth/decorators/current-user.decorator';
import type {AuthenticatedUser} from '../auth/auth.types';
import {LeaveQueryDto,SubmitLeaveDto,WithdrawLeaveDto,DecideLeaveDto} from './leave.dto';
import {LeaveService} from './leave.service';
@Controller('leave-requests') @UseGuards(AuthGuard)
export class LeaveController {
 constructor(private readonly service:LeaveService,private readonly workflow:LeaveWorkflowService){}
 @Get('capabilities') @Header('Cache-Control','no-store') async capabilities(@CurrentUser() user:AuthenticatedUser){return this.workflow.capabilities(user.id,await this.service.capabilities(user.id));}
 @Get() @Header('Cache-Control','no-store') list(@Query() query:LeaveQueryDto,@CurrentUser() user:AuthenticatedUser){return this.service.list(query,user.id).then(value=>this.workflow.decorate(value));}
 @Get('review-queue') @Header('Cache-Control','no-store') reviewQueue(@Query() query:LeaveQueryDto,@CurrentUser() user:AuthenticatedUser){return this.service.reviewQueue(query,user.id).then(value=>this.workflow.decorate(value));}
 @Post(':id/decision') decide(@Param('id') id:string,@Body() input:DecideLeaveDto,@CurrentUser() user:AuthenticatedUser){return this.service.decide(id,input,user.id);}
 @Get('md-queue') @Header('Cache-Control','no-store') mdQueue(@Query() q:LeaveQueryDto,@CurrentUser() u:AuthenticatedUser){return this.service.reviewQueue({...q,status:q.status??'PENDING_MD_DECISION'},u.id,true).then(v=>this.workflow.decorate(v));}
 @Post(':id/recommendation') async recommend(@Param('id') id:string,@Body() input:RecommendLeaveDto,@CurrentUser() u:AuthenticatedUser){await this.workflow.command(id,'HR',input,u.id);return this.workflow.decorate(await this.service.get(id,u.id));}
 @Post(':id/md-decision') async mdDecision(@Param('id') id:string,@Body() input:MdDecideLeaveDto,@CurrentUser() u:AuthenticatedUser){await this.workflow.command(id,'MD',input,u.id);return this.workflow.decorate(await this.service.get(id,u.id));}
 @Get(':id/history') @Header('Cache-Control','no-store') history(@Param('id') id:string,@CurrentUser() u:AuthenticatedUser){return this.service.get(id,u.id).then(v=>this.workflow.history(v));}
 @Get('employee-options') @Header('Cache-Control','no-store') employees(@Query() q:UserQueryDto,@CurrentUser() u:AuthenticatedUser){return this.service.employeeOptions(q,u.id);}
 @Get('filter-options') @Header('Cache-Control','no-store') filters(@CurrentUser() u:AuthenticatedUser){return this.service.filterOptions(u.id);}
 @Get('categories') @Header('Cache-Control','no-store') categories(@Query() q:UserQueryDto,@CurrentUser() u:AuthenticatedUser){return this.service.categories(q,u.id);}
 @Get('categories/:id/history') @Header('Cache-Control','no-store') categoryHistory(@Param('id') id:string,@Query() q:UserQueryDto,@CurrentUser() u:AuthenticatedUser){return this.service.categoryHistory(id,q,u.id);}
 @Post('categories') createCategory(@Body() input:CategoryInputDto,@CurrentUser() u:AuthenticatedUser){return this.service.category(null,input,u.id);}
 @Post('categories/:id') updateCategory(@Param('id') id:string,@Body() input:CategoryInputDto,@CurrentUser() u:AuthenticatedUser){return this.service.category(id,input,u.id);}
 @Get(':id') @Header('Cache-Control','no-store') get(@Param('id') id:string,@CurrentUser() user:AuthenticatedUser){return this.service.get(id,user.id).then(value=>this.workflow.decorate(value));}
 @Post() async submit(@Body() input:SubmitLeaveDto,@CurrentUser() user:AuthenticatedUser){await this.workflow.requireInstalled();return this.service.submit(input,user.id).then(value=>this.workflow.decorate(value));}
 @Post(':id/withdraw') withdraw(@Param('id') id:string,@Body() input:WithdrawLeaveDto,@CurrentUser() user:AuthenticatedUser){return this.service.withdraw(id,input.expectedVersion,user.id).then(value=>this.workflow.decorate(value));}
}
