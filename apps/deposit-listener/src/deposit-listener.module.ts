import { Module } from '@nestjs/common';
import { DepositConfirmationService } from './deposit-confirmation/deposit-confirmation.service';
import { DepositSenderService } from './deposit-sender/deposit-sender.service';
import { DepositFetcherService } from './deposit-fetcher/deposit-fetcher.service';
import { DatabaseService } from '../../api/src/common/database.service';
import { HttpModule } from '@nestjs/axios';
import { DepositListenerController } from './deposit-fetcher.controller';
import { TokenSweeperService } from './token-sweep/token-sweep.service';

@Module({
  imports: [
    HttpModule,
  ],
  controllers: [DepositListenerController],
  providers: [
    DatabaseService,
    DepositFetcherService,
    DepositConfirmationService,
    DepositSenderService,
    TokenSweeperService,
  ],
  exports: [
    DatabaseService,
    DepositConfirmationService,
    DepositSenderService,
  ],
})
export class DepositListenerModule { }
