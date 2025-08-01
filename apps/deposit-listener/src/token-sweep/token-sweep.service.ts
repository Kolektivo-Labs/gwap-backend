
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers, parseUnits } from 'ethers';
import Safe, { EthersAdapter } from '@safe-global/protocol-kit';
import {
  MetaTransactionData,
  OperationType,
  SafeTransaction,
} from '@safe-global/safe-core-sdk-types';
import { getTokenDecimals, GLOBALS } from 'apps/api/src/common/envs';
import { getRPCFromChain, SUPPORTED_CHAIN_IDS } from 'apps/api/src/common/chains';
import { Deposit } from '../common/deposit.entity';
import { DatabaseService } from 'apps/api/src/common/database.service';


/* ——— ERC-20 & Gnosis-Safe ABIs ——— */
const ERC20 = new ethers.Interface([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
]);

const SAFE_EXEC = new ethers.Interface([
  'function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)',
]);

const APPROVE_IFACE = new ethers.Interface(['function approveHash(bytes32)']);


@Injectable()
export class TokenSweeperService {
  private logger = new Logger(TokenSweeperService.name);
  private running = false;

  constructor(private readonly db: DatabaseService,) {
  }

  private readonly SQL = {
    selectByStatus: `
    SELECT  tx_hash,  chain_id, deposit_addr , amount_usd,erc20_address,
  gas_used, block_number,  confirmed,  settled, settlement_hash, swept 
    FROM deposits 
    WHERE confirmed = $2 AND swept = $3 AND chain_id = $1
  `,
    updateSwept: `
    UPDATE deposits 
    SET swept = true, settlement_hash = $2 
    WHERE tx_hash = $1 AND chain_id = $3 
    RETURNING tx_hash
  `
  };



  async sweepDeposits(): Promise<void> {
    if (this.running) {
      console.log('⏳ DepositFetcherService is already running. Skipping...');
      return;
    }

    this.running = true;
    try {
      for (const chainId of SUPPORTED_CHAIN_IDS) {

        await this.sweepFromChain(chainId)
      }
    } finally {
      this.running = false;
    }
  }
  private async getDepositsByStatus(confirmed: boolean, swept: boolean, chainId: string): Promise<Deposit[]> {
    return (await this.db.pool.query<Deposit>(
      this.SQL.selectByStatus, [chainId, confirmed, swept])).rows;


  }

  async sweepProxySafe(deposit: Deposit): Promise<string | null> {

    const chainId = deposit.chain_id.toString()
    const erc20Address = deposit.erc20_address
    const decimals = getTokenDecimals(erc20Address)
    const address = deposit.deposit_addr


    const rpcURL = getRPCFromChain(chainId)
    const provider = new ethers.JsonRpcProvider(rpcURL);
    const signer = new ethers.Wallet(GLOBALS.RELAYER_PK!, provider);
    const ethAdapter = new EthersAdapter({ ethers, signerOrProvider: signer });
    const erc20Contract = new ethers.Contract(erc20Address, ERC20, provider)


    // r = MAIN_SAFE, s = 0, v = 1
    const contractSig = '0x' +
      GLOBALS.MAIN_SAFE.toLowerCase().replace('0x', '').padStart(64, '0') +
      '0'.repeat(64) +
      '01';

    const mainSafeSdk = await Safe.create({
      ethAdapter: ethAdapter,
      safeAddress: GLOBALS.MAIN_SAFE,
    });

    this.logger.log('TokenSweeperService ready – main Safe loaded');
    const proxySafe = ethers.getAddress(address); // checksum

    const proxyEthAdapter = new EthersAdapter({
      ethers,
      signerOrProvider: mainSafeSdk.getEthAdapter().getSigner()!, // same signer
    });
    const proxySdk = await Safe.create({
      ethAdapter: proxyEthAdapter,
      safeAddress: proxySafe,
    });




    const totalBalance: bigint = await erc20Contract.balanceOf(proxySafe);


    if (totalBalance === 0n) {
      this.logger.log(`[${proxySafe}] balance is zero — nothing to sweep`);
      return null;
    }

    const normalizedBalance = ethers.formatUnits(totalBalance, decimals)
    const sweepAmount = parseFloat(normalizedBalance) < parseFloat(deposit.amount_usd) ? totalBalance : parseUnits(deposit.amount_usd, decimals)

    this.logger.log(`[${proxySafe}] sweeping ${normalizedBalance} USD → MAIN_SAFE`,);
    /* ——— Build the inner Safe tx (ERC20 transfer) ——— */


    this.logger.log(
      `[${GLOBALS.MAIN_SAFE}] Receiving ${normalizedBalance} USD`,
    );
    const transferTx: MetaTransactionData = {
      to: erc20Address,
      value: '0',
      data: ERC20.encodeFunctionData('transfer', [GLOBALS.MAIN_SAFE, sweepAmount]),
      operation: OperationType.Call,
    };

    const safeTx: SafeTransaction = await proxySdk.createTransaction({
      transactions: [transferTx],
    });

    const hash = await proxySdk.getTransactionHash(safeTx);

    /* ——— 1. approveHash() on the proxy  ——— */
    const approveTx = await mainSafeSdk.createTransaction({
      transactions: [
        {
          to: proxySafe,
          value: '0',
          data: APPROVE_IFACE.encodeFunctionData('approveHash', [hash]),
          operation: OperationType.Call,
        },
      ],
    });

    await mainSafeSdk.signTransaction(approveTx);
    const sent1 = await mainSafeSdk.executeTransaction(approveTx);
    await (sent1.transactionResponse as ethers.TransactionResponse).wait();

    this.logger.log(`[${proxySafe}] approveHash ✓`);

    /* ——— 2. execTransaction() on the proxy  ——— */
    const d = safeTx.data;
    const execTx = await mainSafeSdk.createTransaction({
      transactions: [
        {
          to: proxySafe,
          value: '0',
          data: SAFE_EXEC.encodeFunctionData('execTransaction', [
            d.to,
            d.value,
            d.data,
            d.operation,
            0, // safeTxGas
            0, // baseGas
            0, // gasPrice
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            contractSig,
          ]),
          operation: OperationType.Call,
        },
      ],
    });
    await mainSafeSdk.signTransaction(execTx);
    const sent2 = await mainSafeSdk.executeTransaction(execTx);
    const rc = await (sent2.transactionResponse as ethers.TransactionResponse).wait();
    this.logger.log(`[${proxySafe}] sweep complete – tx ${rc!.hash}`);
    return rc!.hash;
  }


