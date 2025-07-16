import { NestFactory, Reflector } from '@nestjs/core';
import { WalletServiceModule } from './wallet-service.module';
import { ApiKeyGuard } from './common/api-key-guard';


async function bootstrap() {
  const app = await NestFactory.create(WalletServiceModule);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new ApiKeyGuard(reflector));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

