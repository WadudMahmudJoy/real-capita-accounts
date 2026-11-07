import {AuthorityModule} from '../authority/authority.module';
import {LeaveWorkflowService} from './leave-workflow.service';
import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module';
import {PrismaModule} from '../prisma/prisma.module';
import {LeaveController} from './leave.controller';
import {LeaveService} from './leave.service';
import {LeaveAuthority} from './leave-authority';
@Module({imports:[AuthModule,PrismaModule,AuthorityModule],controllers:[LeaveController],providers:[LeaveService,LeaveAuthority,LeaveWorkflowService]})
export class LeaveModule {}
