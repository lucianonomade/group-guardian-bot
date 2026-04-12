
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Instances table (Evolution API connections)
CREATE TABLE public.instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own instances" ON public.instances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own instances" ON public.instances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own instances" ON public.instances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own instances" ON public.instances FOR DELETE USING (auth.uid() = user_id);

-- Groups table
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  group_jid TEXT NOT NULL,
  name TEXT NOT NULL,
  is_monitored BOOLEAN NOT NULL DEFAULT true,
  participant_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own groups" ON public.groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own groups" ON public.groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own groups" ON public.groups FOR DELETE USING (auth.uid() = user_id);

-- Warnings table
CREATE TABLE public.warnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  participant_jid TEXT NOT NULL,
  participant_name TEXT,
  reason TEXT NOT NULL,
  message_content TEXT,
  warning_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own warnings" ON public.warnings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own warnings" ON public.warnings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own warnings" ON public.warnings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own warnings" ON public.warnings FOR DELETE USING (auth.uid() = user_id);

-- Bans table
CREATE TABLE public.bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  participant_jid TEXT NOT NULL,
  participant_name TEXT,
  reason TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  banned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unbanned_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bans" ON public.bans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own bans" ON public.bans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bans" ON public.bans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bans" ON public.bans FOR DELETE USING (auth.uid() = user_id);

-- Blocked words table
CREATE TABLE public.blocked_words (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocked words" ON public.blocked_words FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own blocked words" ON public.blocked_words FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own blocked words" ON public.blocked_words FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own blocked words" ON public.blocked_words FOR DELETE USING (auth.uid() = user_id);

-- Action logs table
CREATE TABLE public.action_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  participant_jid TEXT,
  participant_name TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own action logs" ON public.action_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own action logs" ON public.action_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_instances_updated_at BEFORE UPDATE ON public.instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_warnings_group_participant ON public.warnings(group_id, participant_jid);
CREATE INDEX idx_bans_group_participant ON public.bans(group_id, participant_jid);
CREATE INDEX idx_blocked_words_user ON public.blocked_words(user_id);
CREATE INDEX idx_action_logs_user ON public.action_logs(user_id, created_at DESC);
CREATE INDEX idx_groups_instance ON public.groups(instance_id);
