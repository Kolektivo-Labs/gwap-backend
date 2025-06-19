import { Test, TestingModule } from '@nestjs/testing';
import { DepositFetcherController } from './deposit-fetcher.controller';
import { DepositFetcherService } from './deposit-fetcher.service';


describe('DepositFetcherController', () => {
  let depositFetcherController: DepositFetcherController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [DepositFetcherController],
      providers: [DepositFetcherService],
    }).compile();

    depositFetcherController = app.get<DepositFetcherController>(DepositFetcherController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(depositFetcherController.syncDeposits()).toBe('Hello World!');
    });
  });
});
