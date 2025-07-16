import { Injectable, Logger } from '@nestjs/common';
import format from 'pg-format';
import 'dotenv/config';
import { Alchemy, AssetTransfersCategory } from 'alchemy-sdk';
import { DatabaseService } from '../../../api/src/common/database.service';
import { createAlchemy, getAlchemyNetworkFromChain, SUPPORTED_CHAIN_IDS, TransfersWithChain } from 'apps/api/src/common/chains';
import { env, GLOBALS } from 'apps/api/src/common/envs';

type WalletRecord = { user_id: string; deposit_addr: string };


@Injectable()
export class DepositFetcherService {
  private readonly logger = new Logger(DepositFetcherService.name);

  constructor(private readonly db: DatabaseService) { }

  async syncDeposits() {
    const wallets = await this.getWallets();
    if (wallets.length === 0) return;

    const fromBlockHex = await this.getLastSyncedBlockNumber();
    const allNewTransfers: TransfersWithChain[] = [];


    const chunkSize = 100;
    for (const chainId of SUPPORTED_CHAIN_IDS) {
      for (let i = 0; i < wallets.length; i += chunkSize) {
        const chunk = wallets.slice(i, i + chunkSize).map(w => w.deposit_addr.toLowerCase());
        this.logger.debug(`Syncing deposits after block: ${fromBlockHex} for: ${chunk}`);

        const transfers = await this.fetchTransfers(chainId, chunk, fromBlockHex);

        this.logger.debug(`Transfers fetched: ${transfers.length}`);
        if (transfers.length === 0) continue;

        const newTransfers = await this.filterNewTransfers(chainId, transfers);
        allNewTransfers.push(...newTransfers);
      }
    }

    if (allNewTransfers.length > 0) {
      await this.insertDeposits(allNewTransfers, wallets);
      this.logger.log(`Inserted ${allNewTransfers.length} new deposits`);
    } else {
      this.logger.log('No new transfers found');
    }
  }

  private async getWallets(): Promise<WalletRecord[]> {
    const res = await this.db.pool.query(
      'SELECT user_id, deposit_addr FROM wallets GROUP BY user_id, deposit_addr',
    );
    return res.rows;
  }

  private async getLastSyncedBlockNumber(): Promise<`0x${string}`> {
    const res = await this.db.pool.query(
      'SELECT COALESCE(MIN(block_number), 0) AS last FROM deposits',
    );
    return `0x${Number(res.rows[0].last).toString(16)}`;
  }

  private async fetchTransfers(chainId: string, addresses: string[], after: `0x${string}`): Promise<TransfersWithChain[]> {



    const alchemy = createAlchemy(chainId);

    this.logger.debug(`Fetching transfers after : ${after}`);

    const results = await Promise.all(
      addresses.map(async (address) => {

        const result = await alchemy.core.getAssetTransfers({
          fromBlock: after,
          toAddress: address,
          excludeZeroValue: true,
          category: [AssetTransfersCategory.ERC20],
          contractAddresses: GLOBALS.ERC20_TOKEN_ADDRESSES[chainId],
        });
        this.logger.debug(`Fetched transfers for address: ${address}`);
        return result.transfers;
      })
    );
    return results.flat().map((x) => { return { ...x, chainId } });
  }

  private async filterNewTransfers(chainId: string, transfers: TransfersWithChain[]): Promise<TransfersWithChain[]> {
    if (transfers.length === 0) return [];

    const hashes = transfers.map(d => d.hash);
    if (hashes.length === 0) return transfers;

    const params = hashes.map((_, i) => `$${i + 2}`).join(', ');
    const res = await this.db.pool.query(
      `SELECT tx_hash FROM deposits WHERE tx_hash IN (${params}) AND chain_id = $1`,
      [chainId, ...hashes]
    );
    const existing = new Set(res.rows.map(r => r.tx_hash));

    return transfers.filter(d => !existing.has(d.hash));
  }

  private async insertDeposits(
    transfers: TransfersWithChain[],
    wallets: { user_id: string; deposit_addr: string }[]
  ) {
    const addressSet = new Set(wallets.map(w => w.deposit_addr.toLowerCase()));

    const values: string[] = [];



    const rows = transfers
      .filter(t => t.to && t.value !== null)
      .map(t => [
        t.hash,
        t.to!.toLowerCase(),
        t.chainId,
        t.value!.toString(),
        parseInt(t.blockNum, 16),
        '0',
        false,
        false,
      ]);

    if (rows.length === 0) return;

    const query = format(
      `INSERT INTO deposits (tx_hash, deposit_addr, chain_id, amount_usd, block_number, gas_used, confirmed, settled)
   VALUES %L`,
      rows
    );
    await this.db.pool.query(query);
  }

}
