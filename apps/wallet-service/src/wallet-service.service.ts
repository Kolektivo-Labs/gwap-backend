import {
  ethers,
  Contract,
  Interface,
  ZeroAddress,
  JsonRpcProvider,
  Wallet,
  TransactionReceipt,
} from 'ethers';
import { Injectable, Logger } from '@nestjs/common';
import { CFG } from './main';
import { AddWalletRequestDto, AddWalletResponseDto } from './dto/add-wallet.dto';
import { Pool } from 'pg';
import SafeProxyFactoryAbi from './abi.json';



@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  async addWallet(request: AddWalletRequestDto): Promise<AddWalletResponseDto> {
    const { email, accountId, userId } = request;

    if (!email || !accountId || !userId) {
      throw new Error('Missing required fields: email, accountId, userId');
    }

    try {
      return await this.createUserAccount(request);
    } catch (error: any) {
      this.logger.error('Failed to process wallet creation', error);
      throw new Error('Wallet creation failed');
    }
  }

  async createUserAccount(request: AddWalletRequestDto): Promise<AddWalletResponseDto> {
    const { email, accountId, userId } = request;

    let proxyAddress: string;
    try {
      proxyAddress = await this.createSafeProxy();
      proxyAddress = proxyAddress.toLowerCase();
    } catch (error: any) {
      this.logger.error('Safe creation failed', error);
      throw new Error('Failed to create Safe Smart Account');
    }
    const pgClient = new Pool({
      connectionString: process.env.DATABASE_URL,
    });



    const client = await pgClient.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO users (user_id, girasol_account_id, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
         SET girasol_account_id = EXCLUDED.girasol_account_id,
             email = EXCLUDED.email`,
        [userId, accountId, email],
      );

      await client.query(
        `INSERT INTO wallets (user_id, deposit_addr, chain_id)
         VALUES ($1, $2, $3)`,
        [userId, proxyAddress, CFG.chainId],
      );

      await client.query('COMMIT');

      return {
        userId: userId!,
        email: email!,
        accountId: accountId!,
        address: proxyAddress,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error('DB transaction failed', err);
      throw err;
    } finally {
      client.release();
    }
  }

  async createSafeProxy(): Promise<string> {
    const OP_FACTORY = '0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC';
    const SINGLETON = '0x3E5c63644E683549055b9Be8653de26E0B4CD36E';
    const REGISTRY = '0xaE00377a40B8b14e5f92E28A945c7DdA615b2B46';
    const OWNER_SAFE = process.env.MAIN_SAFE!;

    if (!OWNER_SAFE || !CFG.pk) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Missing OWNER_SAFE env var');
      }
      this.logger.warn('OWNER_SAFE is missing, returning ZeroAddress (non-production)');
      return ZeroAddress;
    }


    const safeInterface = new Interface([
      'function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address payable paymentReceiver)',
    ]);

    const initData = safeInterface.encodeFunctionData('setup', [
      [OWNER_SAFE],
      1,
      ZeroAddress,
      '0x',
      ZeroAddress,
      ZeroAddress,
      0,
      ZeroAddress,
    ]);

    const abi = (SafeProxyFactoryAbi as any).default ?? SafeProxyFactoryAbi;
    const provider = new JsonRpcProvider(CFG.rpc, CFG.chainId);
    const signer = new Wallet(CFG.pk, provider);
    const saltNonce = Date.now().toString();
    const factory = new Contract(OP_FACTORY, abi, signer);


    try {
      this.logger.log('Sending Safe proxy creation tx...');
      const tx = await factory.createProxyWithCallback(SINGLETON, initData, saltNonce, REGISTRY);
      this.logger.log(`Tx sent: ${tx.hash}`);

      const receipt: TransactionReceipt = await tx.wait();

      const proxyCreatedLog = receipt.logs.find(
        (log) => log.address.toLowerCase() !== OP_FACTORY.toLowerCase(),
      );
      if (!proxyCreatedLog) throw new Error('Proxy address not found in logs');

      const proxyAddress = proxyCreatedLog.address;
      this.logger.log(`New Safe deployed at: ${proxyAddress}`);

      return proxyAddress;
    } catch (err) {
      this.logger.error('Safe deployment failed', err);
      throw new Error('Safe proxy creation failed');
    }
  }
}
