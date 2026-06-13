-- Next-session overrides (one-off trainer prescriptions).
-- Additive: two nullable columns on the existing trainer_clients table.
-- The client reads them through the same row it already reads for the program
-- (client_can_read_own_slot SELECT policy), and the trainer writes them through
-- their existing update policy — so NO new RLS policy is needed.
--
-- Safe to run more than once (IF NOT EXISTS).

ALTER TABLE public.trainer_clients
  ADD COLUMN IF NOT EXISTS overrides_json       jsonb,
  ADD COLUMN IF NOT EXISTS overrides_updated_at timestamptz;
