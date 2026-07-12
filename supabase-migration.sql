-- Authoritative mirror: written only by the indexer service role.
CREATE TABLE IF NOT EXISTS usernames_cache (
  username text PRIMARY KEY,
  owner_address text NOT NULL,
  tx_hash text,
  registered_at timestamptz,
  last_synced_ledger bigint
);

-- Optimistic, short-lived, clearly non-authoritative.
CREATE TABLE IF NOT EXISTS usernames_pending (
  username text PRIMARY KEY,
  owner_address text NOT NULL,
  submitted_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE usernames_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE usernames_pending ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to ensure clean execution
DROP POLICY IF EXISTS "read cache" ON usernames_cache;
DROP POLICY IF EXISTS "read pending" ON usernames_pending;

-- Public/anon role: read-only on both tables.
CREATE POLICY "read cache" ON usernames_cache FOR SELECT USING (true);
CREATE POLICY "read pending" ON usernames_pending FOR SELECT USING (true);
