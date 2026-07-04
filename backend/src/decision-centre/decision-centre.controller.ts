import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { decisionCentreRequestSchema } from '../dto/decision-centre.dto';
import { DecisionCentreService } from './decision-centre.service';

@ApiTags('Decision Centre')
@Controller('decision-centre')
@UseGuards(WorkspaceGuard)
export class DecisionCentreController {
  constructor(private readonly decisionCentre: DecisionCentreService) {}

  @Post()
  @Permissions('ai:use')
  @ApiOperation({ summary: '"Can I...?" business question, answered against the scenario/forecast engine' })
  evaluate(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = decisionCentreRequestSchema.parse(body);
    return this.decisionCentre.evaluate(user.companyId!, dto);
  }
}
