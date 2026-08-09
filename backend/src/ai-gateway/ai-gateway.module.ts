import { Module } from '@nestjs/common';
import { AiPrivacyGatewayService } from './ai-privacy-gateway.service';
import { OpenAiProvider } from './providers/openai.provider';

/**
 * The AI gateway module. `OpenAiProvider` is deliberately **not** exported: the only
 * way for the rest of the application to reach a model is through
 * `AiPrivacyGatewayService`, which validates first.
 */
@Module({
  providers: [OpenAiProvider, AiPrivacyGatewayService],
  exports: [AiPrivacyGatewayService],
})
export class AiGatewayModule {}
