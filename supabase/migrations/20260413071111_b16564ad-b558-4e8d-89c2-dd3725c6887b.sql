
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  plan_name TEXT NOT NULL DEFAULT 'WhatsGuard Pro',
  amount INTEGER NOT NULL DEFAULT 10000,
  pepper_transaction_id TEXT,
  pix_code TEXT,
  pix_qrcode TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions"
ON public.subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update subscriptions"
ON public.subscriptions FOR UPDATE
USING (true);

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
