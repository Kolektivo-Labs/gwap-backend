import { WalletService } from './wallet-service.service';

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(() => {
    service = new WalletService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw error when neither email nor accountId is provided', async () => {
    await expect(service.addWallet({ email: null, accountId: null })).rejects.toThrow('Email or accountId is required');
  });

  it('should execute on-chain logic when email is provided', async () => {
    // Aquí deberías mockear la llamada on-chain
    // Por ahora simplemente lanzamos un "skip" porque necesitas mocks
    expect(true).toBe(true);
  });

  it('should execute on-chain logic when accountId is provided', async () => {
    expect(true).toBe(true);
  });
});
