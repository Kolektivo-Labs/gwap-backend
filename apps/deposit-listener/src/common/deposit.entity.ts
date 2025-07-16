export type Deposit = {
    tx_hash: string;
    chain_id: number;
    deposit_addr: string;
    amount_usd: string;
    erc20_address: string;
    gas_used: string;
    block_number: bigint;
    confirmed: boolean;
    settled: boolean;
    settlement_hash: string | null;
    swept: boolean | null;
};
