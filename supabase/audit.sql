-- ============================================================================
-- Auditoría de la conexión entrenador ↔ cliente. Solo lee: se puede ejecutar
-- en el SQL editor de Supabase cuando se quiera, en producción incluida.
--
-- Cada fila del resultado es un problema. Vacío = todo en orden.
-- Las reglas son las de schema.sql §«Las reglas»; las restricciones de allí ya
-- impiden la mayoría, esto confirma que el servidor desplegado es ese.
-- ============================================================================

-- Huecos de un entrenador que no existe.
select 'hueco sin entrenador' as problema, t.id::text as detalle
  from public.trainer_clients t
 where not exists (select 1 from auth.users u where u.id = t.trainer_id)

union all
-- Asiento ocupado por un usuario que no existe (fantasma).
select 'asiento con fantasma', t.id::text
  from public.trainer_clients t
 where t.client_id is not null
   and not exists (select 1 from auth.users u where u.id = t.client_id)

union all
-- Un cliente en más de un asiento.
select 'cliente en varios asientos', t.client_id::text
  from public.trainer_clients t
 where t.client_id is not null
 group by t.client_id having count(*) > 1

union all
-- Código repetido o vacío.
select 'código repetido o vacío', coalesce(t.client_code, '(null)')
  from public.trainer_clients t
 group by t.client_code having count(*) > 1 or t.client_code is null

union all
-- Un anónimo como entrenador (los entrenadores tienen cuenta de verdad).
select 'entrenador anónimo', t.trainer_id::text
  from public.trainer_clients t join auth.users u on u.id = t.trainer_id
 where u.is_anonymous
 group by t.trainer_id

union all
-- Política de escritura en la tabla: no debe haber ninguna (todo va por funciones).
select 'política de escritura', policyname
  from pg_policies
 where schemaname = 'public'
   and (   (tablename = 'trainer_clients' and cmd <> 'SELECT')
        or tablename = 'transfer_offers')   -- ni leer: una oferta falsa robaría huecos

union all
-- Permiso de escritura directo sobre la tabla.
select 'permiso de escritura directo', grantee || ' ' || privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated')
   and (   (table_name = 'trainer_clients' and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
        or table_name = 'transfer_offers')

union all
-- Funciones que ya no deben existir.
select 'función retirada sigue viva', proname
  from pg_proc
 where proname in ('claim_trainer_slots', 'transfer_client_slot', 'transfer_my_slots_to', 'transfer_my_seat_to')

union all
-- Funciones de la conexión que deben ser security definer.
select 'función sin security definer', proname
  from pg_proc
 where pronamespace = 'public'::regnamespace and not prosecdef
   and proname in ('trainer_create_slot', 'trainer_upload_program', 'trainer_upload_overrides',
                   'trainer_upload_log', 'trainer_set_name', 'trainer_delete_slot',
                   'trainer_reissue_client_code', 'get_slot_by_code',
                   'link_client_to_slot', 'client_upload_history', 'release_client_slot',
                   'offer_transfer', 'accept_transfer', 'client_lost_reason')

union all
-- Y que estén todas.
select 'falta la función', f
  from unnest(array['trainer_create_slot', 'trainer_upload_program', 'trainer_upload_overrides',
                    'trainer_upload_log', 'trainer_set_name', 'trainer_delete_slot',
                    'trainer_reissue_client_code', 'get_slot_by_code',
                    'link_client_to_slot', 'client_upload_history', 'release_client_slot',
                    'offer_transfer', 'accept_transfer', 'client_lost_reason']) as f
 where not exists (select 1 from pg_proc where proname = f and pronamespace = 'public'::regnamespace);
