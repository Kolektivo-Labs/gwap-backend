import { Controller, Get } from '@nestjs/common';
import { DepositFetcherService } from './deposit-fetcher.service';

@Controller()
export class DepositFetcherController {
  constructor(private readonly depositListenerService: DepositFetcherService) { }

  @Get()
  async syncDeposits(): Promise<string> {
    await this.depositListenerService.syncDeposits();
    return 'Deposit sync done';
  }
}
