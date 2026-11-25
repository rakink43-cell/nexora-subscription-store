-- ===========================================================================
-- NEXORA · Arcade progress write lock
-- Until a server-verified game completion RPC is available, authenticated
-- clients must not be able to submit their own levels or scores.
-- ===========================================================================

DROP POLICY IF EXISTS "arcade progress: owner update" ON public.arcade_game_progress;

REVOKE INSERT, UPDATE, DELETE ON public.arcade_game_progress FROM anon, authenticated;

-- Keep progress read-only to clients. Future verified game RPCs can write using
-- SECURITY DEFINER after validating the game session and completion server-side.
GRANT SELECT ON public.arcade_game_progress TO authenticated;
