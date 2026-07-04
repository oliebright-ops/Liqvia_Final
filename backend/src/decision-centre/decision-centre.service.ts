import { Injectable } from '@nestjs/common';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { AiService, DecisionScenarioSummary } from '../ai/ai.service';
import { ScenarioService } from '../scenarios/scenario.service';
import { DecisionCentreRequestDto } from '../dto/decision-centre.dto';
import { decisionQuestionText, toScenarioVariables } from './decision-mapping';

export interface DecisionCentreResponse {
  question: string;
  scenario: DecisionScenarioSummary | null;
  text: string;
  model: string;
  source: 'openai' | 'rule_based';
}

@Injectable()
export class DecisionCentreService {
  constructor(
    private readonly scenarios: ScenarioService,
    private readonly aiService: AiService,
  ) {}

  async evaluate(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    dto: DecisionCentreRequestDto,
  ): Promise<DecisionCentreResponse> {
    let question: string;
    let scenario: DecisionScenarioSummary | null = null;

    if (dto.type === 'custom') {
      question = dto.customQuestion!.trim();
    } else {
      question = decisionQuestionText(dto.type, dto.amount, dto.percent);
      const variables = toScenarioVariables(dto.type, dto.amount, dto.percent)!;
      const comparison = await this.scenarios.previewScenario(companyId, variables);
      scenario = {
        baseline: {
          week13ClosingCash: comparison.baseline.week13ClosingCash,
          runwayWeeks: comparison.baseline.runwayWeeks,
        },
        scenario: {
          week13ClosingCash: comparison.scenario.week13ClosingCash,
          runwayWeeks: comparison.scenario.runwayWeeks,
        },
        delta: comparison.delta,
      };
    }

    const result = await this.aiService.generateDecision(companyId, question, scenario, dto.locale);

    return { question, scenario, ...result };
  }
}
