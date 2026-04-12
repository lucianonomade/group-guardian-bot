ALTER TABLE public.broadcasts ADD COLUMN scheduled_at timestamptz DEFAULT null;

CREATE INDEX idx_broadcasts_scheduled ON public.broadcasts (status, scheduled_at) WHERE scheduled_at IS NOT NULL;