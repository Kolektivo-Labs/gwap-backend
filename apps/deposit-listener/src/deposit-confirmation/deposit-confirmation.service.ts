import { Injectable, Logger } from '@nestjs/common';
import 'dotenv/config';
import { DatabaseService } from '../../../api/src/common/database.service';
import { TokenSweeperService } from '../token-sweep/token-sweep.service';
import { createAlchemy, SUPPORTED_CHAIN_IDS } from 'apps/api/src/common/chains';
import { Deposit } from '../common/deposit.entity';


@Injectable()
export class DepositConfirmationService {
    private readonly logger = new Logger(DepositConfirmationService.name);

    constructor(private readonly db: DatabaseService,
        private readonly sweeper: TokenSweeperService,
    ) { }


    private readonly SQL = {
        selectByStatus: `
    SELECT  tx_hash,  chain_id, deposit_addr , amount_usd,erc20_address,
  gas_used, block_number,  confirmed,  settled, settlement_hash, swept 
    FROM deposits 
    WHERE confirmed = $2 AND swept = $3 AND chain_id = $1
  `,
        updateConfirmed: `
    UPDATE deposits 
    SET confirmed = true, gas_used = $1 
    WHERE tx_hash = $2 AND chain_id = $3
  `,
        updateSwept: `
    UPDATE deposits 
    SET swept = true, settlement_hash = $2 
    WHERE tx_hash = $1 AND chain_id = $3 
    RETURNING tx_hash
  `
    };
    async confirmDeposits(): Promise<void> {

        for (const chainId of SUPPORTED_CHAIN_IDS) {
            await this.confirmDepositsByChain(chainId, 3)
            await this.sweepFromChain(chainId)
        }

    }

    private async getDepositsByStatus(confirmed: boolean, swept: boolean, chainId: string): Promise<Deposit[]> {
        return (await this.db.pool.query<Deposit>(
            this.SQL.selectByStatus, [chainId, confirmed, swept])).rows;


    }

    async confirmDepositsByChain(chainId: string, minConfirmations: number = 3): Promise<void> {

        const alchemy = createAlchemy(chainId);
        const currentBlock = await alchemy.core.getBlockNumber();
        const res = await this.getDepositsByStatus(false, false, chainId)



        let confirmedCount = 0;

        for (const row of res) {


            try {
                const receipt = await alchemy.core.getTransactionReceipt(row.tx_hash);

                if (!receipt || !receipt.blockNumber || !receipt.gasUsed) {
                    this.logger.debug(`Tx ${row.tx_hash} not yet confirmed or reorged out.`);
                    continue;
                }
                if (receipt.gasUsed.isZero?.()) {
                    this.logger.warn(`Tx ${row.tx_hash} has 0 gasUsed, possible failed TX`);
                    continue;
                }

                const confirmations = currentBlock - receipt.blockNumber + 1;
                if (confirmations >= minConfirmations) {
                    const gasUsed = receipt.gasUsed.toString();
                    await this.db.pool.query(
                        this.SQL.updateConfirmed,
                        [gasUsed, row.tx_hash, chainId]
                    );

                    this.logger.log(`Confirmed deposit ${row.tx_hash} at ${row.deposit_addr} with gasUsed=${gasUsed}.`);

                    confirmedCount++;
                }
            } catch (err) {
                this.logger.error(`Error checking tx ${row.tx_hash} of address ${row.deposit_addr}: ${err.message}`);
            }
        }
        this.logger.log(`Marked ${confirmedCount} deposits as confirmed for chain: ${chainId}.`);



    }

    async sweepFromChain(chainId: string) {
        const unswept = await this.getDepositsByStatus(true, false, chainId)

        let sweptCount = 0;
        for (const row of unswept) {
            try {
                const settlementHash = await this.sweeper.sweepProxySafe(row);

                const update = await this.db.pool.query(
                    this.SQL.updateSwept,
                    [row.tx_hash, settlementHash ?? null, row.chain_id],
                );

                if (update.rowCount === 0) {
                    this.logger.warn(`UPDATE returned 0 rows for ${row.tx_hash}`);
                } else {
                    sweptCount += settlementHash ? 1 : 0;
                }
            } catch (err) {
                this.logger.error(`Sweep/update failed for ${row.tx_hash}: ${err.message}`);
            }
        }
        this.logger.log(`Swept deposits: ${sweptCount} for chain: ${chainId}`);

    }
}
