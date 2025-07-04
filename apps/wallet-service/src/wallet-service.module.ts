import { Module } from '@nestjs/common';
import { WalletServiceController } from './wallet-service.controller';
import { WalletService } from './wallet-service.service';
import { MetricsService } from './metrics.service';

@Module({
  imports: [],
  controllers: [WalletServiceController],
  providers: [WalletService, MetricsService],
})
export class WalletServiceModule { }
