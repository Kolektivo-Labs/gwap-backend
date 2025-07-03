import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { ethers } from 'ethers';
import 'dotenv/config';
import { DatabaseService } from '../common/database.service';
import { Alchemy, Network } from 'alchemy-sdk';
import { TokenSweeperService } from '../token-sweep/token-sweep.service';

@Injectable()
export class DepositConfirmationService {
    private readonly logger = new Logger(DepositConfirmationService.name);

    constructor(private readonly db: DatabaseService,
        private readonly sweeper: TokenSweeperService,
    ) { }

    async confirmDeposits(minConfirmations: number = 5): Promise<void> {

        const alchemy = new Alchemy({
            apiKey: process.env.ALCHEMY_PRIVATE_KEY!,
            network: Network.OPT_MAINNET,
        });
        const currentBlock = await alchemy.core.getBlockNumber();

        const res = await this.db.pool.query<{ tx_hash: string;  deposit_addr: string;  }>(`
      SELECT tx_hash, deposit_addr FROM deposits WHERE confirmed = false AND swept= false  
    `);

        if (res.rows.length === 0) {
            this.logger.log('No unconfirmed deposits found.');
            return;
        }

        let confirmedCount = 0;

        for (const row of res.rows) {
            const txHash = row.tx_hash;

            try {
                const receipt = await alchemy.core.getTransactionReceipt(txHash);

                if (!receipt || !receipt.blockNumber || !receipt.gasUsed) {
                    this.logger.debug(`Tx ${txHash} not yet confirmed or reorged out.`);
                    continue;
                }

                const confirmations = currentBlock - receipt.blockNumber + 1;
                if (confirmations >= minConfirmations) {
                    const gasUsed = receipt.gasUsed.toString();
                    await this.db.pool.query(
                        `UPDATE deposits SET confirmed=true, gas_used = $1 WHERE tx_hash = $2`,
                        [gasUsed, txHash]
                    );

                    this.logger.log(`Confirmed deposit ${txHash} at ${row.deposit_addr} with gasUsed=${gasUsed}.`);

                    confirmedCount++;
                }
            } catch (err) {
                this.logger.error(`Error checking tx ${txHash} of address ${row.deposit_addr}: ${err.message}`);
            }
        }

        const unswept = await this.db.pool.query<{ tx_hash: string;  deposit_addr: string;  }>(`
            SELECT tx_hash, deposit_addr FROM deposits WHERE confirmed = true AND swept = false
          `);

          let sweptCount = 0;
          for(const row of unswept.rows){
            const txHash = row.tx_hash
        const settlementHash =  await this.sweeper.sweepProxySafe(row.deposit_addr as string);
        await this.db.pool.query(
            `UPDATE deposits SET swept=true, settlement_hash= $2 WHERE tx_hash = $1`,
            [ txHash, settlementHash]
        )
        sweptCount += settlementHash ? 1 : 0;
    }
    this.logger.log(
        `★ newly-confirmed: ${confirmedCount}, swept: ${sweptCount}`,
      );

        if (confirmedCount === 0) {
            this.logger.log('No deposits reached confirmation threshold.');
        } else {
            this.logger.log(`Marked ${confirmedCount} deposits as confirmed.`);
        }
    }
}
