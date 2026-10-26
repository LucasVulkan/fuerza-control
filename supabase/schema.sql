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
--  1. El código es la llave del cliente: con él se entra, y quien estuviera
--     dentro sale (y se le dice) — salvo que haya entrado con Google/Apple:
--     a ese solo lo sustituye su misma cuenta. Reemitir el código lo revoca
--     y libera el asiento.                           → link_client_to_slot
--  2. Un cliente ocupa como mucho UN asiento.         → índice único + link
--  3. Nadie escribe la tabla directamente: TODA escritura es una función que
--     comprueba de quién es la fila y FALLA con un código si no la encuentra.
--     Antes un `update` filtrado por RLS daba 0 filas y ningún error, y la app
--     daba por enviado lo que no había llegado.     → sin políticas de escritura
--  4. Un traspaso (de huecos o de asiento) necesita las DOS sesiones: la que
--     cede hace una oferta y la que recibe la acepta, en menos de 10 minutos.
--     Nadie planta nada en una cuenta que no lo acepta.
--                                                    → offer_transfer + accept_transfer
--
-- Códigos de error (la app ramifica por ellos, `supabaseSync.js`):
--   NOT_AUTHENTICATED  NOT_A_TRAINER  CODE_NOT_FOUND  SEAT_LOCKED  SLOT_OCCUPIED (C20)  SLOT_GONE
--   NO_SEAT  SEAT_TAKEN  BAD_TARGET  NO_OFFER  CODE_GENERATION_FAILED
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
-- El id con que el entrenador conoce al cliente en su móvil: hace repetible el alta (E35).
alter table public.trainer_clients add column if not exists local_id             text;
-- Antes guardaban aquí quién desalojó a quién; ahora es `seat_losses`, por usuario.
alter table public.trainer_clients drop column if exists displaced_client_id;
alter table public.trainer_clients drop column if exists displaced_at;


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
   set client_id = null, disconnected_at = now()
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
create unique index if not exists trainer_clients_local_id on public.trainer_clients (trainer_id, local_id) where local_id is not null;

-- Borrar un usuario (aunque sea desde el panel de Supabase) se lleva sus huecos
-- de entrenador y su perfil, y suelta su asiento de cliente. Nada queda
-- apuntando a nadie. La de `profiles` va `not valid`: no falla si ya hay
-- perfiles huérfanos (los señala `audit.sql`), pero los nuevos sí se comprueban.
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
  if not exists (select 1 from pg_constraint where conname = 'profiles_id_fk') then
    alter table public.profiles
      add constraint profiles_id_fk foreign key (id)
      references auth.users (id) on delete cascade not valid;
  end if;
end $$;

-- Borrar al cliente desde el panel de Supabase lo deja «se fue», no invitado:
-- la FK sola suelta el asiento sin `disconnected_at` (E36). No es un trigger de
-- `trainer_clients` porque `trainer_reissue_client_code` suelta el asiento sin
-- fecha a propósito (vuelve a invitado).
create or replace function public._release_seat_of_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trainer_clients set client_id = null, disconnected_at = now() where client_id = old.id;
  return old;
end;
$$;
drop trigger if exists release_seat_of_deleted_user on auth.users;
create trigger release_seat_of_deleted_user before delete on auth.users
  for each row execute function public._release_seat_of_deleted_user();


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

-- Ofertas de traspaso (E29): quien cede deja aquí «te doy mis huecos / mi
-- asiento» y quien recibe la acepta con SU sesión. Una por cedente y tipo. Sin
-- políticas ni permisos, como `trainer_clients`: solo las funciones la tocan.
create table if not exists public.transfer_offers (
  from_id    uuid not null,
  to_id      uuid not null,
  kind       text not null check (kind in ('slots', 'seat')),
  created_at timestamptz not null default now(),
  primary key (from_id, kind)
);
alter table public.transfer_offers enable row level security;
revoke all on public.transfer_offers from anon, authenticated;

-- Por qué perdió el asiento cada cliente (E34), para decírselo. Una fila por
-- usuario: 'taken' (alguien entró con su código) o 'gone' (el entrenador lo
-- quitó). Sin fila, 'gone'. Sin políticas ni permisos, como `transfer_offers`.
create table if not exists public.seat_losses (
  client_id uuid primary key references auth.users on delete cascade,
  reason    text not null,
  at        timestamptz not null default now()
);
alter table public.seat_losses enable row level security;
revoke all on public.seat_losses from anon, authenticated;

