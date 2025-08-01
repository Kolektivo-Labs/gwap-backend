import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from '../../../api/src/common/database.service';
import { GLOBALS } from 'apps/api/src/common/envs';
import chunk from 'lodash.chunk';

interface DepositRow {
  txHash: string;
  blockNumber: number;
  erc20: string;
  chainId: string;
  sweepHash: string | null;
  email: string;
  account: string;
  amount: string;
  gasFee: number;
}


@Injectable()
export class DepositSenderService {
  private readonly logger = new Logger(DepositSenderService.name);
  private readonly apiUrl = GLOBALS.SEND_URL;
  private running = false;

  constructor(private readonly db: DatabaseService) { }

  async sendConfirmedDeposits(): Promise<void> {
    if (this.running) {
      this.logger.warn('⏳ DepositSenderService is already running. Skipping...');
      return;
    }

    this.running = true;
    try {
      const deposits = await this.getConfirmedDeposits();
      if (deposits.length === 0) {
        this.logger.log('No confirmed deposits to send.');
        return;
      }

      const chunks = chunk(deposits, 20);

      for (const batch of chunks) {
        await this.processBatch(batch);
      }
    } finally {
      this.running = false;
    }
  }

  private async processBatch(batch: DepositRow[]): Promise<void> {
    const payload = batch.map((row) => this.buildPayload(row));
    const client = await this.db.pool.connect();

    try {
      const response = await axios.post(this.apiUrl, payload, {
        headers: this.getHeaders(),
      });

      if (
        response.status === 201 &&
        response.data?.statusCode === 201 &&
        response.data.error === false
      ) {
        const promises = batch.map((row) =>
          client.query(
            `UPDATE deposits SET settled = true WHERE tx_hash = $1 AND chain_id = $2`,
            [row.txHash, row.chainId]
          )
        );
        await Promise.all(promises);
        this.logger.log(`✅ Sent batch of ${batch.length} deposits successfully.`);
      } else {
        this.logger.warn(`⚠️ Batch failed validation. Response: ${JSON.stringify(response.data)}`);
      }
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        this.logger.error(`❌ Error sending batch: ${err.message}`);
        this.logger.error(`Status: ${err.response.status}`);
        this.logger.error(`Body: ${JSON.stringify(err.response.data)}`);
      } else {
        this.logger.error(`❌ Unexpected error in batch: ${err.message}`);
      }
    } finally {
      try {
        client.release();
      } catch (e) {
        this.logger.warn('Failed to release DB client:', e);
      }
    }
  }

  private async getConfirmedDeposits(): Promise<DepositRow[]> {
    const result = await this.db.pool.query<DepositRow>(`
     SELECT 
  d.tx_hash            AS "txHash",
  d.block_number       AS "blockNumber",
  d.erc20_address      AS "erc20",
  d.chain_id           AS "chainId",
  d.settlement_hash    AS "sweepHash",
  u.email              AS "email",
  u.girasol_account_id AS "account",
  CAST(d.amount_usd AS NUMERIC) AS "amount",
  d.gas_used           AS "gasFee"
FROM deposits d
JOIN wallets w ON d.deposit_addr = w.deposit_addr AND d.chain_id = w.chain_id
JOIN users u ON w.user_id = u.user_id
WHERE d.confirmed = true AND d.settled = false;

    `);
    return result.rows;
  }

  private buildPayload(row: DepositRow): Record<string, any> {
    const payload = {
      ...row,
      amount: Number(row.amount),
      currencyCode: 840,
      merchant: 'CFX',
      paymentType: 'crypto',
    };

    return payload
  }

  private getHeaders(): Record<string, string> {
    return {
      'x-api-key': process.env.GIRASOL_API_KEY!,
      'x-secret-key': process.env.GIRASOL_SECRET_KEY!,
      'x-company-id': process.env.GIRASOL_COMPANY_ID!,
      'Content-Type': 'application/json',
    };
  }

  // private async processDeposit(row: DepositRow): Promise<void> {
  //   const payload = this.buildPayload(row);
  //   const client = await this.db.pool.connect();

  //   try {
  //     const response = await axios.post(this.apiUrl, payload, {
  //       headers: this.getHeaders(),
  //     });

  //     if (response.status === 201 && response.data?.statusCode === 201 && response.data.error === false) {
  //       await client.query(
  //         `UPDATE deposits SET settled = true WHERE tx_hash = $1 AND chain_id = $2`,
  //         [row.txHash, row.chainId]
  //       );
  //       this.logger.log(`✅ Sent deposit ${row.txHash} on chain ${row.chainId} successfully.`);
  //     } else {
  //       this.logger.warn(`⚠️ Deposit ${row.txHash} failed validation. Response: ${JSON.stringify(response.data)}`);
  //     }
  //   } catch (err: any) {
  //     if (axios.isAxiosError(err) && err.response) {
  //       this.logger.error(`❌ Error sending deposit ${row.txHash}: ${err.message}`);
  //       this.logger.error(`Status: ${err.response.status}`);
  //       this.logger.error(`Body: ${JSON.stringify(err.response.data)}`);
  //     } else {
  //       this.logger.error(`❌ Unexpected error for deposit ${row.txHash}: ${err.message}`);
  //     }
  //   } finally {
  //     try {
  //       client.release();
  //     } catch (e) {
  //       this.logger.warn('Failed to release DB client:', e);
  //     }
  //   }
  // }
}
