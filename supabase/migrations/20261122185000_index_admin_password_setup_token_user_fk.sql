CREATE INDEX IF NOT EXISTS idx_admin_password_setup_tokens_user_id
  ON public.admin_password_setup_tokens (user_id);