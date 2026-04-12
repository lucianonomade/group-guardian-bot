CREATE TABLE public.whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  participant_jid text NOT NULL,
  participant_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id, participant_jid)
);

ALTER TABLE public.whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own whitelist" ON public.whitelist FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own whitelist" ON public.whitelist FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own whitelist" ON public.whitelist FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own whitelist" ON public.whitelist FOR UPDATE TO public USING (auth.uid() = user_id);