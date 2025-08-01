
import { Alchemy, AssetTransfersResult, Network } from 'alchemy-sdk';
import { env, GLOBALS } from './envs';


export const CELO_CHAIN_ID = '42220'
export const OP_CHAIN_ID = '10'
export const ETH_CHAIN_ID = '1'
export const ARBITRUM_CHAIN_ID = '42161';
export const POLYGON_CHAIN_ID = '137';
export const BASE_CHAIN_ID = '8453';
export const AVALANCHE_CHAIN_ID = '43114';
export const UNICHAIN_CHAIN_ID = '130';


export const SUPPORTED_CHAIN_IDS = [
    OP_CHAIN_ID,
    ETH_CHAIN_ID,
    CELO_CHAIN_ID,
    ARBITRUM_CHAIN_ID,
    POLYGON_CHAIN_ID,
    BASE_CHAIN_ID,
    AVALANCHE_CHAIN_ID,
    UNICHAIN_CHAIN_ID
];


export function getRPCFromChain(chainId: string) {
    return env(`RPC_URL_${chainId}`)!
}

export function getAlchemyNetworkFromChain(chainId: string) {
    switch (chainId) {
        case OP_CHAIN_ID:
            return Network.OPT_MAINNET
        case ETH_CHAIN_ID:
            return Network.ETH_MAINNET
        case CELO_CHAIN_ID:
            return Network.CELO_MAINNET
        case ARBITRUM_CHAIN_ID:
            return Network.ARB_MAINNET;
        case POLYGON_CHAIN_ID:
            return Network.MATIC_MAINNET;
        case BASE_CHAIN_ID:
            return Network.BASE_MAINNET;
        case AVALANCHE_CHAIN_ID:
            return Network.AVAX_MAINNET;
        case UNICHAIN_CHAIN_ID:
            return Network.UNICHAIN_MAINNET;
        default:
            return undefined;
    }
}

export function createAlchemy(chainId: string): Alchemy {
    return new Alchemy({
        apiKey: GLOBALS.ALCHEMY_PRIVATE_KEY,
        network: getAlchemyNetworkFromChain(chainId),
    });
}


export type TransfersWithChain = AssetTransfersResult & { chainId: string }