-- Fix RLS for opening heart messages
-- Run this in Supabase SQL Editor

BEGIN;

-- Ensure RLS is active
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Ensure authenticated users have UPDATE privilege at table level
GRANT UPDATE ON TABLE public.messages TO authenticated;

-- Allow receiver to mark received messages as opened
DROP POLICY IF EXISTS "Receiver can open received messages" ON public.messages;
CREATE POLICY "Receiver can open received messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

COMMIT;