-- Qué huecos borró cada entrenador y con qué intención (E61-E63), para que sus
-- otros móviles lo apliquen: 'deleted' (borró al cliente) o 'cancelled'
-- (canceló su invitación). Sin políticas ni permisos, como `seat_losses`.
-- ponytail: no se poda; son ids.
create table if not exists public.deleted_slots (
  slot_id    uuid primary key,
  trainer_id uuid not null references auth.users on delete cascade,
  kind       text not null check (kind in ('deleted', 'cancelled')),
  at         timestamptz not null default now()
);
alter table public.deleted_slots enable row level security;
revoke all on public.deleted_slots from anon, authenticated;


-- ── 6. Quién llama ──────────────────────────────────────────────────────────

-- Un asiento ocupado por una cuenta de verdad (Google/Apple) no lo quita un
-- código: devuelve con qué está protegido ('google', 'apple' o 'account'), o
-- null si el ocupante es anónimo (entró solo con el código) o no hay nadie.
create or replace function public._locked_by(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when u.id is null or coalesce(u.is_anonymous, false) then null
              else coalesce((select i.provider from auth.identities i
                              where i.user_id = u.id and i.provider in ('google', 'apple')
                              limit 1), 'account') end
    from (select p_user as id) x
    left join auth.users u on u.id = x.id;
$$;

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

-- Suma lo que sube el cliente (o el entrenador, C20) a lo que ya hay (R-C2,
-- R-C3: el historial solo crece). `entries` por `id`: las viejas que la subida
-- no trae se conservan, y si el id se repite gana la de mayor `updatedAt` (ms;
-- sin él, 0; empate, la que llega: E58); las que no tienen `id` se conservan
-- todas. Lo borrado viaja como lápida `{ id, deletedAt, updatedAt }` y gana por
-- esa misma regla (E59). `customExercises` se funde (gana la nueva) y
-- `progress` es el nuevo si lo hay. Interna: nadie la llama desde fuera.
create or replace function public._merge_history(p_old jsonb, p_new jsonb)
returns jsonb
language sql
immutable
as $$
  select case when p_old is null then p_new else jsonb_build_object(
    'entries', coalesce((
        select jsonb_agg(e order by o)
          from jsonb_array_elements(coalesce(p_old->'entries', '[]'::jsonb)) with ordinality as t(e, o)
         where not exists (select 1 from jsonb_array_elements(coalesce(p_new->'entries', '[]'::jsonb)) n
                            where n->>'id' = e->>'id'
                              and (case jsonb_typeof(n->'updatedAt') when 'number' then (n->>'updatedAt')::numeric else 0 end) >= (case jsonb_typeof(e->'updatedAt') when 'number' then (e->>'updatedAt')::numeric else 0 end))
      ), '[]'::jsonb) || coalesce((
        select jsonb_agg(n order by o)
          from jsonb_array_elements(coalesce(p_new->'entries', '[]'::jsonb)) with ordinality as t(n, o)
         where not exists (select 1 from jsonb_array_elements(coalesce(p_old->'entries', '[]'::jsonb)) e
                            where e->>'id' = n->>'id'
                              and (case jsonb_typeof(e->'updatedAt') when 'number' then (e->>'updatedAt')::numeric else 0 end) > (case jsonb_typeof(n->'updatedAt') when 'number' then (n->>'updatedAt')::numeric else 0 end))
      ), '[]'::jsonb),
    'customExercises', coalesce(nullif(p_old->'customExercises', 'null'::jsonb), '{}'::jsonb)
                    || coalesce(nullif(p_new->'customExercises', 'null'::jsonb), '{}'::jsonb),
    -- `progress: null` llega de verdad (sin programa activo): es null de JSON, no de SQL.
    'progress', coalesce(nullif(p_new->'progress', 'null'::jsonb), p_old->'progress')
  ) end;
$$;


-- ── 7. Entrenador ───────────────────────────────────────────────────────────

-- Con `p_local_id`, repetir el alta (la respuesta se perdió) devuelve el mismo
-- hueco en vez de crear otro; dos a la vez también dan el mismo (E35).
drop function if exists public.trainer_create_slot(text);
create or replace function public.trainer_create_slot(p_client_name text, p_local_id text default null)
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
  insert into public.trainer_clients (trainer_id, client_name, client_code, local_id)
  values (v_me, p_client_name, v_code, p_local_id)
  on conflict (trainer_id, local_id) where local_id is not null do nothing
  returning id into v_id;
  if v_id is null then
    select t.id, t.client_code into v_id, v_code
      from public.trainer_clients t where t.trainer_id = v_me and t.local_id = p_local_id;
  end if;
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
-- con el asiento vacío (y suma, como `client_upload_history`), y comprobado en la MISMA sentencia que escribe: antes se
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
     set history_json = public._merge_history(history_json, p_history), history_updated_at = now(),
         sessions_count = (select count(*) from jsonb_array_elements(coalesce(public._merge_history(history_json, p_history)->'entries', '[]'::jsonb)) e where e->>'deletedAt' is null)
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

-- De estos ids, los que ESTA cuenta borró o canceló (E60-E62): así su otro móvil
-- sabe qué hacer con un hueco que ya no está. Los que faltan sin estar aquí son
-- de otra cuenta. Solo devuelve ids que quien llama ya conoce.
drop function if exists public.trainer_slots_alive(uuid[]);
create or replace function public.trainer_deleted_slots(p_ids uuid[])
returns table (slot_id uuid, kind text)
language plpgsql
security definer
set search_path = public
as $$
declare v_me uuid := public._trainer();
begin
  -- Con la cuenta ya borrada y el JWT aún válido, la respuesta vacía no vale como «no los borraste».
  if not exists (select 1 from auth.users where id = v_me) then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  return query select d.slot_id, d.kind from public.deleted_slots d
   where d.slot_id = any(p_ids) and d.trainer_id = v_me;
end;
$$;

-- Borrar un hueco que ya no está no es un error: devuelve false. Anota el
-- borrado en `deleted_slots`, con `p_kind` ('deleted' por omisión: las
-- versiones anteriores, que cancelan sin decirlo, quedan como borrado).
drop function if exists public.trainer_delete_slot(uuid);
create or replace function public.trainer_delete_slot(p_slot_id uuid, p_kind text default 'deleted')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me     uuid := public._trainer();
  v_client uuid;
begin
  delete from public.trainer_clients where id = p_slot_id and trainer_id = v_me
  returning client_id into v_client;
  if not found then return false; end if;
  insert into public.deleted_slots (slot_id, trainer_id, kind) values (p_slot_id, v_me, p_kind)
  on conflict do nothing;
  if v_client is not null then
    insert into public.seat_losses (client_id, reason) values (v_client, 'gone')
    on conflict (client_id) do update set reason = 'gone', at = now();
  end if;
  return true;
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
declare
  v_code   text := public.new_client_code();
  v_client uuid;
begin
  select client_id into v_client from public.trainer_clients
   where id = p_slot_id and trainer_id = public._trainer() for update;
  if not found then raise exception 'SLOT_GONE'; end if;
  update public.trainer_clients
     set client_code = v_code, client_id = null, disconnected_at = null
   where id = p_slot_id;
  if v_client is not null then
    insert into public.seat_losses (client_id, reason) values (v_client, 'gone')
    on conflict (client_id) do update set reason = 'gone', at = now();
  end if;
  return v_code;
end;
$$;


-- ── 8. Cliente ──────────────────────────────────────────────────────────────

-- Lo justo para la pantalla de confirmar: tres nombres y cuatro sí/no. Ni el
-- programa, ni ids, ni horas: un código filtrado no vale como llave de lectura.
drop function if exists public.get_slot_by_code(text);
create function public.get_slot_by_code(p_code text)
returns table (
  client_name        text,
  program_name       text,
  trainer_name       text,
  is_linked          boolean,
  is_mine            boolean,
  locked_by          text,
  has_history        boolean
)
language sql
security definer
set search_path = public
as $$
  select t.client_name, t.program_json -> 'program' ->> 'name', t.trainer_name,
         t.client_id is not null, coalesce(t.client_id = auth.uid(), false),
         case when t.client_id <> coalesce(auth.uid(), t.client_id) or auth.uid() is null
              then public._locked_by(t.client_id) end,
         t.history_updated_at is not null
    from public.trainer_clients t
   where t.client_code = upper(trim(p_code))
   limit 1;
$$;

-- Entrar con el código. EL CÓDIGO SIEMPRE VALE (decisión del 16-oct-2026, C09
-- §4.6), salvo contra quien entró con Google/Apple (§4.7, SEAT_LOCKED): una
-- cuenta así solo la tiene esa persona, el código lo puede tener cualquiera.
-- Para los demás, el código es la llave del cliente. El servidor no puede saber si quien está
-- dentro perdió su móvil (reinstalar deja su sesión viva aquí), así que en vez
-- de pedir un código nuevo cada vez, quien trae el código entra y el de dentro
-- sale — y se le dice que alguien entró con su código (`client_lost_reason`).
-- Revocar un código filtrado sigue siendo reemitirlo.
--
-- La fila se bloquea (`for update`): dos a la vez con el mismo código entran
-- uno detrás de otro y se queda el último. Y como un cliente ocupa un solo
-- asiento, entrar en uno suelta el que tuviera: «cambiar de entrenador» no deja
-- al anterior con un fantasma dentro.
create or replace function public.link_client_to_slot(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid := public._caller();
  v_slot uuid;
  v_prev uuid;
begin
  select id, client_id into v_slot, v_prev
    from public.trainer_clients where client_code = upper(trim(p_code))
     for update;
  if v_slot is null then raise exception 'CODE_NOT_FOUND'; end if;
  -- Dentro hay alguien con Google/Apple: el código no lo echa (C09 §4.7).
  if v_prev is not null and v_prev <> v_me and public._locked_by(v_prev) is not null then
    raise exception 'SEAT_LOCKED';
  end if;

  -- Soltar el asiento viejo no borra nada del hueco (R-B6): el historial y las
  -- prescripciones se quedan donde estaban, para el entrenador.
  update public.trainer_clients
     set client_id = null, disconnected_at = now()
   where client_id = v_me and id <> v_slot;

  update public.trainer_clients
     set client_id = v_me, disconnected_at = null
   where id = v_slot;

  -- Al que sale se le dice por qué (`client_lost_reason`); el que entra vuelve a tener asiento.
  if v_prev is not null and v_prev <> v_me then
    insert into public.seat_losses (client_id, reason) values (v_prev, 'taken')
    on conflict (client_id) do update set reason = 'taken', at = now();
  end if;
  delete from public.seat_losses where client_id = v_me;

  return v_slot;
end;
$$;

-- ¿Por qué ya no tengo asiento? 'taken': alguien entró con mi código (si no
-- fui yo en otro móvil, que me reemitan uno). 'gone': me desconectó el
-- entrenador (borrado, código reemitido o cuenta borrada). Es el último motivo
-- que anotaron las funciones en `seat_losses`; sin fila, 'gone'.
create or replace function public.client_lost_reason()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select reason from public.seat_losses where client_id = auth.uid()), 'gone');
$$;

