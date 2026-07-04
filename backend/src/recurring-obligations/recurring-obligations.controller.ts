import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import {
  createRecurringObligationSchema,
  updateRecurringObligationSchema,
} from '../dto/recurring-obligation.dto';
import { RecurringObligationsService } from './recurring-obligations.service';

function parseBody<T>(schema: { parse: (v: unknown) => T }, body: unknown): T {
  return schema.parse(body);
}

function addMonthsIso(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

@ApiTags('Recurring Obligations')
@Controller('recurring-obligations')
@UseGuards(WorkspaceGuard)
export class RecurringObligationsController {
  constructor(private readonly obligations: RecurringObligationsService) {}

  @Get()
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'List recurring/fixed obligations for the current company' })
  list(@CurrentUser() user: AuthUser) {
    return this.obligations.list(user.companyId!);
  }

  @Get('upcoming')
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'Project upcoming obligation occurrences within a horizon' })
  upcoming(@CurrentUser() user: AuthUser, @Query('horizonMonths') horizonMonths?: string) {
    const asOfDate = new Date().toISOString().slice(0, 10);
    const months = horizonMonths ? Number(horizonMonths) : 3;
    const horizonEndDate = addMonthsIso(asOfDate, Number.isFinite(months) ? months : 3);
    return this.obligations.upcoming(user.companyId!, asOfDate, horizonEndDate);
  }

  @Post()
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Create a recurring obligation' })
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseBody(createRecurringObligationSchema, body);
    return this.obligations.create(user.companyId!, dto);
  }

  @Patch(':id')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Update a recurring obligation' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = parseBody(updateRecurringObligationSchema, body);
    return this.obligations.update(user.companyId!, id, dto);
  }

  @Delete(':id')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Delete a recurring obligation' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.obligations.remove(user.companyId!, id);
  }
}
