import { Module } from '@nestjs/common';
import { WalletServiceController } from './wallet-service.controller';
import { WalletService } from './wallet-service.service';
import { MetricsService } from './metrics.service';
import { DatabaseService } from 'apps/api/src/common/database.service';

@Module({
  imports: [],
  controllers: [WalletServiceController],
  providers: [WalletService, MetricsService,DatabaseService],
  exports: [DatabaseService]
})
export class WalletServiceModule { }
