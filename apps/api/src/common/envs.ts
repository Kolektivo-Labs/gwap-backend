
import 'dotenv/config'
import { CELO_CHAIN_ID, ETH_CHAIN_ID, OP_CHAIN_ID } from './chains'


export function env(name: string): string | undefined {
  const v = process.env[name]
  if (!v) console.error(`Missing env: ${name}`)
  return v
}

export const USDT_ETH = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
export const USDC_ETH = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

export const USDT_OP = '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58'
export const USDC_OP = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'

export const USDT_CELO = '0x48065fBbE25F71C9282dDf5e1Cd6d6a887483d5E'
export const USDC_CELO = '0x765DE816845861e75A25fCA122bb6898B8B1282A'

export function getTokenDecimals(erc20Addres: string) {
  return 6
}

export const GLOBALS = {

  ERC20_TOKEN_ADDRESSES: {
    [ETH_CHAIN_ID]: [USDT_ETH, USDC_ETH],
    [OP_CHAIN_ID]: [USDT_OP, USDC_OP],
    [CELO_CHAIN_ID]: [USDT_CELO, USDC_CELO],

  },


  ALCHEMY_PRIVATE_KEY: env('ALCHEMY_PRIVATE_KEY')!,
  MAIN_SAFE: env('MAIN_SAFE')!,
  SWEEP_SAFE: env('SWEEP_SAFE')!,
  RELAYER_PK: env('RELAYER_PK')!,
  SEND_URL: env('SEND_URL')!,
  SWEEP_BATCH_SIZE: process.env.SWEEP_BATCH_SIZE ? Number(process.env.SWEEP_BATCH_SIZE) : 20,
  WALLET_CHUNK_SIZE: process.env.WALLET_CHUNK_SIZE ? Number(process.env.WALLET_CHUNK_SIZE) : 100,
  WALLET_CHUNK_CONCURRENCY: process.env.WALLET_CHUNK_CONCURRENCY ? Number(process.env.WALLET_CHUNK_CONCURRENCY) : 5,
  ADDRESS_FETCH_CONCURRENCY: process.env.ADDRESS_FETCH_CONCURRENCY ? Number(process.env.ADDRESS_FETCH_CONCURRENCY) : 10,


}