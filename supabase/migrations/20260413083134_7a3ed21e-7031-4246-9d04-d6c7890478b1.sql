-- Add columns for custom messages and images
ALTER TABLE public.warmup_tasks
ADD COLUMN custom_messages TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN image_urls TEXT[] NOT NULL DEFAULT '{}';

-- Create storage bucket for warmup images
INSERT INTO storage.buckets (id, name, public) VALUES ('warmup-images', 'warmup-images', true);

-- Storage policies
CREATE POLICY "Anyone can view warmup images" ON storage.objects FOR SELECT USING (bucket_id = 'warmup-images');
CREATE POLICY "Authenticated users can upload warmup images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'warmup-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own warmup images" ON storage.objects FOR DELETE USING (bucket_id = 'warmup-images' AND auth.uid()::text = (storage.foldername(name))[1]);