  public async batchSweepFromProxySafe(deposits: Deposit[]): Promise<string | null> {
    if (deposits.length === 0) return null;

    const chainId = deposits[0].chain_id.toString();
    const provider = new ethers.JsonRpcProvider(getRPCFromChain(chainId));
    const signer = new ethers.Wallet(GLOBALS.RELAYER_PK!, provider);
    const ethAdapter = new EthersAdapter({ ethers, signerOrProvider: signer });

    const mainSafeSdk = await Safe.create({
      ethAdapter,
      safeAddress: GLOBALS.MAIN_SAFE,
    });

    const contractSig =
      '0x' +
      GLOBALS.MAIN_SAFE.toLowerCase().replace('0x', '').padStart(64, '0') +
      '0'.repeat(64) +
      '01';

    const metaTxs: MetaTransactionData[] = [];

    for (const deposit of deposits) {
      const proxySafe = ethers.getAddress(deposit.deposit_addr);
      const erc20Address = deposit.erc20_address;
      const decimals = getTokenDecimals(erc20Address);
      const erc20 = new ethers.Contract(erc20Address, ERC20, provider);

      const balance: bigint = await erc20.balanceOf(proxySafe);
      if (balance === 0n) continue;

      const amount = parseFloat(ethers.formatUnits(balance, decimals)) < parseFloat(deposit.amount_usd)
        ? balance
        : parseUnits(deposit.amount_usd, decimals);

      // Transfer TX en proxy
      const transferTx: MetaTransactionData = {
        to: erc20Address,
        value: '0',
        data: ERC20.encodeFunctionData('transfer', [GLOBALS.MAIN_SAFE, amount]),
        operation: OperationType.Call,
      };

      const proxyAdapter = new EthersAdapter({ ethers, signerOrProvider: signer });
      const proxySdk = await Safe.create({
        ethAdapter: proxyAdapter,
        safeAddress: proxySafe,
      });

      const safeTx = await proxySdk.createTransaction({ transactions: [transferTx] });
      const hash = await proxySdk.getTransactionHash(safeTx);

      // 1. Approve Hash
      metaTxs.push({
        to: proxySafe,
        value: '0',
        data: APPROVE_IFACE.encodeFunctionData('approveHash', [hash]),
        operation: OperationType.Call,
      });

      // 2. Exec Transaction en el proxy
      const d = safeTx.data;
      metaTxs.push({
        to: proxySafe,
        value: '0',
        data: SAFE_EXEC.encodeFunctionData('execTransaction', [
          d.to,
          d.value,
          d.data,
          d.operation,
          0, 0, 0,
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          contractSig,
        ]),
        operation: OperationType.Call,
      });
    }

    if (metaTxs.length === 0) return null;

    const safeTransaction = await mainSafeSdk.createTransaction({ transactions: metaTxs });

    try {
      await mainSafeSdk.signTransaction(safeTransaction);
      const txResp = await mainSafeSdk.executeTransaction(safeTransaction);
      await provider.waitForTransaction(txResp.hash, 1);
      return txResp.hash;
    } catch (e) {
      this.logger.error('Error during batch sweep', e);
      throw e;
    }
  }




  async sweepFromChain(chainId: string) {
    const unswept = await this.getDepositsByStatus(true, false, chainId)

    let sweptCount = 0;
    for (const row of unswept) {
      try {
        const settlementHash = await this.sweepProxySafe(row);

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
