import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { LedgerService } from './ledger.service';

@ApiTags('Ledger')
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  @UseGuards(WorkspaceGuard)
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'AR/AP ledger entries with aging summaries' })
  get(@CurrentUser() user: AuthUser) {
    return this.ledger.getLedger(user.companyId!);
  }
}
