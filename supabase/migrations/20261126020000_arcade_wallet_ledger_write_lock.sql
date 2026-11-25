-- ===========================================================================
-- NEXORA · Arcade wallet and ledger write lock
-- Coin balances and ledger entries must only be changed by trusted SECURITY
-- DEFINER RPCs or server-side admin operations, never by browser clients.
-- ===========================================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.arcade_wallets, public.arcade_coin_ledger
  FROM PUBLIC, anon, authenticated;

-- Owners can still read their balance and transaction history through RLS.
GRANT SELECT ON public.arcade_wallets, public.arcade_coin_ledger TO authenticated;
