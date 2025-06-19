import { Test, TestingModule } from '@nestjs/testing';
import { DepositSenderService } from './deposit-sender.service';

describe('DepositSenderService', () => {
  let service: DepositSenderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DepositSenderService],
    }).compile();

    service = module.get<DepositSenderService>(DepositSenderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
