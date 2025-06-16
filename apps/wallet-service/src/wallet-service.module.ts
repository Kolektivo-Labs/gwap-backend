import { Module } from '@nestjs/common';
import { WalletServiceController } from './wallet-service.controller';
import { WalletService } from './wallet-service.service';

@Module({
  imports: [],
  controllers: [WalletServiceController],
  providers: [WalletService],
})
export class WalletServiceModule {}
