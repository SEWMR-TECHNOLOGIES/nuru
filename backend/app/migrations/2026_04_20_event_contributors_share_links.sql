-- ============================================================================
-- Migration: Guest contribution share links on event_contributors
-- Date: 2026-04-20
-- ============================================================================
-- Adds the ability for an organiser to generate a public payment link for
-- any contributor on the address-book list. The contributor opens the link
-- (no Nuru account needed), pays via the existing checkout, and the
-- payment is auto-attributed to their event_contributor row.
--
-- Design notes:
--   * `share_token_hash` stores SHA-256 of the token. The plain token is only
--     ever returned once on generation (or via "regenerate"). This protects
--     us against DB leaks: an attacker reading the DB can't open links.
--   * `share_token_revoked_at` lets the host kill a leaked link without
--     deleting the contributor. Validation rejects revoked or expired tokens.
--   * `share_token_expires_at` is set to NOW() + 90 days on generation;
--     hosts can refresh by regenerating.
--   * `share_link_last_opened_at` is touched whenever the public page is
--     loaded so hosts can see whether the contributor has even seen the link.
-- ============================================================================

ALTER TABLE event_contributors
  ADD COLUMN IF NOT EXISTS share_token_hash       TEXT      NULL,
  ADD COLUMN IF NOT EXISTS share_token_created_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS share_token_expires_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS share_token_revoked_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS share_link_last_opened_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS share_link_sms_last_sent_at TIMESTAMP NULL;

-- Lookup-by-token must be fast: this is the hot path for every public page
-- load.  Token hashes are unique because we regenerate a new one on collision.
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_contributors_share_token_hash
  ON event_contributors(share_token_hash)
  WHERE share_token_hash IS NOT NULL;
