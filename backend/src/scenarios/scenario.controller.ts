import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { CreateScenarioDto } from '../dto/scenario.dto';
import { ScenarioService } from './scenario.service';

@ApiTags('Scenarios')
@Controller('scenarios')
@UseGuards(WorkspaceGuard)
export class ScenarioController {
  constructor(private readonly scenarios: ScenarioService) {}

  @Get()
  @Permissions('scenarios:read')
  @ApiOperation({ summary: 'List saved scenarios for the active company' })
  list(@CurrentUser() user: AuthUser) {
    return this.scenarios.listScenarios(user.companyId!);
  }

  @Get(':companyId')
  @Permissions('scenarios:read')
  @ApiOperation({ summary: 'List saved scenarios for a company' })
  @ApiParam({ name: 'companyId', example: 'demo-consulting' })
  listByCompany(@Param('companyId') companyId: string) {
    return this.scenarios.listScenarios(companyId);
  }

  @Post()
  @Permissions('scenarios:write')
  @ApiOperation({ summary: 'Create a scenario and run baseline vs stressed forecast comparison' })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateScenarioDto) {
    return this.scenarios.createScenario(user.companyId!, body.name, body.variables);
  }

  @Post(':scenarioId/recalculate')
  @Permissions('scenarios:write')
  @ApiOperation({ summary: 'Recalculate an existing scenario comparison' })
  @ApiParam({ name: 'scenarioId', description: 'Scenario cuid from create response' })
  recalculate(@Param('scenarioId') scenarioId: string) {
    return this.scenarios.recalculateScenario(scenarioId);
  }
}
