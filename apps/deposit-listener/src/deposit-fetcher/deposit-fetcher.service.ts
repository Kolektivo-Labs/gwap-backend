import { Injectable, Logger } from '@nestjs/common';
import format from 'pg-format';
import 'dotenv/config';
import { AssetTransfersCategory } from 'alchemy-sdk';
import { DatabaseService } from '../../../api/src/common/database.service';
import { createAlchemy, SUPPORTED_CHAIN_IDS, TransfersWithChain } from 'apps/api/src/common/chains';
import { GLOBALS } from 'apps/api/src/common/envs';
import { printableAddressList } from 'apps/api/src/common/utils';

type WalletRecord = { deposit_addr: string };


@Injectable()
export class DepositFetcherService {
  private readonly logger = new Logger(DepositFetcherService.name);
  private running = false;

  constructor(private readonly db: DatabaseService) { }

  async syncDeposits() {
    if (this.running) {
      console.log('⏳ Already running. Skipping...');
      return;
    }
    this.running = true;

    try {
      const allNewTransfers: TransfersWithChain[] = [];


      const chunkSize = 100;
      await Promise.all(SUPPORTED_CHAIN_IDS.map(async (chainId) => {

        const fromBlockHex = await this.getLastSyncedBlockNumber(chainId);
        const wallets = await this.getWallets(chainId);

        for (let i = 0; i < wallets.length; i += chunkSize) {
          const chunk = wallets.slice(i, i + chunkSize).map(w => w.deposit_addr.toLowerCase());

          const printableList = printableAddressList(chunk);
          this.logger.debug(
            `Syncing deposits after block: ${fromBlockHex} for chain ${chainId}:\n${printableList.join('\n')}`
          );
          const transfers = await this.fetchTransfers(chainId, chunk, fromBlockHex);

          this.logger.debug(`Transfers fetched: ${transfers.length}`);
          if (transfers.length === 0) continue;

          const newTransfers = await this.filterNewTransfers(chainId, transfers);
          allNewTransfers.push(...newTransfers);
        }
      }));

      if (allNewTransfers.length > 0)
        await this.insertDeposits(allNewTransfers);

      this.logger.log(`Total inserted ${allNewTransfers.length} new deposits`);
    } finally {
      this.running = false;
    }
  }

  private async getWallets(chainId: string): Promise<WalletRecord[]> {
    const res = await this.db.pool.query(
      'SELECT deposit_addr FROM wallets WHERE chain_id = $1', [chainId]
    );
    return res.rows;
  }

  private async getLastSyncedBlockNumber(chainId: string): Promise<`0x${string}`> {
    const res = await this.db.pool.query(
      'SELECT COALESCE(MAX(block_number) +1, 0) AS last FROM deposits WHERE chain_id = $1', [chainId]
    );
    return `0x${Number(res.rows[0].last).toString(16)}`;
  }

  private async fetchTransfers(chainId: string, addresses: string[], after: string): Promise<TransfersWithChain[]> {



    const alchemy = createAlchemy(chainId);

    this.logger.debug(`Fetching transfers after : ${after} for chain: ${chainId}`);

    const results = await Promise.all(
      addresses.map(async (address) => {

        const result = await alchemy.core.getAssetTransfers({
          fromBlock: after as `0x${string}`,
          toAddress: address,
          excludeZeroValue: true,
          category: [AssetTransfersCategory.ERC20],
          contractAddresses: GLOBALS.ERC20_TOKEN_ADDRESSES[chainId],
        });

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
    transfers: TransfersWithChain[]
  ) {


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
        t.rawContract.address,
        false
      ]);

    if (rows.length === 0) return;

    const query = format(
      `INSERT INTO deposits (tx_hash, deposit_addr, chain_id, amount_usd, block_number, gas_used, confirmed, settled,erc20_address, swept)
   VALUES %L`,
      rows
    );
    await this.db.pool.query(query);
  }

}
