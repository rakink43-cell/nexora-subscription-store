-- ===========================================================================
-- NEXORA · Arcade foundation: game catalogue, secure coin wallet, first-login
-- reward. Cash withdrawals are intentionally not enabled in this migration.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.arcade_games (
  slug text PRIMARY KEY,
  title text NOT NULL,
  genre text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arcade_game_levels (
  game_slug text NOT NULL REFERENCES public.arcade_games(slug) ON DELETE CASCADE,
  level_number integer NOT NULL CHECK (level_number BETWEEN 1 AND 20),
  reward_coins integer NOT NULL CHECK (reward_coins BETWEEN 0 AND 10000),
  PRIMARY KEY (game_slug, level_number)
);

CREATE TABLE IF NOT EXISTS public.arcade_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coin_balance bigint NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
  lifetime_earned bigint NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arcade_coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount bigint NOT NULL CHECK (amount <> 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('first_login', 'level_reward', 'subscription_redemption', 'admin_adjustment')),
  source_key text NOT NULL,
  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_arcade_ledger_user_created
  ON public.arcade_coin_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.arcade_game_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_slug text NOT NULL REFERENCES public.arcade_games(slug) ON DELETE CASCADE,
  highest_level integer NOT NULL DEFAULT 0 CHECK (highest_level BETWEEN 0 AND 20),
  best_score integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_slug)
);

ALTER TABLE public.arcade_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_game_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_game_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arcade games: public read" ON public.arcade_games;
CREATE POLICY "arcade games: public read" ON public.arcade_games
  FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS "arcade games: admin manage" ON public.arcade_games;
CREATE POLICY "arcade games: admin manage" ON public.arcade_games
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "arcade levels: public read" ON public.arcade_game_levels;
CREATE POLICY "arcade levels: public read" ON public.arcade_game_levels
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.arcade_games g WHERE g.slug = game_slug AND (g.is_active OR public.is_admin()))
  );

DROP POLICY IF EXISTS "arcade levels: admin manage" ON public.arcade_game_levels;
CREATE POLICY "arcade levels: admin manage" ON public.arcade_game_levels
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "arcade wallet: owner or admin read" ON public.arcade_wallets;
CREATE POLICY "arcade wallet: owner or admin read" ON public.arcade_wallets
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "arcade ledger: owner or admin read" ON public.arcade_coin_ledger;
CREATE POLICY "arcade ledger: owner or admin read" ON public.arcade_coin_ledger
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "arcade progress: owner or admin read" ON public.arcade_game_progress;
CREATE POLICY "arcade progress: owner or admin read" ON public.arcade_game_progress
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "arcade progress: owner update" ON public.arcade_game_progress;
CREATE POLICY "arcade progress: owner update" ON public.arcade_game_progress
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT ON public.arcade_games, public.arcade_game_levels TO anon, authenticated;
GRANT SELECT ON public.arcade_wallets, public.arcade_coin_ledger, public.arcade_game_progress TO authenticated;
GRANT UPDATE ON public.arcade_game_progress TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.arcade_games, public.arcade_game_levels TO authenticated;

INSERT INTO public.arcade_games (slug, title, genre, description, is_active, sort_order) VALUES
('neon-memory','Neon Memory','Puzzle','Remember the pattern and repeat it as rounds get faster.',true,1),
('shadow-escape','Shadow Escape','Horror','Explore a mysterious abandoned place and find the exit.',false,2),
('tower-guard','Tower Guard','Tower Defense','Protect your base from waves of incoming enemies.',false,3),
('star-pilot','Star Pilot','Space Action','Pilot through a cosmic field of hazards.',false,4),
('turbo-circuit','Turbo Circuit','Racing','Race against time on a neon track.',false,5),
('dungeon-quest','Dungeon Quest','Adventure','Explore rooms, collect keys and uncover secrets.',false,6),
('mountain-climb','Mountain Climb','Platformer','Jump across platforms and reach the summit.',false,7),
('zombie-holdout','Zombie Holdout','Survival','Survive increasingly difficult waves.',false,8),
('mystery-rooms','Mystery Rooms','Mystery','Solve clues to unlock the next room.',false,9),
('battle-blocks','Battle Blocks','Arcade','Dodge, react and beat your best score.',false,10),
('city-builder','City Builder','City Simulator','Build a thriving city one block at a time.',false,11),
('farm-life','Farm Life','Farm Simulator','Plant, harvest and grow your small farm.',false,12),
('cafe-manager','Cafe Manager','Business Simulator','Run a cafe and keep customers happy.',false,13),
('treasure-trail','Treasure Trail','Treasure Hunt','Follow clues and find hidden treasure.',false,14),
('endless-runner','Endless Runner','Runner','Keep moving, dodge obstacles and collect stars.',false,15),
('deep-sea','Deep Sea','Exploration','Discover an underwater world and its secrets.',false,16),
('tactical-grid','Tactical Grid','Strategy','Plan each move on a compact tactical board.',false,17),
('alien-outpost','Alien Outpost','Sci-Fi','Defend a remote outpost from strange visitors.',false,18),
('parkour-rush','Parkour Rush','Action','Chain jumps and slides through an obstacle course.',false,19),
('logic-lab','Logic Lab','Brain Game','Solve quick logic challenges and unlock harder puzzles.',false,20)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, genre = EXCLUDED.genre, description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.arcade_game_levels (game_slug, level_number, reward_coins)
SELECT g.slug, level_no, level_no + 1
FROM public.arcade_games g
CROSS JOIN generate_series(1, 20) AS level_no
ON CONFLICT (game_slug, level_number) DO UPDATE SET reward_coins = EXCLUDED.reward_coins;

CREATE OR REPLACE FUNCTION public.arcade_claim_first_login_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_inserted uuid;
  v_balance bigint;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Please sign in to claim your welcome coins.' USING errcode = '28000';
  END IF;

  INSERT INTO public.arcade_wallets (user_id) VALUES (v_user)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM 1 FROM public.arcade_wallets WHERE user_id = v_user FOR UPDATE;

  INSERT INTO public.arcade_coin_ledger (user_id, amount, transaction_type, source_key, description)
  VALUES (v_user, 10, 'first_login', 'welcome:first-login', 'Welcome to NEXORA Arcade')
  ON CONFLICT (user_id, source_key) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NOT NULL THEN
    UPDATE public.arcade_wallets
       SET coin_balance = coin_balance + 10,
           lifetime_earned = lifetime_earned + 10,
           updated_at = now()
     WHERE user_id = v_user;
  END IF;

  SELECT coin_balance INTO v_balance FROM public.arcade_wallets WHERE user_id = v_user;
  RETURN jsonb_build_object(
    'rewarded', v_inserted IS NOT NULL,
    'coins_awarded', CASE WHEN v_inserted IS NOT NULL THEN 10 ELSE 0 END,
    'coin_balance', v_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.arcade_claim_first_login_reward() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arcade_claim_first_login_reward() TO authenticated;
