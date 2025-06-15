import { Test, TestingModule } from '@nestjs/testing';
import { DepositListenerController } from './deposit-listener.controller';
import { DepositListenerService } from './deposit-listener.service';

describe('DepositListenerController', () => {
  let depositListenerController: DepositListenerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [DepositListenerController],
      providers: [DepositListenerService],
    }).compile();

    depositListenerController = app.get<DepositListenerController>(DepositListenerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(depositListenerController.getHello()).toBe('Hello World!');
    });
  });
});
