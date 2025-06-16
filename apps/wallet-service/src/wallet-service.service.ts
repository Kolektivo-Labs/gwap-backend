import { ethers, Contract, Interface, ZeroAddress, JsonRpcProvider, Wallet, TransactionReceipt } from 'ethers';
import SafeProxyFactoryAbi from './abi.json';
import { Injectable, Logger } from '@nestjs/common';
import { CFG } from './main';
import { AddWalletRequestDto, AddWalletResponseDto } from './dto/add-wallet.dto';

// Constants
const OP_FACTORY: string = '0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC';
const SINGLETON: string = '0x3E5c63644E683549055b9Be8653de26E0B4CD36E';
const REGISTRY: string = '0xaE00377a40B8b14e5f92E28A945c7DdA615b2B46';
const OWNER_SAFE: string = process.env.MAIN_SAFE!;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  async addWallet(request: AddWalletRequestDto): Promise<AddWalletResponseDto> {

    this.logger.log(request);
    if (!request.email || !request.accountId || !request.userId) {
      throw new Error('Email, accountId ans userId are required');
    }


    return {
      userId: request.userId!,
      email: request.email!,
      accountId: request.accountId!,
      address: "0x00000000"
    };
    /*
    // Preparar el init data para el Safe
    const safeInterface: Interface = new Interface([
      'function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address payable paymentReceiver)'
    ]);

    const initData: string = safeInterface.encodeFunctionData('setup', [
      [OWNER_SAFE],        // owners
      1,                   // threshold
      ZeroAddress,         // to
      '0x',                // data
      ZeroAddress,         // fallbackHandler
      ZeroAddress,         // paymentToken
      0,                   // payment
      ZeroAddress          // paymentReceiver
    ]);

    const provider: JsonRpcProvider = new JsonRpcProvider(CFG.rpc, CFG.chainId);
    const signer: Wallet = new Wallet(CFG.pk, provider);

    const saltNonce: string = Date.now().toString();

    const factory: Contract = new Contract(OP_FACTORY, SafeProxyFactoryAbi, signer);
    this.logger.log('Sending createProxyWithCallback transaction...');

    const tx = await factory.createProxyWithCallback(
      SINGLETON,
      initData,
      saltNonce,
      REGISTRY
    );

    this.logger.log(`Transaction sent: ${tx.hash}`);

    const receipt: TransactionReceipt = await tx.wait();

    // Buscamos el log de ProxyCreationL2
    const proxyCreatedLog = receipt.logs.find(log => log.address.toLowerCase() !== OP_FACTORY.toLowerCase());
    if (!proxyCreatedLog) {
      throw new Error('Proxy address not found in transaction logs');
    }

    const proxyAddress: string = proxyCreatedLog.address;
    this.logger.log(`New Safe Proxy deployed at: ${proxyAddress}`);

    return {
      email: request.email!,
      accountId: request.accountId!,
      proxy: proxyAddress
    };
    */
  }
}
