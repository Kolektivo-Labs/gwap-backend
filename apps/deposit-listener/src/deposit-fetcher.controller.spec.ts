import { Test, TestingModule } from '@nestjs/testing';
import { DepositFetcherService } from './deposit-fetcher/deposit-fetcher.service';
import { DepositListenerController } from './deposit-fetcher.controller';


describe('DepositFetcherController', () => {
  let depositFetcherController: DepositListenerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [DepositListenerController],
      providers: [DepositFetcherService],
    }).compile();

    depositFetcherController = app.get<DepositListenerController>(DepositListenerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(depositFetcherController.syncDeposits()).toBe('Hello World!');
    });
  });
});
