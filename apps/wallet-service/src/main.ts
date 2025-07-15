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

export function env(name: string): string | undefined {  
  const v = process.env[name]
  if (!v) console.error(`Missing env: ${name}`)
  return v
}

export const CFG = {
  rpc_celo: env('RPC_URL_CELO'),
  rpc_op: env('RPC_URL_OP'),
  rpc_arbitrum: env('RPC_URL_ARBITRUM'),
  pk: env('RELAYER_PK'),
  mainSafe: env('MAIN_SAFE'),
}