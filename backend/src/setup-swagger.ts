import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Liqvia Treasury API')
    .setDescription(
      'SME treasury platform: CSV uploads, 13-week cash forecast, KPIs, liquidity alerts, budget vs actual, scenario modelling, and AI CFO insights.',
    )
    .setVersion('0.1.0')
    .addServer('http://localhost:3001', 'Local development')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/json',
    useGlobalPrefix: true,
  });
}
