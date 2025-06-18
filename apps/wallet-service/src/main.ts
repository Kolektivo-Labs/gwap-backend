import { NestFactory, Reflector } from '@nestjs/core';
import { WalletServiceModule } from './wallet-service.module';

async function bootstrap() {
  const app = await NestFactory.create(WalletServiceModule);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new ApiKeyGuard(reflector));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();


import 'dotenv/config'
import { ApiKeyGuard } from './common/api-key-guard';

function env(name: string): string | undefined {
  const v = process.env[name]
  if (!v) console.error(`Missing env: ${name}`)
  return v
}

export const CFG = {
  rpc: env('RPC_URL'),
  pk: env('RELAYER_PK'),
  mainSafe: env('MAIN_SAFE'),
  chainId: 10  // Optimism
}