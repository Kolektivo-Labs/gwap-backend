
import { env } from './envs';

export const SUPPORTED_CHAIN_IDS = ['10', '1', '42220']; // OP, Arbitrum, Celo


export function getRPCFromChain(chainId: string){
    return env(`RPC_URL_${chainId}`)!
}