import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LeadRetentionService } from './lead-retention.service';

@Module({
  imports: [PrismaModule],
  providers: [LeadRetentionService],
  exports: [LeadRetentionService],
})
export class RetentionModule {}
