import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateScenarioDto } from '../dto/scenario.dto';
import { ScenarioService } from './scenario.service';

@ApiTags('Scenarios')
@Controller('scenarios')
export class ScenarioController {
  constructor(private readonly scenarios: ScenarioService) {}

  @Get(':companyId')
  @ApiOperation({ summary: 'List saved scenarios for a company' })
  @ApiParam({ name: 'companyId', example: 'demo-consulting' })
  list(@Param('companyId') companyId: string) {
    return this.scenarios.listScenarios(companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a scenario and run baseline vs stressed forecast comparison' })
  create(@Body() body: CreateScenarioDto) {
    return this.scenarios.createScenario(body.companyId, body.name, body.variables);
  }

  @Post(':scenarioId/recalculate')
  @ApiOperation({ summary: 'Recalculate an existing scenario comparison' })
  @ApiParam({ name: 'scenarioId', description: 'Scenario cuid from create response' })
  recalculate(@Param('scenarioId') scenarioId: string) {
    return this.scenarios.recalculateScenario(scenarioId);
  }
}
