-- ============================================================================
-- Conexión entrenador ↔ cliente — el esquema ENTERO, en un solo archivo.
--
-- Sustituye a connection_model.sql, secure_trainer_clients.sql,
-- release_client_slot.sql y overrides_column.sql, que se fueron pisando unos a
-- otros (volver a ejecutar el segundo restauraba un `link_client_to_slot` que
-- desalojaba a cualquiera). Este es la única fuente: lo que hay aquí es lo que
-- hay en Supabase. Idempotente: se ejecuta entero las veces que haga falta.
--
-- Lo prueban de verdad los tests de simulación (`test/supabaseSim.js` lo carga
-- en un Postgres real, PGlite) con el store de la app encima. Si cambias algo
-- aquí, `npx vitest run mobile/store/connection.sim.test.js`.
--
-- ── El modelo ───────────────────────────────────────────────────────────────
-- Cada fila de `trainer_clients` es un HUECO con dos asientos:
--   trainer_id  el dueño (entrenador). Nunca vacío.
--   client_id   el ocupante (cliente). Puede estar vacío.
--
-- Estados:   INVITADO  client_id null, disconnected_at null
--            CONECTADO client_id no null
--            SE FUE    client_id null, disconnected_at fecha (se desconectó él)
--
-- ── Las reglas, y dónde se hacen cumplir ────────────────────────────────────
--  1. Un asiento vacío se ocupa con el código. Uno ocupado solo lo suelta quien
--     está sentado o el dueño (reemitiendo).          → link_client_to_slot
--  2. Un cliente ocupa como mucho UN asiento.         → índice único + link
--  3. Nadie escribe la tabla directamente: TODA escritura es una función que
--     comprueba de quién es la fila y FALLA con un código si no la encuentra.
--     Antes un `update` filtrado por RLS daba 0 filas y ningún error, y la app
--     daba por enviado lo que no había llegado.     → sin políticas de escritura
--  4. Solo se cede lo propio, y solo a una cuenta que existe y no es anónima.
--                                                    → transfer_my_*
--
-- Códigos de error (la app ramifica por ellos, `supabaseSync.js`):
--   NOT_AUTHENTICATED  NOT_A_TRAINER  CODE_NOT_FOUND  SLOT_OCCUPIED  SLOT_GONE
--   NO_SEAT  SEAT_TAKEN  BAD_TARGET  CODE_GENERATION_FAILED
-- ============================================================================


-- ── 1. Tablas ───────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id   uuid primary key,
  role text
);

create table if not exists public.trainer_clients (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null,
  created_at timestamptz not null default now()
);

-- Una a una, para que valga igual sobre la tabla que ya existe en Supabase.
alter table public.trainer_clients add column if not exists client_id            uuid;
alter table public.trainer_clients add column if not exists client_name          text;
alter table public.trainer_clients add column if not exists client_code          text;
alter table public.trainer_clients add column if not exists trainer_name         text;
alter table public.trainer_clients add column if not exists program_json         jsonb;
alter table public.trainer_clients add column if not exists program_updated_at   timestamptz;
alter table public.trainer_clients add column if not exists history_json         jsonb;
alter table public.trainer_clients add column if not exists history_updated_at   timestamptz;
alter table public.trainer_clients add column if not exists sessions_count       integer not null default 0;
alter table public.trainer_clients add column if not exists overrides_json       jsonb;
alter table public.trainer_clients add column if not exists overrides_updated_at timestamptz;
alter table public.trainer_clients add column if not exists disconnected_at      timestamptz;


