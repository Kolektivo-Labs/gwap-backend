/* src/token-sweeper/token-sweeper.service.ts
   -------------------------------------------------------------
   ENV required (same as before):
     MAIN_SAFE, RELAYER_PK, RPC_URL
*/
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import Safe,  {EthersAdapter} from '@safe-global/protocol-kit';
import {
  MetaTransactionData,
  OperationType,
  SafeTransaction,
} from '@safe-global/safe-core-sdk-types';

const TOKEN = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'; // USDT

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
export class TokenSweeperService implements OnModuleInit {
    private logger = new Logger(TokenSweeperService.name);
  
    private provider!: ethers.JsonRpcProvider;
    private ethAdapter!: EthersAdapter;
    private mainSafeSdk!: Safe;            // <- created in onModuleInit
    private usdt!: ethers.Contract;
    private contractSig!: string;
    private MAIN_SAFE!: string;

  constructor() {
    const { MAIN_SAFE, RELAYER_PK, RPC_URL } = process.env;
    if (!MAIN_SAFE || !RELAYER_PK || !RPC_URL) {
      throw new Error('⛔ MAIN_SAFE / RELAYER_PK / RPC_URL env vars missing!');
    }
    this.MAIN_SAFE = MAIN_SAFE;            // save for later

    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(RELAYER_PK, this.provider);
    this.ethAdapter = new EthersAdapter({ ethers, signerOrProvider: signer });
    this.usdt = new ethers.Contract(TOKEN, ERC20, this.provider);

    // r = MAIN_SAFE, s = 0, v = 1
    this.contractSig =
      '0x' +
      MAIN_SAFE.toLowerCase().replace('0x', '').padStart(64, '0') +
      '0'.repeat(64) +
      '01';
  }

  /* ---------- async part ---------- */
  async onModuleInit() {
    this.mainSafeSdk = await Safe.create({
      ethAdapter: this.ethAdapter,
      safeAddress: this.MAIN_SAFE,
    });
    this.logger.log('TokenSweeperService ready – main Safe loaded');
  }


  /** Sweep every USDT in `proxySafe` to MAIN_SAFE.  Idempotent. */
  async sweepProxySafe(proxySafe: string): Promise<string | null> {
    proxySafe = ethers.getAddress(proxySafe); // checksum
    const bal: bigint = await this.usdt.balanceOf(proxySafe);

    if (bal === 0n) {
      this.logger.log(`[${proxySafe}] balance is zero — nothing to sweep`);
      return null;
    }
    this.logger.log(
      `[${proxySafe}] sweeping ${ethers.formatUnits(bal, 6)} USDT → MAIN_SAFE`,
    );

    /* ——— Build the inner Safe tx (USDT transfer) ——— */
    const proxyEthAdapter = new EthersAdapter({
      ethers,
      signerOrProvider: this.mainSafeSdk.getEthAdapter().getSigner()!, // same signer
    });
    const proxySdk = await Safe.create({
      ethAdapter: proxyEthAdapter,
      safeAddress: proxySafe,
    });

    this.logger.log(
      `[${this.MAIN_SAFE}] Receiving ${ethers.formatUnits(bal, 6)} USDC`,
    );


    const transferTx: MetaTransactionData = {
      to: TOKEN,
      value: '0',
      data: ERC20.encodeFunctionData('transfer', [this.MAIN_SAFE, bal]),
      operation: OperationType.Call,
    };
    const safeTx: SafeTransaction = await proxySdk.createTransaction({
      transactions: [transferTx],
    });
    const hash = await proxySdk.getTransactionHash(safeTx);

    /* ——— 1. approveHash() on the proxy  ——— */
    const approveTx = await this.mainSafeSdk.createTransaction({
      transactions: [
        {
          to: proxySafe,
          value: '0',
          data: APPROVE_IFACE.encodeFunctionData('approveHash', [hash]),
          operation: OperationType.Call,
        },
      ],
    });
    await this.mainSafeSdk.signTransaction(approveTx);
    const sent1 = await this.mainSafeSdk.executeTransaction(approveTx);
    await (sent1.transactionResponse as ethers.TransactionResponse).wait();
    this.logger.log(`[${proxySafe}] approveHash ✓`);

    /* ——— 2. execTransaction() on the proxy  ——— */
    const d = safeTx.data;
    const execTx = await this.mainSafeSdk.createTransaction({
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
            this.contractSig,
          ]),
          operation: OperationType.Call,
        },
      ],
    });
    await this.mainSafeSdk.signTransaction(execTx);
    const sent2 = await this.mainSafeSdk.executeTransaction(execTx);
    const rc = await (sent2.transactionResponse as ethers.TransactionResponse).wait();
    this.logger.log(`[${proxySafe}] sweep complete – tx ${rc!.hash}`);
    return rc!.hash;
  }
}
