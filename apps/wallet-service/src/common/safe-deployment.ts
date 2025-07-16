import {
    getProxyFactoryDeployment,
    getSafeSingletonDeployment,
    getFallbackHandlerDeployment,
} from '@safe-global/safe-deployments';
import { getRPCFromChain, SUPPORTED_CHAIN_IDS } from 'apps/api/src/common/chains';



export type SafeDeploymentInfo = {
    factory: string;
    singleton: string;
    registry: string;
    fallbackHandler: string;
    rpc: string
};



export const SAFE_DEPLOYMENTS: Record<string, SafeDeploymentInfo> = Object.fromEntries(
    SUPPORTED_CHAIN_IDS.map((chainId) => {
        const proxyFactory = getProxyFactoryDeployment({ network: chainId });
        const singleton = getSafeSingletonDeployment({ network: chainId });
        const fallbackHandler = getFallbackHandlerDeployment({ network: chainId });

        if (!proxyFactory || !singleton || !fallbackHandler) {
            throw new Error(`Missing Safe deployment data for chainId ${chainId}`);
        }

        const entry: [string, SafeDeploymentInfo] = [
            chainId,
            {
                factory: proxyFactory.defaultAddress,
                singleton: singleton.defaultAddress,
                registry: fallbackHandler.defaultAddress,
                fallbackHandler: fallbackHandler.defaultAddress,
                rpc: getRPCFromChain(chainId)!
            },
        ];

        return entry;
    }),
);