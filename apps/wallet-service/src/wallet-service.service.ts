import {
  Contract,
  Interface,
  ZeroAddress,
  JsonRpcProvider,
  Wallet,
  TransactionReceipt,
  keccak256,
  toUtf8Bytes,
} from 'ethers';
import { Injectable, Logger } from '@nestjs/common';
import { AddWalletRequestDto, AddWalletResponseDto } from './dto/add-wallet.dto';
import { MetricsService } from './metrics.service';
import { SAFE_DEPLOYMENTS } from './common/safe-deployment';
import { SUPPORTED_CHAIN_IDS } from 'apps/api/src/common/chains';
import { GLOBALS } from 'apps/api/src/common/envs';
import { DatabaseService } from 'apps/api/src/common/database.service';



@Injectable()
export class WalletService {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly db: DatabaseService,
  ) { }


  private readonly logger = new Logger(WalletService.name);

  async addWallet(request: AddWalletRequestDto): Promise<AddWalletResponseDto> {
    const { email, accountId, userId } = request;

    if (!email || !accountId || !userId) {
      throw new Error('Missing required fields: email, accountId, userId');
    }

    const existingWallet = await this.getWalletByUserId(userId)

    if (existingWallet != null && existingWallet.createdChainIds.length == SUPPORTED_CHAIN_IDS.length) {
      this.logger.error(`Tryed to re-create a wallet for the user ${userId}`);
      throw new Error('User already has a wallet');
    }
    try {
      return await this.createUserAccount(request, existingWallet?.createdChainIds);
    } catch (error: any) {
      this.logger.error('Failed to process wallet creation', error);
      throw new Error('Wallet creation failed');
    }
  }

  async createUserAccount(request: AddWalletRequestDto, existingChains?: string[]): Promise<AddWalletResponseDto> {
    const { email, accountId, userId } = request;

    const client = await this.db.pool.connect();
    const alreadyCreated = new Set(existingChains ?? []);

    const pendingChains = Object.keys(SAFE_DEPLOYMENTS).filter((id) => !alreadyCreated.has(id));

    try {
      await client.query('BEGIN');

      // Insert user (upsert)
      await client.query(
        `INSERT INTO users (user_id, girasol_account_id, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET girasol_account_id = EXCLUDED.girasol_account_id,
           email = EXCLUDED.email`,
        [userId, accountId, email],
      );

      // Create safes in parallel
      const results = await Promise.allSettled(
        pendingChains.map((chainId) =>
          this.createSafeProxy(chainId, userId!).then((address) => ({ chainId, address })),
        )
      );

      const successful: { chainId: string; address: string }[] = [];
      const failed: string[] = [];

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.address) {
          successful.push({
            chainId: result.value.chainId,
            address: result.value.address.toLowerCase(),
          });
        } else if (result.status === 'fulfilled') {
          failed.push(result.value.chainId);
        } else {
          this.logger.warn(`Unhandled rejection during parallel wallet creation`, result.reason);
        }
      }

      for (const { chainId, address } of successful) {
        await client.query(
          `INSERT INTO wallets (user_id, deposit_addr, chain_id)
         VALUES ($1, $2, $3)`,
          [userId, address, chainId],
        );
      }

      await client.query('COMMIT');

      return {
        userId: userId!,
        email: email!,
        accountId: accountId!,
        address: successful[0]?.address ?? '',
        createdChainIds: [...(existingChains ?? []), ...successful.map((r) => r.chainId)],
        errorChainIds: failed,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error('DB transaction failed', err);
      throw err;
    } finally {
      client.release();
    }
  }




  async createSafeProxy(chainId: string, userId: string): Promise<string | null> {

    const deployCFG = SAFE_DEPLOYMENTS[chainId];
    const saltNonce = keccak256(toUtf8Bytes(`wallet:${userId}:${GLOBALS.MAIN_SAFE}`))

    if (!GLOBALS.MAIN_SAFE || !GLOBALS.RELAYER_PK) {
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
      [GLOBALS.MAIN_SAFE],
      1,
      ZeroAddress,
      '0x',
      deployCFG.fallbackHandler,
      ZeroAddress,
      0,
      ZeroAddress,
    ]);
    const createProxyWithCallbackAbi = [
      "function createProxyWithCallback(address _singleton, bytes memory initializer, uint256 saltNonce, address callback)"
    ];


    const provider = new JsonRpcProvider(deployCFG.rpc);
    const signer = new Wallet(GLOBALS.RELAYER_PK, provider);
    const factory = new Contract(deployCFG.factory, createProxyWithCallbackAbi, signer);


    try {
      this.logger.log(`Sending Safe proxy creation tx on ${chainId}...`);
      const tx = await factory.createProxyWithCallback(deployCFG.singleton, initData, saltNonce, ZeroAddress);
      this.logger.log(`Tx sent: ${tx.hash}`);

      const receipt: TransactionReceipt = await tx.wait();

      const proxyCreatedLog = receipt.logs.find(
        (log) => log.address.toLowerCase() !== deployCFG.factory.toLowerCase(),
      );
      if (!proxyCreatedLog) throw new Error('Proxy address not found in logs');

      const proxyAddress = proxyCreatedLog.address;
      this.logger.log(`New Safe deployed`);

      return proxyAddress;
    } catch (err: any) {
      this.logger.error('Safe deployment failed');
      this.metricsService.walletDeployFailCounter.labels({ chainId, userId, reason: err.code || 'unknown' }).inc();
      if (err.code === 'CALL_EXCEPTION') {
        this.logger.error('EVM Revert reason:', err.reason || 'Unknown');
      } else if (err.code === 'NETWORK_ERROR') {
        this.logger.error('Network error during Safe deployment', err);
      } else if (err.code === 'SERVER_ERROR') {
        this.logger.error('RPC Server error', err);
      } else {
        this.logger.error('Unhandled error', err);
      }

      return null;
    }
  }

  async getWalletByUserId(userId: string): Promise<AddWalletResponseDto | null> {


    const client = await this.db.pool.connect();

    try {
      const res = await client.query(
        `
      SELECT 
        u.user_id,
        u.email,
        u.girasol_account_id as "accountId",
        array_agg(w.chain_id) as "createdChainIds",
        MIN(w.deposit_addr) as address
      FROM users u
      LEFT JOIN wallets w ON u.user_id = w.user_id
      WHERE u.user_id = $1
      GROUP BY u.user_id, u.email, u.girasol_account_id
      `,
        [userId],
      );

      if (res.rows.length === 0) {
        return null;
      }

      return res.rows[0] as AddWalletResponseDto;
    } catch (err) {
      this.logger.error('Failed to fetch wallet by userId', err);
      throw new Error('Failed to fetch wallet');
    } finally {
      client.release();
    }
  }


}
