
-- Create trigger function to give 3-day free trial on signup
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, status, plan_name, amount, paid_at, expires_at)
  VALUES (
    NEW.id,
    'active',
    'WhatsGuard Pro - Trial',
    0,
    now(),
    now() + interval '3 days'
  );
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users (via the existing handle_new_user pattern)
-- We'll call it from the existing handle_new_user function instead
-- Drop and recreate handle_new_user to include trial creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.subscriptions (user_id, status, plan_name, amount, paid_at, expires_at)
  VALUES (NEW.id, 'active', 'WhatsGuard Pro - Trial', 0, now(), now() + interval '3 days');
  
  RETURN NEW;
END;
$$;
