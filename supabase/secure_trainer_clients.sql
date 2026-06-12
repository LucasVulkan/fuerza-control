-- ============================================================================
-- Secure trainer_clients
--
-- Problem: the policy "Authenticated users can look up slots" was SELECT
-- USING (true) — any anonymous-authenticated user could read EVERY row
-- (all clients' program_json + history_json). The client-side
-- .eq('client_code', ...) filter is NOT enforced by RLS.
--
-- Fix: move the code lookup behind a SECURITY DEFINER function that only
-- ever returns the single row matching the exact code (no enumeration),
-- drop the open SELECT policy, and tighten the client UPDATE policy so
-- linking from an unclaimed slot happens only through the verified RPC.
--
-- Run order: this whole script is idempotent; run it once in the SQL editor.
-- ============================================================================

-- 1. Code lookup — returns only the slot whose client_code matches exactly.
--    Knowing the code is the authorization; you cannot list other rows.
create or replace function public.get_slot_by_code(p_code text)
returns table (
  id                 uuid,
  client_name        text,
  trainer_id         uuid,
  program_json       jsonb,
  program_updated_at timestamptz,
  client_id          uuid,
  history_updated_at timestamptz,
  trainer_name       text
)
language sql
security definer
set search_path = public
as $$
  select id, client_name, trainer_id, program_json, program_updated_at,
         client_id, history_updated_at, trainer_name
  from public.trainer_clients
  where client_code = upper(trim(p_code))
  limit 1;
$$;

-- 2. Link — binds the caller (auth.uid()) to the slot matching the code.
--    The code is a permanent reconnect credential (re-link allowed by design).
create or replace function public.link_client_to_slot(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_id uuid;
begin
  update public.trainer_clients
     set client_id = auth.uid(),
         disconnected_at = null
   where client_code = upper(trim(p_code))
  returning id into v_slot_id;

  if v_slot_id is null then
    raise exception 'Código no encontrado';
  end if;

  return v_slot_id;
end;
$$;

-- 3. Only authenticated users may call the RPCs.
revoke all on function public.get_slot_by_code(text)     from public;
revoke all on function public.link_client_to_slot(text)  from public;
grant execute on function public.get_slot_by_code(text)    to authenticated;
grant execute on function public.link_client_to_slot(text) to authenticated;

-- 4. Remove the open full-table SELECT policy.
drop policy if exists "Authenticated users can look up slots" on public.trainer_clients;

-- 5. Tighten the client UPDATE policy: only your own already-linked row.
--    Claiming an unclaimed slot now goes exclusively through link_client_to_slot().
drop policy if exists "Client can update their slot" on public.trainer_clients;
create policy "Client can update their slot"
  on public.trainer_clients
  for update
  to authenticated
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

-- ============================================================================
-- After this, the remaining SELECT access is:
--   * "Trainer manages their slots"  (ALL)    — trainer_id = auth.uid()
--   * "client_can_read_own_slot"     (SELECT) — client_id  = auth.uid()
-- i.e. you only ever read your own rows. The code lookup is the only way to
-- reach a slot you don't own yet, and it goes through get_slot_by_code().
-- ============================================================================
