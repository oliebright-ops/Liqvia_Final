import { Module } from '@nestjs/common';
import { RecurringObligationsModule } from '../recurring-obligations/recurring-obligations.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [RecurringObligationsModule, TreasuryModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
