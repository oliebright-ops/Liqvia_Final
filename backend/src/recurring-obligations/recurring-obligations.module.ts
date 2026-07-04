import { Module } from '@nestjs/common';
import { RecurringObligationsController } from './recurring-obligations.controller';
import { RecurringObligationsService } from './recurring-obligations.service';

@Module({
  controllers: [RecurringObligationsController],
  providers: [RecurringObligationsService],
  exports: [RecurringObligationsService],
})
export class RecurringObligationsModule {}
