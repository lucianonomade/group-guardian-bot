CREATE TABLE public.group_finder_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  instance_id uuid NOT NULL,
  theme text,
  invite_links text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  results jsonb NOT NULL DEFAULT '[]',
  groups_found integer NOT NULL DEFAULT 0,
  groups_joined integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.group_finder_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own finder tasks" ON public.group_finder_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own finder tasks" ON public.group_finder_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own finder tasks" ON public.group_finder_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own finder tasks" ON public.group_finder_tasks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_group_finder_tasks_updated_at
  BEFORE UPDATE ON public.group_finder_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();