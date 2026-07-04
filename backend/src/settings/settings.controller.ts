import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import {
  chartOfAccountSchema,
  inviteTeamMemberSchema,
  updateChartOfAccountSchema,
  updateCompanySchema,
  updateDashboardWidgetsSchema,
  updateHorizonSchema,
  updateMemberRoleSchema,
  updateProfileSchema,
} from './dto/settings.dto';
import { SettingsService } from './settings.service';

function parseBody<T>(schema: { parse: (v: unknown) => T }, body: unknown): T {
  return schema.parse(body);
}

@ApiTags('Settings')
@Controller('settings')
@UseGuards(WorkspaceGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('company')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Get company profile' })
  getCompany(@CurrentUser() user: AuthUser) {
    return this.settings.getCompany(user.companyId!);
  }

  @Patch('company')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Update company profile' })
  updateCompany(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.settings.updateCompany(user, parseBody(updateCompanySchema, body));
  }

  @Patch('horizon')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Update forecast horizon weeks (company workspace preference)' })
  updateHorizon(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseBody(updateHorizonSchema, body);
    return this.settings.updateForecastHorizon(user, dto.forecastHorizonWeeks);
  }

  @Patch('profile')
  @Permissions('settings:profile')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.settings.updateProfile(user.id, parseBody(updateProfileSchema, body));
  }

  @Get('dashboard-widgets')
  @Permissions('settings:profile')
  @ApiOperation({ summary: 'Get the current user\'s dashboard widget visibility preferences' })
  getDashboardWidgets(@CurrentUser() user: AuthUser) {
    return this.settings.getDashboardWidgets(user.id);
  }

  @Patch('dashboard-widgets')
  @Permissions('settings:profile')
  @ApiOperation({ summary: 'Update the current user\'s dashboard widget visibility preferences' })
  updateDashboardWidgets(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.settings.updateDashboardWidgets(
      user.id,
      parseBody(updateDashboardWidgetsSchema, body),
    );
  }

  @Get('team')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'List team members via UserCompanyLink' })
  listTeam(@CurrentUser() user: AuthUser) {
    return this.settings.listTeam(user.companyId!);
  }

  @Post('team/invite')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Invite a team member' })
  invite(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.settings.inviteMember(user, parseBody(inviteTeamMemberSchema, body));
  }

  @Patch('team/:linkId/role')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Update a team member role for the active entity' })
  updateRole(
    @CurrentUser() user: AuthUser,
    @Param('linkId') linkId: string,
    @Body() body: unknown,
  ) {
    const dto = parseBody(updateMemberRoleSchema, body);
    return this.settings.updateMemberRole(user, linkId, dto.role);
  }

  @Delete('team/:linkId')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Remove a team member' })
  remove(@CurrentUser() user: AuthUser, @Param('linkId') linkId: string) {
    return this.settings.removeMember(user, linkId);
  }

  @Get('chart-of-accounts')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'List chart of accounts' })
  listCoa(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('type') type?: AccountType,
  ) {
    return this.settings.listChartOfAccounts(user.companyId!, search, type);
  }

  @Post('chart-of-accounts')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Create chart of accounts entry' })
  createCoa(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.settings.createChartOfAccount(user, parseBody(chartOfAccountSchema, body));
  }

  @Patch('chart-of-accounts/:id')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Update chart of accounts entry' })
  updateCoa(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.settings.updateChartOfAccount(
      user,
      id,
      parseBody(updateChartOfAccountSchema, body),
    );
  }

  @Delete('chart-of-accounts/:id')
  @Permissions('settings:admin')
  @ApiOperation({ summary: 'Archive chart of accounts entry' })
  archiveCoa(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.settings.archiveChartOfAccount(user, id);
  }
}
