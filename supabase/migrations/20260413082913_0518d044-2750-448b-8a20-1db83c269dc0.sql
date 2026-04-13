-- Enable extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Enable realtime for warmup_tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.warmup_tasks;