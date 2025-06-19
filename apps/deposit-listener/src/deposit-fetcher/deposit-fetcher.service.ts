import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Pool } from 'pg';
import 'dotenv/config';
import { Alchemy, AssetTransfersCategory, Network } from 'alchemy-sdk';
import { DatabaseService } from '../common/database.service';



@Injectable()
export class DepositFetcherService {
  private readonly logger = new Logger(DepositFetcherService.name);

  constructor(private readonly http: HttpService, private readonly db: DatabaseService) { }

  async syncDeposits() {
    const wallets = await this.getWalletsFromOptimism();
    if (wallets.length === 0) return;

    const after = await this.getLastSyncedBlockNumber();
    const allNewTransfers: any[] = [];


    const chunkSize = 100;
    for (let i = 0; i < wallets.length; i += chunkSize) {
      const chunk = wallets.slice(i, i + chunkSize).map(w => w.deposit_addr.toLowerCase());
      console.log(`Syncing deposits after block: ${after} for ${chunk}`);
      const transfers = await this.fetchTransfers(chunk, after);

      console.log(`Transfers fetched: ${transfers.length}`);
      if (transfers.length === 0) continue;

      const newTransfers = await this.filterNewTransfers(transfers);
      allNewTransfers.push(...newTransfers);
    }

    if (allNewTransfers.length > 0) {
      await this.insertDeposits(allNewTransfers, wallets);
      this.logger.log(`Inserted ${allNewTransfers.length} new deposits`);
    } else {
      this.logger.log('No new transfers found');
    }
  }

  private async getWalletsFromOptimism(): Promise<{ user_id: string; deposit_addr: string }[]> {
    const res = await this.db.pool.pgClient.query(
      'SELECT user_id, deposit_addr FROM wallets WHERE chain_id = 10',
    );
    return res.rows;
  }

  private async getLastSyncedBlockNumber(): Promise<`0x${string}`> {
    const res = await this.db.pool.pgClient.query(
      'SELECT COALESCE(MAX(block_number), 0) AS last FROM deposits',
    );
    return `0x${Number(res.rows[0].last).toString(16)}`;
  }

  private async fetchTransfers(addresses: string[], after: `0x${string}`): Promise<any[]> {


    const settings = {
      apiKey: process.env.ALCHEMY_PRIVATE_KEY!,
      network: Network.OPT_MAINNET,
    };

    const alchemy = new Alchemy(settings);
    const results = await Promise.all(
      addresses.map(async (address) => {
        const result = await alchemy.core.getAssetTransfers({
          fromBlock: after,
          toAddress: address,
          excludeZeroValue: true,
          category: [AssetTransfersCategory.ERC20],
          contractAddresses: ['0x7F5c764cBc14f9669B88837ca1490cCa17c31607'],
        });
        return result.transfers;
      })
    );
    return results.flat();
  }

  private async filterNewTransfers(transfers: any[]): Promise<any[]> {
    if (transfers.length === 0) return [];

    const hashes = transfers.map(d => `'${d.hash}'`).join(',');
    if (hashes.length === 0) return transfers;

    const res = await this.db.pool.pgClient.query<{ tx_hash: string }>(
      `SELECT tx_hash FROM deposits WHERE tx_hash IN (${hashes})`,
    );
    const existing = new Set(res.rows.map(r => r.tx_hash));

    return transfers.filter(d => !existing.has(d.hash));
  }

  private async insertDeposits(
    transfers: any[],
    wallets: { user_id: string; deposit_addr: string }[]
  ) {
    const addressSet = new Set(wallets.map(w => w.deposit_addr.toLowerCase()));

    const values: string[] = [];

    for (const t of transfers) {
      if (!t.to || t.value === null) continue;
      const depositAddr = t.to.toLowerCase();
      if (!addressSet.has(depositAddr)) continue;

      const amount = t.value.toString();
      const blockNumber = parseInt(t.blockNum, 16);

      values.push(
        `('${t.hash.replace(/'/g, "''")}', '${depositAddr}', 10, ${amount}, FALSE, FALSE, ${blockNumber})`
      );

    }

    if (values.length === 0) return;

    const sql = `
    INSERT INTO deposits (tx_hash, deposit_addr, chain_id, amount_usd, confirmed, settled, block_number)
    VALUES ${values.join(', ')}
  `;
    await this.db.pool.pgClient.query(sql);
  }

}
