import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'API health check' })
  @ApiOkResponse({
    schema: { example: { status: 'ok', service: 'liqvia2-api' } },
  })
  check() {
    return { status: 'ok', service: 'liqvia2-api' };
  }
}
