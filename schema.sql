-- LiquidFeedback-PLC · esquema SQLite
-- Pragmas WAL/FK se aplican por conexión, no por DDL — en db.js.

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS unit (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  acronym    TEXT NOT NULL,
  founded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policies (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  description        TEXT,
  admission_days     INTEGER NOT NULL,
  discussion_days    INTEGER NOT NULL,
  verification_days  INTEGER NOT NULL,
  voting_days        INTEGER NOT NULL,
  issue_quorum       REAL NOT NULL,
  initiative_quorum  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS celulas (
  id      TEXT PRIMARY KEY,
  slug    TEXT UNIQUE NOT NULL,
  code    TEXT NOT NULL,
  name    TEXT NOT NULL,
  article INTEGER,
  purpose TEXT
);

CREATE TABLE IF NOT EXISTS affiliates (
  id     TEXT PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  name   TEXT NOT NULL,
  joined TEXT NOT NULL,
  city   TEXT,
  bio    TEXT
);

CREATE TABLE IF NOT EXISTS issues (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  celula_id       TEXT NOT NULL REFERENCES celulas(id),
  policy_id       TEXT NOT NULL REFERENCES policies(id),
  article         INTEGER,
  phase           TEXT NOT NULL CHECK (phase IN ('admission','discussion','verification','voting','finished')),
  phase_start_at  TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  description     TEXT
);

CREATE TABLE IF NOT EXISTS initiatives (
  id          TEXT PRIMARY KEY,
  issue_id    TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES affiliates(id),
  title       TEXT NOT NULL,
  summary     TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
  id            TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  author_id     TEXT NOT NULL REFERENCES affiliates(id),
  created_at    TEXT NOT NULL,
  content       TEXT
);

CREATE TABLE IF NOT EXISTS suggestions (
  id            TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  author_id     TEXT NOT NULL REFERENCES affiliates(id),
  directive     TEXT NOT NULL CHECK (directive IN ('must','should','must_not','should_not')),
  content       TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suggestion_ratings (
  suggestion_id TEXT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  affiliate_id  TEXT NOT NULL REFERENCES affiliates(id),
  sign          TEXT NOT NULL CHECK (sign IN ('plus','minus')),
  PRIMARY KEY (suggestion_id, affiliate_id)
);

CREATE TABLE IF NOT EXISTS supports (
  affiliate_id  TEXT NOT NULL REFERENCES affiliates(id),
  initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  at            TEXT NOT NULL,
  potential     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (affiliate_id, initiative_id)
);

CREATE TABLE IF NOT EXISTS ballots (
  affiliate_id TEXT NOT NULL REFERENCES affiliates(id),
  issue_id     TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  at           TEXT NOT NULL,
  PRIMARY KEY (affiliate_id, issue_id)
);

CREATE TABLE IF NOT EXISTS ballot_rankings (
  affiliate_id  TEXT NOT NULL,
  issue_id      TEXT NOT NULL,
  initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  rank          INTEGER NOT NULL,
  PRIMARY KEY (affiliate_id, issue_id, initiative_id),
  FOREIGN KEY (affiliate_id, issue_id) REFERENCES ballots(affiliate_id, issue_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS delegations (
  id          TEXT PRIMARY KEY,
  from_id     TEXT NOT NULL REFERENCES affiliates(id),
  to_id       TEXT NOT NULL REFERENCES affiliates(id),
  scope       TEXT NOT NULL CHECK (scope IN ('global','celula','issue')),
  target_id   TEXT,
  created_at  TEXT NOT NULL,
  revoked_at  TEXT
);

CREATE TABLE IF NOT EXISTS audit (
  id     TEXT PRIMARY KEY,
  at     TEXT NOT NULL,
  kind   TEXT NOT NULL,
  actor  TEXT,
  target TEXT,
  meta   TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_at ON audit (at DESC);
CREATE INDEX IF NOT EXISTS idx_initiatives_issue ON initiatives (issue_id);
CREATE INDEX IF NOT EXISTS idx_drafts_initiative ON drafts (initiative_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_initiative ON suggestions (initiative_id);
CREATE INDEX IF NOT EXISTS idx_supports_initiative ON supports (initiative_id);
CREATE INDEX IF NOT EXISTS idx_supports_affiliate ON supports (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_ballots_issue ON ballots (issue_id);
CREATE INDEX IF NOT EXISTS idx_delegations_from ON delegations (from_id);
CREATE INDEX IF NOT EXISTS idx_delegations_active ON delegations (from_id, scope, target_id) WHERE revoked_at IS NULL;
