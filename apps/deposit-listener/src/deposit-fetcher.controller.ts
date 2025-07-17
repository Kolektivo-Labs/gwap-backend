import { Controller, Get } from '@nestjs/common';
import { DepositFetcherService } from './deposit-fetcher/deposit-fetcher.service';
import { DepositConfirmationService } from './deposit-confirmation/deposit-confirmation.service';
import { DepositSenderService } from './deposit-sender/deposit-sender.service';
import { TokenSweeperService } from './token-sweep/token-sweep.service';

@Controller()
export class DepositListenerController {
  constructor(
    private readonly depositListenerService: DepositFetcherService,
    private readonly depositConfirmationService: DepositConfirmationService,
    private readonly depositSenderService: DepositSenderService,
    private readonly tokenSweeperService: TokenSweeperService
  ) { }

  @Get()
  async listen(): Promise<{ message: string }> {
    try {
      await this.depositListenerService.syncDeposits();
      await this.depositConfirmationService.confirmDeposits();
      await this.depositSenderService.sendConfirmedDeposits();
      return { message: '✅ All steps completed successfully' };
    } catch (error: any) {
      return { message: `❌ Error during listen: ${error.message}` };
    }
  }

  @Get('fetch')
  async fetch(): Promise<{ message: string }> {
    try {
      await this.depositListenerService.syncDeposits();
      return { message: '✅ Deposit sync completed successfully' };
    } catch (error: any) {
      return { message: `❌ Error during fetch: ${error.message}` };
    }
  }

  @Get('confirm')
  async confirm(): Promise<{ message: string }> {
    try {
      await this.depositConfirmationService.confirmDeposits();
      return { message: '✅ Deposit confirmation completed successfully' };
    } catch (error: any) {
      return { message: `❌ Error during confirmation: ${error.message}` };
    }
  }

  @Get('send')
  async syncDeposits(): Promise<{ message: string }> {
    try {
      await this.depositSenderService.sendConfirmedDeposits();
      return { message: '✅ Deposit sending completed successfully' };
    } catch (error: any) {
      return { message: `❌ Error during sending: ${error.message}` };
    }
  }

  @Get('sweep')
  async sweepDeposits(): Promise<{ message: string }> {
    try {
      await this.tokenSweeperService.sweepDeposits();
      return { message: '✅ Deposit sweeping completed successfully' };
    } catch (error: any) {
      return { message: `❌ Error during sweeping: ${error.message}` };
    }
  }
}
