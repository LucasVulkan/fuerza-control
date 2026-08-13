-- ============================================================================
-- Modelo de conexión entrenador ↔ cliente
--
-- Sustituye el conjunto de funciones que gobernaban quién ocupa qué. Cada una
-- se había escrito con un criterio distinto y de ahí salían los agujeros:
-- `transfer_client_slot` y `release_client_slot` comprobaban la autorización,
-- `link_client_to_slot` y `claim_trainer_slots` no comprobaban nada.
--
-- ── El modelo ───────────────────────────────────────────────────────────────
-- Cada fila de `trainer_clients` es un HUECO con dos asientos:
--   trainer_id  el dueño. Nunca vacío.
--   client_id   el ocupante. Puede estar vacío.
--
-- REGLA ÚNICA, y todo lo de abajo es una consecuencia suya:
--
--   Un asiento vacío se ocupa con la llave. Un asiento ocupado solo lo libera
--   quien está sentado, o el dueño del hueco. Nadie se concede a sí mismo un
--   asiento que otro ocupa.
--
-- Lo que compra: un código filtrado nunca mete a nadie en un hueco ocupado.
--
-- ── Estados del hueco ───────────────────────────────────────────────────────
--   LIBRE     client_id null, disconnected_at null  — nunca ocupado
--   OCUPADO   client_id no null
--   VACANTE   client_id null, disconnected_at fecha — estuvo ocupado
-- LIBRE y VACANTE se comportan igual para entrar.
--
-- ── ROMPE LA APP ACTUAL ─────────────────────────────────────────────────────
-- `get_slot_by_code` cambia de firma y deja de devolver el programa entero.
-- Este script y los cambios de la app se despliegan JUNTOS.
--
-- Idempotente: se puede ejecutar entero las veces que haga falta.
-- ============================================================================


-- ── 1. Apropiación de cuenta: se borra ──────────────────────────────────────
-- `claim_trainer_slots(slot_ids)` hacía:
--     update trainer_clients set trainer_id = auth.uid() where id = any(slot_ids)
-- Sin una sola comprobación, y con security definer. Cualquier usuario
-- autenticado —y la clave anónima va dentro del APK— se convertía en el
-- entrenador de cualquier hueco cuyo UUID conociera. Todo cliente vinculado
-- conoce el suyo, y `get_slot_by_code` lo entregaba a quien supiera un código.
-- Tras la apropiación el entrenador legítimo dejaba de ver la fila, porque su
-- política es `trainer_id = auth.uid()`.
--
-- No se arregla, se sustituye por su espejo correcto (punto 2): el escenario
-- legítimo era mover los huecos al cambiar de modo de cuenta, y eso lo autoriza
-- quien los tiene, no quien los quiere.
drop function if exists public.claim_trainer_slots(uuid[]);


