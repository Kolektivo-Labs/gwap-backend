import {
  ethers,
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
import { Pool } from 'pg';

import { MetricsService } from './metrics.service';
import { getCreate2Address } from 'ethers';
import { SAFE_DEPLOYMENTS } from './common/safe-deployment';
import { SUPPORTED_CHAIN_IDS } from 'apps/api/src/common/chains';
import { env, GLOBALS } from 'apps/api/src/common/envs';


const RELAYER_PK = env('RELAYER_PK')
const OWNER_SAFE = env('MAIN_SAFE')!;

@Injectable()
export class WalletService {
  constructor(
    private readonly metricsService: MetricsService
  ) { }


  private readonly logger = new Logger(WalletService.name);

  async addWallet(request: AddWalletRequestDto): Promise<AddWalletResponseDto> {
    const { email, accountId, userId } = request;

    if (!email || !accountId || !userId) {
      throw new Error('Missing required fields: email, accountId, userId');
    }

    const existingWallet = await this.getWalletByUserId(userId)

    if (existingWallet != null && existingWallet.chainIds.length == SUPPORTED_CHAIN_IDS.length) {
      this.logger.error(`Tryed to re-create a wallet for the user ${userId}`);
      throw new Error('User already has a wallet');
    }
    try {
      return await this.createUserAccount(request, existingWallet?.chainIds);
    } catch (error: any) {
      this.logger.error('Failed to process wallet creation', error);
      throw new Error('Wallet creation failed');
    }
  }

  async createUserAccount(request: AddWalletRequestDto, existingWallet?: string[]): Promise<AddWalletResponseDto> {
    const { email, accountId, userId } = request;

    let proxyAddress: string | null = "";
    const pgClient = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    let client: any
    try {

      //this.predictAddresses(userId!)

      const saltNonce = keccak256(toUtf8Bytes(`wallet:${userId}:${GLOBALS.MAIN_SAFE}`))
      client = await pgClient.connect();

      await client.query('BEGIN');
      await client.query(
        `INSERT INTO users (user_id, girasol_account_id, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
         SET girasol_account_id = EXCLUDED.girasol_account_id,
             email = EXCLUDED.email`,
        [userId, accountId, email],
      );

      const chainIds: string[] = existingWallet ?? []
      for (const chainId of Object.keys(SAFE_DEPLOYMENTS).map(Number)) {
        if (chainIds.includes(chainId.toString()))
          continue;
        proxyAddress = await this.createSafeProxy(chainId, saltNonce)
        if (!proxyAddress)
          continue
        chainIds.push(chainId.toString())
        proxyAddress = proxyAddress.toLowerCase();
        await client.query(
          `INSERT INTO wallets (user_id, deposit_addr, chain_id)
         VALUES ($1, $2, $3)`,
          [userId, proxyAddress, chainId],
        );
      }

      await client.query('COMMIT');

      return {
        userId: userId!,
        email: email!,
        accountId: accountId!,
        address: proxyAddress!,
        chainIds
      };
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error('DB transaction failed', err);
      this.metricsService.walletDeployFailCounter.inc();
      throw err;
    } finally {
      client.release();
    }
  }



  async createSafeProxy(chainId: number, saltNonce: string): Promise<string | null> {

    const deployCFG = SAFE_DEPLOYMENTS[chainId];


    if (!OWNER_SAFE || !RELAYER_PK) {
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
      deployCFG.fallbackHandler,
      ZeroAddress,
      0,
      ZeroAddress,
    ]);
    const createProxyWithCallbackAbi = [
      "function createProxyWithCallback(address _singleton, bytes memory initializer, uint256 saltNonce, address callback)"
    ];


    const provider = new JsonRpcProvider(deployCFG.rpc, chainId);
    const signer = new Wallet(RELAYER_PK, provider);
    const factory = new Contract(deployCFG.factory, createProxyWithCallbackAbi, signer);


    try {
      this.logger.log('Sending Safe proxy creation tx...');
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
    } catch (err) {
      this.logger.error('Safe deployment failed', err);
      return null
    }
  }

  async getWalletByUserId(userId: string): Promise<AddWalletResponseDto | null> {
    const pgClient = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const client = await pgClient.connect();

    try {
      const res = await client.query(
        `
      SELECT 
        u.user_id,
        u.email,
        u.girasol_account_id as "accountId",
        array_agg(w.chain_id) as "chainIds",
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
