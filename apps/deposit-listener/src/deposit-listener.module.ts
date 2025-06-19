import { Module } from '@nestjs/common';
import { DepositConfirmationService } from './deposit-confirmation/deposit-confirmation.service';
import { DepositSenderService } from './deposit-sender/deposit-sender.service';
import { DepositFetcherService } from './deposit-fetcher/deposit-fetcher.service';
import { DatabaseService } from './common/database.service';

@Module({
  providers: [
    DatabaseService,
    DepositFetcherService,
    DepositConfirmationService,
    DepositSenderService,
  ],
  exports: [
    DatabaseService,
    DepositConfirmationService,
    DepositSenderService,
  ],
})
export class DepositListenerModule { }