-- El cliente sube lo suyo a SU asiento. SUMA al historial del hueco (E28, R-C2):
-- dos móviles o una reinstalación ya no se pisan. `p_sessions` se ignora (el
-- contador sale de lo fusionado, sin lápidas); sigue en la firma por
-- compatibilidad. `p_slot_id` dice a qué asiento iba la subida (E37): si el
-- cliente ya está en otro, SLOT_CHANGED y no se escribe nada. Sin él (móviles
-- con la versión vieja), el asiento que tenga.
drop function if exists public.client_upload_history(jsonb, integer);
create or replace function public.client_upload_history(p_history jsonb, p_sessions integer, p_slot_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_slot uuid;
begin
  update public.trainer_clients
     set history_json = public._merge_history(history_json, p_history), history_updated_at = now(),
         sessions_count = (select count(*) from jsonb_array_elements(coalesce(public._merge_history(history_json, p_history)->'entries', '[]'::jsonb)) e where e->>'deletedAt' is null)
   where client_id = public._caller() and (p_slot_id is null or id = p_slot_id)
  returning id into v_slot;
  if v_slot is null then
    if p_slot_id is not null and exists (select 1 from public.trainer_clients where client_id = public._caller()) then
      raise exception 'SLOT_CHANGED';
    end if;
    raise exception 'NO_SEAT';
  end if;
  return v_slot;
end;
$$;

-- Se desconecta él: suelta el asiento y nada más (R-B6). El historial, las
-- prescripciones, el programa, el nombre y el código se quedan en el hueco: son
-- del entrenador, que decide qué hacer con ellos. Solo borrar la cuenta vacía
-- el historial del cliente (`delete-account`, excepción de R-C4).
create or replace function public.release_client_slot()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.trainer_clients
     set client_id = null, disconnected_at = now()
   where client_id = public._caller();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ── 8b. Traspasos: oferta y aceptación ──────────────────────────────────────
-- Cambiar de forma de entrar (entrenador) o vincular Google/Apple (cliente)
-- mueve cosas de una cuenta a otra. Antes lo hacía una sola llamada de la
-- cuenta vieja a cualquier uuid, y servía para plantar huecos o un asiento en
-- una cuenta ajena. Ahora son dos pasos, cada uno con su sesión:
--   offer_transfer  la cuenta que cede (vieja) anota «esto es para <to>».
--                   No comprueba a quién: así no sirve de oráculo de uuids.
--   accept_transfer la cuenta que recibe (nueva) lo acepta; solo vale una
--                   oferta dirigida a ella y de menos de 10 minutos.
-- Repetir los dos pasos tras un corte es seguro: lo ya movido no se mueve otra vez.
-- ponytail: las ofertas viejas no se barren (una fila por cedente y tipo, se pisa
-- sola); barrerlas si algún día molestan.
create or replace function public.offer_transfer(p_kind text, p_to uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_me uuid := case when p_kind = 'slots' then public._trainer() else public._caller() end;
begin
  insert into public.transfer_offers (from_id, to_id, kind, created_at)
  values (v_me, p_to, p_kind, now())
  on conflict (from_id, kind) do update set to_id = excluded.to_id, created_at = now();
end;
$$;

-- Devuelve las filas movidas. 'slots': todos los huecos de p_from pasan al que
-- llama. 'seat': el asiento de p_from pasa al que llama. SEAT_TAKEN si los dos
-- tienen asiento; NO_SEAT si ninguno lo tiene; 0 si solo lo tiene el destino:
-- es el reintento tras un corte (la app suelta antes cualquier otro asiento
-- suyo, así que el que tiene es el que se le pasó).
create or replace function public.accept_transfer(p_kind text, p_from uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me      uuid := auth.uid();
  v_count   integer := 0;
  v_to_seat boolean;
  v_from_seat boolean;
begin
  perform public._check_target(v_me);
  delete from public.transfer_offers
   where from_id = p_from and kind = p_kind and to_id = v_me
     and created_at > now() - interval '10 minutes';
  if not found then raise exception 'NO_OFFER'; end if;

  if p_kind = 'slots' then
    update public.trainer_clients set trainer_id = v_me, local_id = null where trainer_id = p_from;
    get diagnostics v_count = row_count;
  else
    v_to_seat   := exists (select 1 from public.trainer_clients where client_id = v_me);
    v_from_seat := exists (select 1 from public.trainer_clients where client_id = p_from);
    if v_from_seat and v_to_seat then raise exception 'SEAT_TAKEN'; end if;
    if not v_from_seat and not v_to_seat then raise exception 'NO_SEAT'; end if;
    if v_from_seat then
      update public.trainer_clients set client_id = v_me where client_id = p_from;
      get diagnostics v_count = row_count;
      delete from public.seat_losses where client_id = v_me;   -- vuelve a tener asiento
    end if;
  end if;
  return v_count;
end;
$$;


-- ── 9. Lo que ya no existe ──────────────────────────────────────────────────
-- `claim_trainer_slots` dejaba a cualquiera apropiarse de huecos ajenos;
-- `transfer_client_slot` y los `transfer_my_*` (que cedían a cualquier uuid sin
-- que el destino lo supiera) se sustituyen por offer_transfer + accept_transfer.
drop function if exists public.claim_trainer_slots(uuid[]);
drop function if exists public.transfer_client_slot(uuid, uuid, uuid);
drop function if exists public.transfer_my_slots_to(uuid);
drop function if exists public.transfer_my_seat_to(uuid);


-- ── 10. Quién puede llamar a qué ────────────────────────────────────────────
-- Una función nace ejecutable por PUBLIC: se revoca todo y se concede una a una.
do $$
declare f text;
begin
  foreach f in array array[
    'new_client_code()', '_caller()', '_trainer()', '_check_target(uuid)', '_locked_by(uuid)',
    '_merge_history(jsonb, jsonb)', '_release_seat_of_deleted_user()',
    'trainer_create_slot(text, text)', 'trainer_upload_program(uuid, jsonb, text)',
    'trainer_upload_overrides(uuid, jsonb)', 'trainer_upload_log(uuid, jsonb, integer)',
    'trainer_set_name(text)', 'trainer_delete_slot(uuid, text)', 'trainer_reissue_client_code(uuid)',
    'trainer_deleted_slots(uuid[])',
    'get_slot_by_code(text)', 'link_client_to_slot(text)',
    'client_upload_history(jsonb, integer, uuid)', 'release_client_slot()',
    'offer_transfer(text, uuid)', 'accept_transfer(text, uuid)', 'client_lost_reason()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;

  foreach f in array array[
    'trainer_create_slot(text, text)', 'trainer_upload_program(uuid, jsonb, text)',
    'trainer_upload_overrides(uuid, jsonb)', 'trainer_upload_log(uuid, jsonb, integer)',
    'trainer_set_name(text)', 'trainer_delete_slot(uuid, text)', 'trainer_reissue_client_code(uuid)',
    'trainer_deleted_slots(uuid[])',
    'get_slot_by_code(text)', 'link_client_to_slot(text)',
    'client_upload_history(jsonb, integer, uuid)', 'release_client_slot()',
    'offer_transfer(text, uuid)', 'accept_transfer(text, uuid)', 'client_lost_reason()'
  ] loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
