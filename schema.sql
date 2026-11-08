CREATE TABLE IF NOT EXISTS admins(id uuid PRIMARY KEY, username text UNIQUE NOT NULL, password_hash text NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash text PRIMARY KEY, admin_id uuid NOT NULL REFERENCES admins(id), expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS elections(id uuid PRIMARY KEY, title text NOT NULL, description text NOT NULL, method text NOT NULL CHECK(method IN ('preferential','fptp','referendum')), options jsonb NOT NULL, opens_at timestamptz NOT NULL, closes_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed')), created_at timestamptz DEFAULT now(), CHECK(closes_at>opens_at));
CREATE TABLE IF NOT EXISTS voter_codes(election_id uuid REFERENCES elections(id), code_hash text NOT NULL, used boolean DEFAULT false, PRIMARY KEY(election_id,code_hash));
CREATE TABLE IF NOT EXISTS ballots(id uuid PRIMARY KEY, election_id uuid NOT NULL REFERENCES elections(id), encrypted_vote text NOT NULL, receipt_hash text UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id bigserial PRIMARY KEY, admin_id uuid REFERENCES admins(id), action text NOT NULL, election_id uuid REFERENCES elections(id), created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS rate_buckets(key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS ballot_election_idx ON ballots(election_id);
