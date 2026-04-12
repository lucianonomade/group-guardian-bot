
CREATE TABLE public.antiflood_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  max_messages INTEGER NOT NULL DEFAULT 5,
  time_window_seconds INTEGER NOT NULL DEFAULT 10,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (group_id)
);

ALTER TABLE public.antiflood_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own antiflood" ON public.antiflood_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own antiflood" ON public.antiflood_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own antiflood" ON public.antiflood_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own antiflood" ON public.antiflood_settings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_antiflood_settings_updated_at
BEFORE UPDATE ON public.antiflood_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
