-- Broadcasts table
CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  message text NOT NULL,
  image_url text,
  target_groups text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  sent_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own broadcasts" ON public.broadcasts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own broadcasts" ON public.broadcasts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own broadcasts" ON public.broadcasts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own broadcasts" ON public.broadcasts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_broadcasts_updated_at
  BEFORE UPDATE ON public.broadcasts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for broadcast images
INSERT INTO storage.buckets (id, name, public) VALUES ('broadcast-images', 'broadcast-images', true);

CREATE POLICY "Anyone can view broadcast images" ON storage.objects FOR SELECT USING (bucket_id = 'broadcast-images');
CREATE POLICY "Authenticated users can upload broadcast images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'broadcast-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own broadcast images" ON storage.objects FOR DELETE USING (bucket_id = 'broadcast-images' AND auth.uid()::text = (storage.foldername(name))[1]);