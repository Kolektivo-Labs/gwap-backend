import { Test, TestingModule } from '@nestjs/testing';
import { DepositConfirmationService } from './deposit-confirmation.service';

describe('DepositConfirmationService', () => {
  let service: DepositConfirmationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DepositConfirmationService],
    }).compile();

    service = module.get<DepositConfirmationService>(DepositConfirmationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
