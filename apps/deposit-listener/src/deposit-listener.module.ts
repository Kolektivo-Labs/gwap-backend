import { Module } from '@nestjs/common';
import { DepositListenerController } from './deposit-listener.controller';
import { DepositListenerService } from './deposit-listener.service';

@Module({
  imports: [],
  controllers: [DepositListenerController],
  providers: [DepositListenerService],
})
export class DepositListenerModule {}
