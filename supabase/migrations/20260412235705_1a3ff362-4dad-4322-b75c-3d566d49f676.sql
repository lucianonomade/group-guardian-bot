
-- 1. Add rules_text to groups
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS rules_text text;

-- 2. Create daily_summaries table
CREATE TABLE public.daily_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  summary_text text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  members_active jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id, date)
);

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own summaries" ON public.daily_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own summaries" ON public.daily_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own summaries" ON public.daily_summaries FOR DELETE USING (auth.uid() = user_id);

-- 3. Create group_snapshots table
CREATE TABLE public.group_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  participant_count integer NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id, snapshot_date)
);

ALTER TABLE public.group_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots" ON public.group_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own snapshots" ON public.group_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Add recurrence to broadcasts
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS recurrence text DEFAULT NULL;
