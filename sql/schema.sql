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
  PRIMARY KEY (user_id, deposit_addr, chain_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- deposits
CREATE TABLE deposits (
  tx_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_usd NUMERIC(18, 2) NOT NULL,
  confirmed BOOLEAN DEFAULT FALSE,
  settled BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
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
