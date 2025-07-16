-- users
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  girasol_account_id TEXT NOT NULL,
  email TEXT NOT NULL
);

-- wallets
CREATE TABLE wallets (
  user_id TEXT NOT NULL,
  deposit_addr TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  PRIMARY KEY (deposit_addr, chain_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- deposits
CREATE TABLE deposits (
  tx_hash TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  deposit_addr TEXT NOT NULL,
  amount_usd TEXT NOT NULL,
  gas_used TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  confirmed BOOLEAN DEFAULT FALSE,
  settled BOOLEAN DEFAULT FALSE,  
  settlement_hash TEXT,
  swept BOOLEAN,
  PRIMARY KEY (tx_hash, chain_id),
  FOREIGN KEY (deposit_addr, chain_id) REFERENCES wallets(deposit_addr, chain_id) ON DELETE CASCADE
);




CREATE INDEX idx_deposits_confirmed_swept ON deposits (confirmed, swept);
CREATE INDEX idx_deposits_confirmed_settled ON deposits (confirmed, settled);
CREATE INDEX idx_deposits_deposit_addr_chain_id ON deposits (deposit_addr, chain_id);
CREATE INDEX idx_deposits_block_number ON deposits (block_number);


CREATE INDEX idx_wallets_deposit_addr_chain_id ON wallets (deposit_addr, chain_id);
CREATE INDEX idx_wallets_chain_id ON wallets (chain_id);
CREATE INDEX idx_wallets_user_id ON wallets (user_id);


CREATE UNIQUE INDEX idx_users_user_id ON users (user_id);
