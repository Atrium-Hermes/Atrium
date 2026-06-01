-- Atrium indexer schema. Applied idempotently on startup (CREATE IF NOT EXISTS).
-- Monetary values (pricePerCall, amounts, totals) are stored as TEXT holding a
-- base-units integer (USDC, 6 decimals) to avoid JS float precision loss.
-- Numeric ordering uses CAST(col AS INTEGER) (SQLite ints are 64-bit).

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS skills (
  skillId          TEXT PRIMARY KEY,
  cid              TEXT NOT NULL,
  creator          TEXT NOT NULL,         -- lowercased 0x address
  didHash          TEXT NOT NULL,
  pricePerCall     TEXT NOT NULL,         -- base units (string)
  totalInvocations INTEGER NOT NULL DEFAULT 0,
  totalVolume      TEXT NOT NULL DEFAULT '0',  -- gross USDC paid into this skill
  totalEarned      TEXT NOT NULL DEFAULT '0',  -- mirrors on-chain Skill.totalEarned (creator residual + royalties received)
  active           INTEGER NOT NULL DEFAULT 1,
  createdAt        INTEGER NOT NULL,       -- block timestamp (unix seconds)
  lastInvoked      INTEGER NOT NULL DEFAULT 0,
  blockNumber      INTEGER NOT NULL,
  -- Cached from IPFS (lazy). NULL until the body is fetched.
  name             TEXT,
  description      TEXT,
  tagsJson         TEXT,
  categoriesJson   TEXT,
  tagsText         TEXT,                   -- lowercased, space-joined (for LIKE filters)
  categoriesText   TEXT,
  manifestJson     TEXT,
  body             TEXT,
  ipfsFetched      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_skills_creator   ON skills(creator);
CREATE INDEX IF NOT EXISTS idx_skills_active     ON skills(active);
CREATE INDEX IF NOT EXISTS idx_skills_created     ON skills(createdAt);
CREATE INDEX IF NOT EXISTS idx_skills_unfetched  ON skills(ipfsFetched);

CREATE TABLE IF NOT EXISTS skill_parents (
  skillId       TEXT NOT NULL,
  parentSkillId TEXT NOT NULL,
  royaltyBps    INTEGER NOT NULL,
  PRIMARY KEY (skillId, parentSkillId)
);
CREATE INDEX IF NOT EXISTS idx_parents_parent ON skill_parents(parentSkillId);

CREATE TABLE IF NOT EXISTS invocations (
  txHash           TEXT NOT NULL,
  logIndex         INTEGER NOT NULL,
  skillId          TEXT NOT NULL,
  caller           TEXT NOT NULL,
  amount           TEXT NOT NULL,
  invocationNumber INTEGER NOT NULL,
  blockNumber      INTEGER NOT NULL,
  blockTimestamp   INTEGER NOT NULL,
  PRIMARY KEY (txHash, logIndex)
);
CREATE INDEX IF NOT EXISTS idx_invocations_skill ON invocations(skillId);
CREATE INDEX IF NOT EXISTS idx_invocations_block ON invocations(blockNumber);

CREATE TABLE IF NOT EXISTS royalty_payments (
  txHash        TEXT NOT NULL,
  logIndex      INTEGER NOT NULL,
  parentSkillId TEXT NOT NULL,
  childSkillId  TEXT NOT NULL,
  parentCreator TEXT NOT NULL,
  amount        TEXT NOT NULL,
  blockNumber   INTEGER NOT NULL,
  PRIMARY KEY (txHash, logIndex)
);
CREATE INDEX IF NOT EXISTS idx_royalty_parent ON royalty_payments(parentSkillId);
CREATE INDEX IF NOT EXISTS idx_royalty_child_tx ON royalty_payments(childSkillId, txHash);

CREATE TABLE IF NOT EXISTS withdrawals (
  txHash      TEXT NOT NULL,
  logIndex    INTEGER NOT NULL,
  user        TEXT NOT NULL,
  amount      TEXT NOT NULL,
  blockNumber INTEGER NOT NULL,
  PRIMARY KEY (txHash, logIndex)
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user);

CREATE TABLE IF NOT EXISTS attestations (
  skillId       TEXT PRIMARY KEY,
  benchmarkHash TEXT NOT NULL,
  successRate   INTEGER NOT NULL,
  sampleCount   INTEGER NOT NULL,
  attester      TEXT NOT NULL,
  attestedAt    INTEGER NOT NULL,
  txHash        TEXT NOT NULL
);

-- One row per cursor name; tracks the highest fully-processed block.
CREATE TABLE IF NOT EXISTS events_cursor (
  name      TEXT PRIMARY KEY,
  lastBlock INTEGER NOT NULL
);

-- Misc key/value state (e.g. cached protocolFeeBps).
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Full-text search over cached skill text. Populated after IPFS fetch.
CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
  skillId UNINDEXED,
  name,
  description,
  tags,
  body
);
