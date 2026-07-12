-- Create user_wallets table for encrypted non-custodial backups
CREATE TABLE IF NOT EXISTS user_wallets (
  username TEXT PRIMARY KEY,
  owner_address TEXT UNIQUE NOT NULL,
  encrypted_secret_key TEXT NOT NULL,
  encryption_salt TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Allow public read access for user_wallets"
  ON user_wallets
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access for user_wallets"
  ON user_wallets
  FOR INSERT
  WITH CHECK (true);
