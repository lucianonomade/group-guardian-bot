CREATE TABLE public.warmup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  warmup_task_id UUID NOT NULL REFERENCES public.warmup_tasks(id) ON DELETE CASCADE,
  target_number TEXT NOT NULL,
  message_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_details TEXT,
  day_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.warmup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own warmup logs" ON public.warmup_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own warmup logs" ON public.warmup_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_warmup_logs_task_id ON public.warmup_logs(warmup_task_id);
CREATE INDEX idx_warmup_logs_created_at ON public.warmup_logs(created_at DESC);