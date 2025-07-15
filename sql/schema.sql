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
  tx_hash TEXT PRIMARY KEY,
  deposit_addr TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  amount_usd TEXT NOT NULL,
  gas_used TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  confirmed BOOLEAN DEFAULT FALSE,
  settled BOOLEAN DEFAULT FALSE,  
  settlement_hash TEXT,
  FOREIGN KEY (deposit_addr,chain_id ) REFERENCES wallets(deposit_addr,chain_id) ON DELETE CASCADE
);



CREATE INDEX idx_deposits_confirmed ON deposits (confirmed);
CREATE INDEX idx_deposits_settled ON deposits (settled);
CREATE INDEX idx_deposits_block_number ON deposits (block_number);
