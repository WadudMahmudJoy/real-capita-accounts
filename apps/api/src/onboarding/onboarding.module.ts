import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module';
import {PrismaModule} from '../prisma/prisma.module';
import {OnboardingController} from './onboarding.controller';
import {OnboardingService} from './onboarding.service';
import {OnboardingGateway} from './onboarding.gateway';
import {OnboardingRateLimit} from './onboarding.dto';
@Module({imports:[AuthModule,PrismaModule],controllers:[OnboardingController],providers:[OnboardingService,OnboardingGateway,OnboardingRateLimit]})
export class OnboardingModule{}
