import { Module } from '@nestjs/common';
import { FreeCashController } from './free-cash.controller';
import { FreeCashService } from './free-cash.service';

@Module({
  controllers: [FreeCashController],
  providers: [FreeCashService],
  exports: [FreeCashService],
})
export class FreeCashModule {}
