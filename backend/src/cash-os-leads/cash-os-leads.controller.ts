import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators';
import { CashOsLeadsService } from './cash-os-leads.service';
import { CreateCashOsLeadDto } from './dto/create-cash-os-lead.dto';

@ApiTags('Cash Operating System landing page')
@Controller('cash-os-leads')
export class CashOsLeadsController {
  constructor(private readonly leads: CashOsLeadsService) {}

  @Public()
  @Throttle({ leads: { limit: 5, ttl: 60_000 } })
  @Post()
  @ApiOperation({ summary: 'Submit a consultation/pilot-programme request from the Cash Operating System landing page' })
  create(@Body() body: CreateCashOsLeadDto) {
    return this.leads.create(body);
  }
}
