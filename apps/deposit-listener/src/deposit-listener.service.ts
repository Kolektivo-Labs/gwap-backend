import { Injectable } from '@nestjs/common';

@Injectable()
export class DepositListenerService {
  getHello(): string {
    return 'Hello World!';
  }
}
