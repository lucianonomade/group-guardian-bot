
DROP POLICY "Service role can update subscriptions" ON public.subscriptions;

CREATE POLICY "Users can update their own subscriptions"
ON public.subscriptions FOR UPDATE
USING (auth.uid() = user_id);
