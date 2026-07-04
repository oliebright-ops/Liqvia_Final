import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'API health check' })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', service: 'liqvia2-api', aiCfo: 'live' },
    },
  })
  check() {
    return {
      status: 'ok',
      service: 'liqvia2-api',
      // OPENAI_API_KEY is `sync: false` in render.yaml, so it must be set manually in the
      // Render dashboard — if it's unset/expired/invalid, AI CFO silently falls back to
      // rule-based templates for every company with no other operator-visible signal.
      aiCfo: process.env.OPENAI_API_KEY ? 'live' : 'fallback_no_api_key',
    };
  }
}
