import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConsentModule } from '../consent/consent.module';
import { CashOsLeadsController } from './cash-os-leads.controller';
import { CashOsLeadsService } from './cash-os-leads.service';

@Module({
  imports: [PrismaModule, ConsentModule],
  controllers: [CashOsLeadsController],
  providers: [CashOsLeadsService],
})
export class CashOsLeadsModule {}