-- ── 2. El entrenador cede sus huecos ────────────────────────────────────────
-- Único uso legítimo de transferir el asiento de entrenador: cambiar de modo de
-- cuenta (código → Google/Apple o al revés), que emite un user id distinto.
--
-- Se llama estando autenticado como el dueño VIEJO. El `where trainer_id =
-- auth.uid()` es toda la autorización que hace falta: solo puedes regalar lo
-- que ya es tuyo.
--
-- Reinstalar NO necesita esto: la cuenta por código es determinista (el correo
-- sintético sale del código), así que al recuperarla es el mismo user id y los
-- huecos siguen siendo suyos.
create or replace function public.transfer_my_slots_to(p_new_trainer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_new_trainer_id is null then
    raise exception 'NEW_TRAINER_REQUIRED';
  end if;

  -- Cederse a uno mismo no es un error, simplemente no hace nada.
  update public.trainer_clients
     set trainer_id = p_new_trainer_id
   where trainer_id = auth.uid();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ── 3. Códigos de cliente ───────────────────────────────────────────────────
-- Alfabeto sin caracteres ambiguos (ni I, ni O, ni 0, ni 1): el código se dicta
-- por teléfono y se teclea a mano. Mismo alfabeto que `generateClientCode` en
-- src/services/supabaseSync.js.
create or replace function public.new_client_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code  text;
  v_try   integer := 0;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      if i = 5 then v_code := v_code || '-'; end if;
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    end loop;

    exit when not exists (select 1 from public.trainer_clients where client_code = v_code);

    -- 32^8 combinaciones: colisionar diez veces seguidas es imposible en la
    -- práctica. Si pasa, algo va muy mal y es mejor fallar que girar sin fin.
    v_try := v_try + 1;
    if v_try > 10 then raise exception 'CODE_GENERATION_FAILED'; end if;
  end loop;

  return v_code;
end;
$$;


-- ── 4. Reemitir el código de un cliente ─────────────────────────────────────
-- La operación que sostiene los dos escenarios de reconexión:
--
--   · El cliente reinstaló y era anónimo. Su identidad se perdió con la
--     instalación, así que el asiento quedó ocupado por un usuario que ya no
--     existe. El servidor NO puede distinguir "soy yo otra vez" de "soy otro
--     con su código" — las dos peticiones son idénticas — así que la decisión
--     la toma el entrenador, que es quien conoce a su cliente.
--   · Perdió el código, o el código se filtró y hay que revocarlo.
--
-- Hace las dos cosas a la vez a propósito: un código nuevo sin liberar el
-- asiento no serviría de nada, porque el hueco seguiría ocupado.
--
-- NO borra el historial, al contrario que `release_client_slot`: allí el
-- cliente se va y el hueco puede acabar en otras manos; aquí vuelve la misma
-- persona y su historial es justo lo que viene a recuperar.
--
-- El cliente que estuviera dentro queda fuera. Es lo correcto en los dos casos:
-- si reinstaló, ese ocupante es un fantasma; si estás revocando, es justo lo
-- que quieres.
create or replace function public.trainer_reissue_client_code(p_slot_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := public.new_client_code();

  update public.trainer_clients
     set client_code     = v_code,
         client_id       = null,
         disconnected_at = now()
   where id         = p_slot_id
     and trainer_id = auth.uid();   -- solo tus huecos

  if not found then
    raise exception 'SLOT_NOT_FOUND_OR_NOT_YOURS';
  end if;

  return v_code;
end;
$$;


-- ── 5. El cliente entra ─────────────────────────────────────────────────────
-- La versión anterior hacía un update a ciegas sin mirar quién ocupaba el
-- asiento: cualquiera con el código desalojaba al cliente legítimo, que además
-- no se enteraba — sus subidas empezaban a fallar y la app lo mostraba como un
-- problema de red.
--
-- Ahora el código solo abre asientos vacíos. Reintentar siendo ya el ocupante
-- está permitido (idempotente: la app reintenta).
--
-- Firma idéntica, así que `create or replace` basta y los permisos existentes
-- siguen valiendo.
create or replace function public.link_client_to_slot(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_id uuid;
  v_owner   uuid;
begin
  select id, client_id
    into v_slot_id, v_owner
    from public.trainer_clients
   where client_code = upper(trim(p_code));

  if v_slot_id is null then
    raise exception 'CODE_NOT_FOUND';
  end if;

  -- Ocupado por otro: no se desaloja. El entrenador reemite el código.
  if v_owner is not null and v_owner <> auth.uid() then
    raise exception 'SLOT_OCCUPIED';
  end if;

  update public.trainer_clients
     set client_id       = auth.uid(),
         disconnected_at = null
   where id = v_slot_id;

  return v_slot_id;
end;
$$;


-- ── 6. Consultar un hueco por su código ─────────────────────────────────────
-- Deja de publicar tres cosas que no hacían falta para pintar la pantalla de
-- confirmación y sí servían para atacar:
--
--   client_id     era la mitad de los argumentos de `transfer_client_slot`, que
--                 comprueba `client_id = p_old_client_id`. Publicarlo abría una
--                 segunda puerta al asiento del cliente que se saltaba esta
--                 función por completo. Ahora sale como booleano.
--   trainer_id    nadie lo usaba.
--   program_json  el programa ENTERO a cualquiera que supiera un código, antes
--                 de vincularse. Ahora solo el nombre; el programa se descarga
--                 después de entrar, cuando ya eres el ocupante.
--
-- Cambia el tipo de retorno, así que hay que soltar la anterior primero.
drop function if exists public.get_slot_by_code(text);

create function public.get_slot_by_code(p_code text)
returns table (
  id                 uuid,
  client_name        text,
  program_name       text,
  program_updated_at timestamptz,
  is_linked          boolean,
  history_updated_at timestamptz,
  trainer_name       text
)
language sql
security definer
set search_path = public
as $$
  select id,
         client_name,
         program_json -> 'program' ->> 'name',
         program_updated_at,
         client_id is not null,
         history_updated_at,
         trainer_name
  from public.trainer_clients
  where client_code = upper(trim(p_code))
  limit 1;
$$;


-- ── 7. Permisos ─────────────────────────────────────────────────────────────
-- Una función recién creada nace con EXECUTE para PUBLIC, así que hay que
-- revocar explícitamente y conceder solo a `authenticated`. Las dos nuevas y
-- la que cambió de firma lo necesitan sí o sí.
revoke all on function public.get_slot_by_code(text)              from public;
revoke all on function public.link_client_to_slot(text)           from public;
revoke all on function public.transfer_my_slots_to(uuid)          from public;
revoke all on function public.trainer_reissue_client_code(uuid)   from public;
revoke all on function public.new_client_code()                   from public;

grant execute on function public.get_slot_by_code(text)            to authenticated;
grant execute on function public.link_client_to_slot(text)         to authenticated;
grant execute on function public.transfer_my_slots_to(uuid)        to authenticated;
grant execute on function public.trainer_reissue_client_code(uuid) to authenticated;
-- `new_client_code` es un ayudante interno: nadie la llama desde fuera.

-- ============================================================================
-- Comprobación posterior. Las cuatro tienen que salir con prosecdef = true, y
-- `claim_trainer_slots` no debe aparecer:
--
--   select proname, prosecdef from pg_proc
--    where proname in ('claim_trainer_slots','get_slot_by_code',
--                      'link_client_to_slot','transfer_client_slot',
--                      'transfer_my_slots_to','trainer_reissue_client_code',
--                      'release_client_slot');
-- ============================================================================
