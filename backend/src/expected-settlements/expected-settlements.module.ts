import { Module } from '@nestjs/common';
import { ExpectedSettlementsController } from './expected-settlements.controller';
import { ExpectedSettlementsService } from './expected-settlements.service';

@Module({
  controllers: [ExpectedSettlementsController],
  providers: [ExpectedSettlementsService],
  exports: [ExpectedSettlementsService],
})
export class ExpectedSettlementsModule {}
