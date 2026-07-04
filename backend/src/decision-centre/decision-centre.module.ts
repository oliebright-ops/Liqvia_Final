import { Module } from '@nestjs/common';
import { ScenarioModule } from '../scenarios/scenario.module';
import { AiModule } from '../ai/ai.module';
import { DecisionCentreController } from './decision-centre.controller';
import { DecisionCentreService } from './decision-centre.service';

@Module({
  imports: [ScenarioModule, AiModule],
  controllers: [DecisionCentreController],
  providers: [DecisionCentreService],
})
export class DecisionCentreModule {}
