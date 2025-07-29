import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from '../../../api/src/common/database.service';
import { formatUnits } from 'ethers';
import { GLOBALS } from 'apps/api/src/common/envs';

@Injectable()
export class DepositSenderService {
  private readonly logger = new Logger(DepositSenderService.name);
  private readonly apiUrl = GLOBALS.SEND_URL
  private running = false;

  constructor(private readonly db: DatabaseService) { }

  async sendConfirmedDeposits(): Promise<void> {
    if (this.running) {
      console.log('⏳ DepositFetcherService is already running. Skipping...');
      return;
    }

    this.running = true;
    try {
      const res = await this.db.pool.query<{
        tx_hash: string;
        deposit_addr: string;
        amount_usd: string;
        email: string;
        account: string;
      }>(`
      SELECT d.tx_hash, d.deposit_addr, d.amount_usd, d.gas_used, d.erc20_address AS erc20,d.chain_id , d.settlement_hash , d.block_number,  u.email, u.girasol_account_id AS account
      FROM deposits d
      JOIN wallets w ON d.deposit_addr = w.deposit_addr AND d.chain_id = w.chain_id
      JOIN users u ON w.user_id = u.user_id
      WHERE d.confirmed = true AND d.settled = false
    `);

      if (res.rows.length === 0) {
        this.logger.log('No confirmed deposits to send.');
        return;
      }

      for (const row of res.rows) {

        const payload = {
          txHash: row.tx_hash,
          blockNumber: row.block_number,
          erc20: row.erc20,
          chainId: row.chain_id,
          sweepHash: row.settlement_hash,
          email: row.email,
          account: row.account,
          amount: Number(row.amount_usd),
          currencyCode: 840,
          merchant: 'CFX',
          paymentType: 'crypto',
          gasFee: row.gas_used,
        };

        const client = await this.db.pool.connect();

        try {


          const response = await axios.post(this.apiUrl, payload, {
            headers: {
              'x-api-key': process.env.GIRASOL_API_KEY!,
              'x-secret-key': process.env.GIRASOL_SECRET_KEY!,
              'x-company-id': process.env.GIRASOL_COMPANY_ID!,
              'Content-Type': 'application/json',
            },
          });

          if (response.status === 201 && response.data?.statusCode === 201 && response.data.error === false) {
            await client.query(
              `UPDATE deposits SET settled = true WHERE tx_hash = $1`,
              [row.tx_hash]
            );


            this.logger.log(`Sent deposit ${row.tx_hash} successfully.`);
          } else {

            this.logger.warn(`Deposit ${row.tx_hash} failed validation. Response: ${JSON.stringify(response.data)}`);
          }
        } catch (err) {

          if (axios.isAxiosError(err) && err.response) {
            this.logger.error(`Error sending deposit ${row.tx_hash}: ${err.message}`);
            this.logger.error(`Response status: ${err.response.status}`);
            this.logger.error(`Response body: ${JSON.stringify(err.response.data)}`);
          } else {
            this.logger.error(`Unexpected error for deposit ${row.tx_hash}: ${err.message}`);
          }
        } finally {
          client.release();
        }
      }
    } finally {
      this.running = false;
    }
  }
}
