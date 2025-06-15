import { Controller, Get } from '@nestjs/common';
import { DepositListenerService } from './deposit-listener.service';

@Controller()
export class DepositListenerController {
  constructor(private readonly depositListenerService: DepositListenerService) {}

  @Get()
  getHello(): string {
    return this.depositListenerService.getHello();
  }
}
