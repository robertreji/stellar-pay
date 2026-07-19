-- Create recipients table for saved remittance contacts
CREATE TABLE IF NOT EXISTS recipients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text NOT NULL, -- sender username link
  name text NOT NULL,
  upi_id text NOT NULL,
  nickname text,
  is_favorite boolean DEFAULT false,
  is_recent boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access for recipients" ON recipients;
DROP POLICY IF EXISTS "Allow public insert access for recipients" ON recipients;
DROP POLICY IF EXISTS "Allow public update access for recipients" ON recipients;
DROP POLICY IF EXISTS "Allow public delete access for recipients" ON recipients;

CREATE POLICY "Allow public read access for recipients"
  ON recipients FOR SELECT USING (true);

CREATE POLICY "Allow public insert access for recipients"
  ON recipients FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access for recipients"
  ON recipients FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access for recipients"
  ON recipients FOR DELETE USING (true);


-- Create remittance_transactions table
CREATE TABLE IF NOT EXISTS remittance_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_id text UNIQUE NOT NULL,
  sender_wallet text NOT NULL,
  sender_username text NOT NULL,
  recipient_name text NOT NULL,
  recipient_upi text NOT NULL,
  amount_usdc numeric(20, 4) NOT NULL,
  exchange_rate numeric(20, 4) NOT NULL,
  amount_inr numeric(20, 2) NOT NULL,
  stellar_tx_hash text,
  status text NOT NULL CHECK (status IN ('pending', 'payment_detected', 'processing', 'completed', 'failed', 'refunded')),
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE remittance_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access for remittance_transactions" ON remittance_transactions;
DROP POLICY IF EXISTS "Allow public insert access for remittance_transactions" ON remittance_transactions;
DROP POLICY IF EXISTS "Allow public update access for remittance_transactions" ON remittance_transactions;

CREATE POLICY "Allow public read access for remittance_transactions"
  ON remittance_transactions FOR SELECT USING (true);

CREATE POLICY "Allow public insert access for remittance_transactions"
  ON remittance_transactions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access for remittance_transactions"
  ON remittance_transactions FOR UPDATE USING (true);
