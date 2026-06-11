import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { aiChatSchema, aiInsightSchema } from '../dto/ai.dto';
import { AiService } from './ai.service';

@ApiTags('AI CFO')
@Controller('ai')
@UseGuards(WorkspaceGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('insight')
  @ApiOperation({
    summary: 'Generate executive treasury briefing (OpenAI or rule-based fallback)',
  })
  insight(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = aiInsightSchema.parse(body);
    return this.ai.generateInsight(dto.companyId ?? user.companyId!, dto.question);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Conversational AI CFO with message history (max 10)' })
  chat(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = aiChatSchema.parse(body);
    return this.ai.chat(dto.companyId ?? user.companyId!, dto);
  }
}
