import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from '../common/database.service';
import { formatUnits } from 'ethers';

@Injectable()
export class DepositSenderService {
  private readonly logger = new Logger(DepositSenderService.name);
  private readonly apiUrl = 'https://ledger-admin.uat.girasol.services/v1/top-up/crypto/new';

  constructor(private readonly db: DatabaseService) { }

  async sendConfirmedDeposits(): Promise<void> {
    const res = await this.db.pool.query<{
      tx_hash: string;
      deposit_addr: string;
      amount_usd: string;
      email: string;
      account: string;
    }>(`
      SELECT d.tx_hash, d.deposit_addr, d.amount_usd, d.gas_used u.email, u.girasol_account_id AS account
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
      const amount = formatUnits(row.amount_usd, 6)

      const payload = {
        email: row.email,
        account: row.account,
        amount: amount,
        currencyCode: 840,
        merchant: 'CFX',
        paymentType: 'crypto',
        gasFee: row.gas_used,
      };

      const client = await this.db.pool.connect();

      try {
        await client.query('BEGIN');

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

          await client.query('COMMIT');
          this.logger.log(`Sent deposit ${row.tx_hash} successfully.`);
        } else {
          await client.query('ROLLBACK');
          this.logger.warn(`Deposit ${row.tx_hash} failed validation. Response: ${JSON.stringify(response.data)}`);
        }
      } catch (err) {
        await client.query('ROLLBACK');
        this.logger.error(`Error sending deposit ${row.tx_hash}: ${err.message}`);
      } finally {
        client.release();
      }
    }
  }
}
