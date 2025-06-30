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


-- balances
CREATE TABLE balances (
  user_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  current_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, currency),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- settlements
CREATE TABLE settlements (
  batch_id TEXT PRIMARY KEY,
  total_usd NUMERIC(18, 2) NOT NULL,
  wire_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX idx_deposits_confirmed ON deposits (confirmed);
CREATE INDEX idx_deposits_settled ON deposits (settled);
CREATE INDEX idx_deposits_block_number ON deposits (block_number);
