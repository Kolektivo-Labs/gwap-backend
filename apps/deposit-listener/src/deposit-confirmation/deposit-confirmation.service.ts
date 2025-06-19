import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { ethers } from 'ethers';
import 'dotenv/config';
import { DatabaseService } from '../common/database.service';



const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);

@Injectable()
export class DepositConfirmationService {
    private readonly logger = new Logger(DepositConfirmationService.name);

    constructor(private readonly db: DatabaseService) { }

    async confirmDeposits(minConfirmations: number = 5): Promise<void> {
        const currentBlock = await provider.getBlockNumber();

        const res = await this.db.pool.pgClient.query<{ tx_hash: string }>(`
      SELECT tx_hash FROM deposits WHERE confirmed = false
    `);

        if (res.rows.length === 0) {
            this.logger.log('No unconfirmed deposits found.');
            return;
        }

        let confirmedCount = 0;

        for (const row of res.rows) {
            const txHash = row.tx_hash;

            try {
                const receipt = await provider.getTransactionReceipt(txHash);

                if (!receipt || !receipt.blockNumber || !receipt.gasUsed) {
                    this.logger.debug(`Tx ${txHash} not yet confirmed or reorged out.`);
                    continue;
                }

                const confirmations = currentBlock - receipt.blockNumber + 1;
                if (confirmations >= minConfirmations) {
                    const gasUsed = receipt.gasUsed.toString();

                    await this.db.pool.pgClient.query(
                        `UPDATE deposits SET confirmed = true, gas_used = $1 WHERE tx_hash = $2`,
                        [gasUsed, txHash]
                    );

                    this.logger.log(`Confirmed deposit ${txHash} with gasUsed=${gasUsed}.`);
                    confirmedCount++;
                }
            } catch (err) {
                this.logger.error(`Error checking tx ${txHash}: ${err.message}`);
            }
        }

        if (confirmedCount === 0) {
            this.logger.log('No deposits reached confirmation threshold.');
        } else {
            this.logger.log(`Marked ${confirmedCount} deposits as confirmed.`);
        }
    }
}
