import { Controller, Get } from '@nestjs/common';
import { DepositFetcherService } from './deposit-fetcher/deposit-fetcher.service';
import { DepositConfirmationService } from './deposit-confirmation/deposit-confirmation.service';
import { DepositSenderService } from './deposit-sender/deposit-sender.service';

@Controller()
export class DepositListenerController {
  constructor(private readonly depositListenerService: DepositFetcherService,
    private readonly depositConfirmationService: DepositConfirmationService,
    private readonly depositSenderService: DepositSenderService
  ) { }

  @Get('fetch')
  async fetch(): Promise<string> {
    await this.depositListenerService.syncDeposits();
    return 'Deposit sync done';
  }

  @Get('confirm')
  async confirm(): Promise<string> {
    await this.depositConfirmationService.confirmDeposits();
    return 'Deposit confirm done';
  }

  @Get('send')
  async syncDeposits(): Promise<string> {
    await this.depositSenderService.sendConfirmedDeposits();
    return 'Deposit send done';
  }
}
