-- Create push_subscriptions table for Web Push notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL DEFAULT '',
  auth text NOT NULL DEFAULT '',
  subscription_json text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own subscriptions
CREATE POLICY "Users can read own push subscription"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscription"
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscription"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscription"
  ON public.push_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can read all subscriptions (for Edge Function)
CREATE POLICY "Service role can read all push subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO service_role
  USING (true);

-- Enable realtime for push_subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;

-- Also ensure appointment_notifications has proper RLS for admin inserts
DO $$
BEGIN
  -- Allow admins to insert notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'appointment_notifications'
    AND policyname = 'Admins can insert notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can insert notifications"
      ON public.appointment_notifications FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = ''admin''
        )
      )';
  END IF;

  -- Allow patients to read their own notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'appointment_notifications'
    AND policyname = 'Patients can read own notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Patients can read own notifications"
      ON public.appointment_notifications FOR SELECT
      TO authenticated
      USING (auth.uid() = patient_id)';
  END IF;

  -- Allow patients to update their own notifications (mark as read)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'appointment_notifications'
    AND policyname = 'Patients can update own notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Patients can update own notifications"
      ON public.appointment_notifications FOR UPDATE
      TO authenticated
      USING (auth.uid() = patient_id)';
  END IF;
END $$;
