import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { updateBankAccountPurposeSchema } from '../dto/bank-account.dto';
import { BankAccountsService } from './bank-accounts.service';

function parseBody<T>(schema: { parse: (v: unknown) => T }, body: unknown): T {
  return schema.parse(body);
}

@ApiTags('Bank Accounts')
@Controller('bank-accounts')
@UseGuards(WorkspaceGuard)
export class BankAccountsController {
  constructor(private readonly bankAccounts: BankAccountsService) {}

  @Get()
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'List active bank accounts for the current company' })
  list(@CurrentUser() user: AuthUser) {
    return this.bankAccounts.listForCompany(user.companyId!);
  }

  @Patch(':bankAccountId')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Assign what a bank account is used for (operating, payroll reserve, etc.)' })
  updatePurpose(
    @CurrentUser() user: AuthUser,
    @Param('bankAccountId') bankAccountId: string,
    @Body() body: unknown,
  ) {
    const dto = parseBody(updateBankAccountPurposeSchema, body);
    return this.bankAccounts.updateAccountPurpose(user.companyId!, bankAccountId, dto.accountPurpose);
  }

  @Get(':bankAccountId/transactions')
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'Opening balance, transactions, and closing balance for an account' })
  transactions(
    @CurrentUser() user: AuthUser,
    @Param('bankAccountId') bankAccountId: string,
    @Query('asOf') asOf?: string,
    @Query('limit') limit?: string,
  ) {
    const asOfDate = asOf ?? new Date().toISOString().slice(0, 10);
    return this.bankAccounts.getAccountLedger(
      user.companyId!,
      bankAccountId,
      asOfDate,
      limit ? Number(limit) : 50,
    );
  }
}
