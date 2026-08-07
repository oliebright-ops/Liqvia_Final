import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CashOsLeadsController } from './cash-os-leads.controller';
import { CashOsLeadsService } from './cash-os-leads.service';

@Module({
  imports: [PrismaModule],
  controllers: [CashOsLeadsController],
  providers: [CashOsLeadsService],
})
export class CashOsLeadsModule {}
