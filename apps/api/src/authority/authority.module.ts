import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module';
import {PrismaModule} from '../prisma/prisma.module';
import {AuthorityController} from './authority.controller';
import {AuthorityService} from './authority.service';
import {AuthorityWriter,MdClaimVerifier} from './authority-writer';
@Module({imports:[AuthModule,PrismaModule],exports:[AuthorityWriter],controllers:[AuthorityController],providers:[AuthorityService,AuthorityWriter,MdClaimVerifier]})
export class AuthorityModule {}
