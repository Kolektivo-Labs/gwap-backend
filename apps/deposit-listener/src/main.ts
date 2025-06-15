import { NestFactory } from '@nestjs/core';
import { DepositListenerModule } from './deposit-listener.module';

async function bootstrap() {
  const app = await NestFactory.create(DepositListenerModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
