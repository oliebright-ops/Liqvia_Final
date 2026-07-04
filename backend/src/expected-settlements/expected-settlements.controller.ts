import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import {
  createExpectedSettlementSchema,
  updateExpectedSettlementSchema,
} from '../dto/expected-settlement.dto';
import { ExpectedSettlementsService } from './expected-settlements.service';

function parseBody<T>(schema: { parse: (v: unknown) => T }, body: unknown): T {
  return schema.parse(body);
}

function addMonthsIso(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

@ApiTags('Expected Settlements')
@Controller('expected-settlements')
@UseGuards(WorkspaceGuard)
export class ExpectedSettlementsController {
  constructor(private readonly settlements: ExpectedSettlementsService) {}

  @Get()
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'List expected funding/settlement inflows for the current company' })
  list(@CurrentUser() user: AuthUser) {
    return this.settlements.list(user.companyId!);
  }

  @Get('upcoming')
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'Project upcoming settlement occurrences within a horizon' })
  upcoming(@CurrentUser() user: AuthUser, @Query('horizonMonths') horizonMonths?: string) {
    const asOfDate = new Date().toISOString().slice(0, 10);
    const months = horizonMonths ? Number(horizonMonths) : 3;
    const horizonEndDate = addMonthsIso(asOfDate, Number.isFinite(months) ? months : 3);
    return this.settlements.upcoming(user.companyId!, asOfDate, horizonEndDate);
  }

  @Post()
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Create an expected settlement' })
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseBody(createExpectedSettlementSchema, body);
    return this.settlements.create(user.companyId!, dto);
  }

  @Patch(':id')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Update an expected settlement' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = parseBody(updateExpectedSettlementSchema, body);
    return this.settlements.update(user.companyId!, id, dto);
  }

  @Delete(':id')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Delete an expected settlement' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.settlements.remove(user.companyId!, id);
  }
}
