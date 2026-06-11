import { createNestApplication } from './nest-app';

async function bootstrap() {
  const app = await createNestApplication({ embedded: false });
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

bootstrap();
