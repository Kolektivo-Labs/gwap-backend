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
      SELECT tx_hash, deposit_addr FROM deposits WHERE confirmed = false
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
                    if (!row.deposit_addr) {
                        this.logger.warn(`Deposit ${txHash} has no deposit_addr – skipping sweep`);
                        continue;
                      }
                  const settlementHash =  await this.sweeper.sweepProxySafe(row.deposit_addr as string);
                    await this.db.pool.query(
                        `UPDATE deposits SET confirmed = true, settled = true, settlement_hash= $3, gas_used = $1 WHERE tx_hash = $2`,
                        [gasUsed, txHash, settlementHash]
                    );

                    this.logger.log(`Confirmed deposit ${txHash} at ${row.deposit_addr} with gasUsed=${gasUsed}.`);

                    confirmedCount++;
                }
            } catch (err) {
                this.logger.error(`Error checking tx ${txHash} of address ${row.deposit_addr}: ${err.message}`);
            }
        }

        if (confirmedCount === 0) {
            this.logger.log('No deposits reached confirmation threshold.');
        } else {
            this.logger.log(`Marked ${confirmedCount} deposits as confirmed.`);
        }
    }
}
