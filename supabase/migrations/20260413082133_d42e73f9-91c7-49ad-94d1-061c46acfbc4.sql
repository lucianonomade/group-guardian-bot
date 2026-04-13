CREATE TABLE public.warmup_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  target_numbers TEXT[] NOT NULL DEFAULT '{}',
  current_day INTEGER NOT NULL DEFAULT 0,
  total_days INTEGER NOT NULL DEFAULT 7,
  messages_today INTEGER NOT NULL DEFAULT 0,
  max_messages_today INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  schedule_plan JSONB NOT NULL DEFAULT '[{"day":1,"messages":2},{"day":2,"messages":4},{"day":3,"messages":6},{"day":4,"messages":10},{"day":5,"messages":15},{"day":6,"messages":20},{"day":7,"messages":25}]',
  last_message_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.warmup_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own warmup tasks" ON public.warmup_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own warmup tasks" ON public.warmup_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own warmup tasks" ON public.warmup_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own warmup tasks" ON public.warmup_tasks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_warmup_tasks_updated_at
BEFORE UPDATE ON public.warmup_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();