-- ── 2. Códigos de cliente ───────────────────────────────────────────────────
-- Sin caracteres ambiguos (ni I, ni O, ni 0, ni 1): se dictan por teléfono.
-- Los genera SIEMPRE el servidor, que es quien puede comprobar que no existen.
create or replace function public.new_client_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code  text;
begin
  for v_try in 1..10 loop
    v_code := '';
    for i in 1..8 loop
      if i = 5 then v_code := v_code || '-'; end if;
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    end loop;
    if not exists (select 1 from public.trainer_clients where client_code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'CODE_GENERATION_FAILED';
end;
$$;


-- ── 3. Limpieza de lo que dejaron los fallos de antes ───────────────────────
-- Antes de las restricciones, que si no fallarían sobre datos viejos. La app no
-- está publicada: lo que se toca aquí son datos de prueba.

-- Huecos de entrenadores que ya no existen.
delete from public.trainer_clients t
 where not exists (select 1 from auth.users u where u.id = t.trainer_id);

-- Asientos ocupados por usuarios que ya no existen.
update public.trainer_clients t
   set client_id = null, disconnected_at = coalesce(disconnected_at, now())
 where client_id is not null
   and not exists (select 1 from auth.users u where u.id = t.client_id);

-- Un cliente en varios asientos (cambiar de entrenador no soltaba el viejo):
-- se queda el más reciente, los demás se sueltan como un `release`.
with ranked as (
  select id, row_number() over (partition by client_id order by created_at desc) as rn
    from public.trainer_clients
   where client_id is not null
)
update public.trainer_clients t
   set client_id = null, disconnected_at = now(),
       history_json = null, history_updated_at = null, sessions_count = 0,
       overrides_json = null, overrides_updated_at = null
  from ranked r
 where t.id = r.id and r.rn > 1;

-- Códigos repetidos o vacíos: código nuevo.
with ranked as (
  select id, row_number() over (partition by client_code order by created_at) as rn
    from public.trainer_clients
)
update public.trainer_clients t
   set client_code = public.new_client_code()
  from ranked r
 where t.id = r.id and (r.rn > 1 or t.client_code is null);


-- ── 4. Restricciones: las reglas que no dependen de que la app lo haga bien ──

alter table public.trainer_clients alter column client_code set not null;

create unique index if not exists trainer_clients_code_key on public.trainer_clients (client_code);
create unique index if not exists trainer_clients_one_seat on public.trainer_clients (client_id) where client_id is not null;
create index        if not exists trainer_clients_trainer  on public.trainer_clients (trainer_id);

-- Borrar un usuario (aunque sea desde el panel de Supabase) se lleva sus huecos
-- de entrenador y suelta su asiento de cliente. Nada queda apuntando a nadie.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trainer_clients_trainer_fk') then
    alter table public.trainer_clients
      add constraint trainer_clients_trainer_fk foreign key (trainer_id)
      references auth.users (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trainer_clients_client_fk') then
    alter table public.trainer_clients
      add constraint trainer_clients_client_fk foreign key (client_id)
      references auth.users (id) on delete set null;
  end if;
end $$;


-- ── 5. Permisos de la tabla: solo leer lo tuyo ──────────────────────────────

alter table public.trainer_clients enable row level security;
alter table public.profiles        enable row level security;

-- Fuera TODAS las políticas que hubiera (nombres viejos incluidos): las de
-- escritura dejaban al cliente cambiar `trainer_id` o `program_json` de su fila.
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
            where schemaname = 'public' and tablename in ('trainer_clients', 'profiles')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy trainer_reads_own_slots on public.trainer_clients
  for select to authenticated using (trainer_id = auth.uid());
create policy client_reads_own_seat on public.trainer_clients
  for select to authenticated using (client_id = auth.uid());

revoke all    on public.trainer_clients from anon, authenticated;
grant  select on public.trainer_clients to authenticated;

create policy own_profile on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke all on public.profiles from anon, authenticated;
grant  select, insert, update on public.profiles to authenticated;


-- ── 6. Quién llama ──────────────────────────────────────────────────────────

create or replace function public._caller()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  return auth.uid();
end;
$$;

-- Entrenador = cuenta de verdad (código, Google o Apple), nunca anónima.
create or replace function public._trainer()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare v uuid := public._caller();
begin
  if exists (select 1 from auth.users where id = v and is_anonymous) then
    raise exception 'NOT_A_TRAINER';
  end if;
  return v;
end;
$$;

-- A quién se le puede ceder algo: a una cuenta que existe y no es anónima.
create or replace function public._check_target(p_target uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_target is null or not exists (
    select 1 from auth.users where id = p_target and not coalesce(is_anonymous, false)
  ) then
    raise exception 'BAD_TARGET';
  end if;
end;
$$;


-- ── 7. Entrenador ───────────────────────────────────────────────────────────

create or replace function public.trainer_create_slot(p_client_name text)
returns table (slot_id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid := public._trainer();
  v_code text := public.new_client_code();
  v_id   uuid;
begin
  insert into public.trainer_clients (trainer_id, client_name, client_code)
  values (v_me, p_client_name, v_code)
  returning id into v_id;
  return query select v_id, v_code;
end;
$$;

create or replace function public.trainer_upload_program(p_slot_id uuid, p_program jsonb, p_trainer_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trainer_clients
     set program_json = p_program, program_updated_at = now(), trainer_name = p_trainer_name
   where id = p_slot_id and trainer_id = public._trainer();
  if not found then raise exception 'SLOT_GONE'; end if;
end;
$$;

create or replace function public.trainer_upload_overrides(p_slot_id uuid, p_overrides jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trainer_clients
     set overrides_json = coalesce(p_overrides, '{}'::jsonb), overrides_updated_at = now()
   where id = p_slot_id and trainer_id = public._trainer();
  if not found then raise exception 'SLOT_GONE'; end if;
end;
$$;

-- Lo que el entrenador apuntó a un cliente que aún no ha entrado (C20). Solo
-- con el asiento vacío, y comprobado en la MISMA sentencia que escribe: antes se
-- leía, se esperaba y se escribía, y en medio podía entrar el cliente.
create or replace function public.trainer_upload_log(p_slot_id uuid, p_history jsonb, p_sessions integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_me uuid := public._trainer();
begin
  update public.trainer_clients
     set history_json = p_history, history_updated_at = now(), sessions_count = coalesce(p_sessions, 0)
   where id = p_slot_id and trainer_id = v_me and client_id is null;
  if found then return; end if;
  if exists (select 1 from public.trainer_clients where id = p_slot_id and trainer_id = v_me) then
    raise exception 'SLOT_OCCUPIED';
  end if;
  raise exception 'SLOT_GONE';
end;
$$;

create or replace function public.trainer_set_name(p_trainer_name text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.trainer_clients set trainer_name = p_trainer_name where trainer_id = public._trainer();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Borrar un hueco que ya no está no es un error: devuelve false.
create or replace function public.trainer_delete_slot(p_slot_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.trainer_clients where id = p_slot_id and trainer_id = public._trainer();
  return found;
end;
$$;

-- Código nuevo Y asiento libre, a la vez: un código nuevo sobre un asiento
-- ocupado no serviría de nada. Conserva el historial (vuelve la misma persona:
-- reinstaló siendo anónima, perdió el código o se filtró). El hueco vuelve a
-- INVITADO (`disconnected_at` null): sigue siendo cliente tuyo, no se fue.
create or replace function public.trainer_reissue_client_code(p_slot_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_code text := public.new_client_code();
begin
  update public.trainer_clients
     set client_code = v_code, client_id = null, disconnected_at = null
   where id = p_slot_id and trainer_id = public._trainer();
  if not found then raise exception 'SLOT_GONE'; end if;
  return v_code;
end;
$$;

-- El entrenador cede TODOS sus huecos a su cuenta nueva al cambiar de forma de
-- entrar. Se llama con la sesión de la cuenta VIEJA: solo regalas lo tuyo.
create or replace function public.transfer_my_slots_to(p_new_trainer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    uuid := public._trainer();
  v_count integer;
begin
  perform public._check_target(p_new_trainer_id);
  update public.trainer_clients set trainer_id = p_new_trainer_id where trainer_id = v_me;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ── 8. Cliente ──────────────────────────────────────────────────────────────

-- Lo justo para la pantalla de confirmar. Ni el programa ni ids: un código
-- filtrado no vale como llave de lectura.
drop function if exists public.get_slot_by_code(text);
create function public.get_slot_by_code(p_code text)
returns table (
  id                 uuid,
  client_name        text,
  program_name       text,
  program_updated_at timestamptz,
  is_linked          boolean,
  is_mine            boolean,
  history_updated_at timestamptz,
  trainer_name       text
)
language sql
security definer
set search_path = public
as $$
  select t.id, t.client_name, t.program_json -> 'program' ->> 'name', t.program_updated_at,
         t.client_id is not null, coalesce(t.client_id = auth.uid(), false), t.history_updated_at, t.trainer_name
    from public.trainer_clients t
   where t.client_code = upper(trim(p_code))
   limit 1;
$$;

-- Entrar con el código. Ocupar es UNA sentencia condicionada (dos clientes a la
-- vez con el mismo código: entra uno, el otro recibe SLOT_OCCUPIED). Y como un
-- cliente ocupa un solo asiento, entrar en uno suelta el que tuviera — así
-- «cambiar de entrenador» no deja al anterior con un fantasma dentro.
create or replace function public.link_client_to_slot(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid := public._caller();
  v_slot uuid;
begin
  select id into v_slot from public.trainer_clients where client_code = upper(trim(p_code));
  if v_slot is null then raise exception 'CODE_NOT_FOUND'; end if;

  update public.trainer_clients
     set client_id = null, disconnected_at = now(),
         history_json = null, history_updated_at = null, sessions_count = 0,
         overrides_json = null, overrides_updated_at = null
   where client_id = v_me and id <> v_slot;

  update public.trainer_clients
     set client_id = v_me, disconnected_at = null
   where id = v_slot and (client_id is null or client_id = v_me);
  if not found then raise exception 'SLOT_OCCUPIED'; end if;

  return v_slot;
end;
$$;

-- El cliente sube lo suyo a SU asiento: no hace falta decir cuál, es el suyo.
create or replace function public.client_upload_history(p_history jsonb, p_sessions integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_slot uuid;
begin
  update public.trainer_clients
     set history_json = p_history, history_updated_at = now(), sessions_count = coalesce(p_sessions, 0)
   where client_id = public._caller()
  returning id into v_slot;
  if v_slot is null then raise exception 'NO_SEAT'; end if;
  return v_slot;
end;
$$;

-- Se desconecta él: suelta el asiento y borra lo suyo (el entrenador puede dar
-- ese código a otra persona). Deja programa, nombre y código, que son del dueño.
create or replace function public.release_client_slot()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.trainer_clients
     set client_id = null, disconnected_at = now(),
         history_json = null, history_updated_at = null, sessions_count = 0,
         overrides_json = null, overrides_updated_at = null
   where client_id = public._caller();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- El cliente pasa su asiento a su cuenta de Google/Apple. Con la sesión VIEJA
-- (la anónima): solo regalas lo tuyo. Si esa cuenta ya ocupa otro asiento, la
-- app lo suelta antes con la sesión de esa cuenta (prueba de que es suya).
create or replace function public.transfer_my_seat_to(p_new_client_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    uuid := public._caller();
  v_count integer;
begin
  if p_new_client_id = v_me then return 0; end if;
  perform public._check_target(p_new_client_id);
  if exists (select 1 from public.trainer_clients where client_id = p_new_client_id) then
    raise exception 'SEAT_TAKEN';
  end if;
  update public.trainer_clients set client_id = p_new_client_id where client_id = v_me;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ── 9. Lo que ya no existe ──────────────────────────────────────────────────
-- `claim_trainer_slots` dejaba a cualquiera apropiarse de huecos ajenos;
-- `transfer_client_slot` se sustituye por `transfer_my_seat_to`.
drop function if exists public.claim_trainer_slots(uuid[]);
drop function if exists public.transfer_client_slot(uuid, uuid, uuid);


-- ── 10. Quién puede llamar a qué ────────────────────────────────────────────
-- Una función nace ejecutable por PUBLIC: se revoca todo y se concede una a una.
do $$
declare f text;
begin
  foreach f in array array[
    'new_client_code()', '_caller()', '_trainer()', '_check_target(uuid)',
    'trainer_create_slot(text)', 'trainer_upload_program(uuid, jsonb, text)',
    'trainer_upload_overrides(uuid, jsonb)', 'trainer_upload_log(uuid, jsonb, integer)',
    'trainer_set_name(text)', 'trainer_delete_slot(uuid)', 'trainer_reissue_client_code(uuid)',
    'transfer_my_slots_to(uuid)', 'get_slot_by_code(text)', 'link_client_to_slot(text)',
    'client_upload_history(jsonb, integer)', 'release_client_slot()', 'transfer_my_seat_to(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;

  foreach f in array array[
    'trainer_create_slot(text)', 'trainer_upload_program(uuid, jsonb, text)',
    'trainer_upload_overrides(uuid, jsonb)', 'trainer_upload_log(uuid, jsonb, integer)',
    'trainer_set_name(text)', 'trainer_delete_slot(uuid)', 'trainer_reissue_client_code(uuid)',
    'transfer_my_slots_to(uuid)', 'get_slot_by_code(text)', 'link_client_to_slot(text)',
    'client_upload_history(jsonb, integer)', 'release_client_slot()', 'transfer_my_seat_to(uuid)'
  ] loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
