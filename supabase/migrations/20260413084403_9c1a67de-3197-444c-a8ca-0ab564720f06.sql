
CREATE TABLE public.group_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  source_group_name text,
  rules_text text,
  welcome_message text,
  blocked_words jsonb DEFAULT '[]'::jsonb,
  whitelist_entries jsonb DEFAULT '[]'::jsonb,
  antiflood_settings jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own backups" ON public.group_backups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own backups" ON public.group_backups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own backups" ON public.group_backups FOR DELETE USING (auth.uid() = user_id);
