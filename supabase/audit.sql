-- ============================================================================
-- Auditoría de la conexión entrenador ↔ cliente. Solo lee: se puede ejecutar
-- en el SQL editor de Supabase cuando se quiera, en producción incluida.
--
-- Cada fila del resultado es un problema. Vacío = todo en orden.
-- Las reglas son las de schema.sql §«Las reglas»; las restricciones de allí ya
-- impiden la mayoría, esto confirma que el servidor desplegado es ese.
-- ============================================================================

-- Huella de cada función: lo desplegado es el cuerpo de schema.sql. Si cambias una
-- función en schema.sql, actualiza aquí su huella (el test «H3 montaje» avisa):
--   md5(regexp_replace(prosrc, '\s+', ' ', 'g')), sin importar espacios ni saltos de línea.
with huellas(n, h) as (values
  ('_caller', 'ccb3b2dbc7c047aa132b7ffec5a1712f'),
  ('_check_target', 'f71e53d03ed1d01772cf59a66f30f127'),
  ('_locked_by', '4e4ae7904b2fe14831d60ea1ca55ba96'),
  ('_merge_history', 'b0c31b3f3daa967577e6ab10ba666299'),
  ('_release_seat_of_deleted_user', 'f01a7c7c858c1fea61a83445aad2642e'),
  ('_trainer', '895184881412f231e1d94aef8009eed3'),
  ('accept_transfer', '31b0e2f1b43c82681fbbfb965495cf4e'),
  ('client_lost_reason', 'c1aa16132493e01048a8445e9774cac4'),
  ('client_upload_history', '512c26d1cf3b95bab07ef0c8dc2029f6'),
  ('get_slot_by_code', '1ec9eb35eb1399c71eefa1e0d6ca6794'),
  ('link_client_to_slot', '2f25fec0ab28035d66d5c6cc82c45ab2'),
  ('new_client_code', '4cd8993cec4d23f569beb2ac28032293'),
  ('offer_transfer', '84e4a6eb787f9e1fa26afbe657cb9e04'),
  ('release_client_slot', '4d0b1d80e8268c8caae12ee72392c426'),
  ('trainer_create_slot', 'cd90e36296965cdc88e7c3753072d606'),
  ('trainer_delete_slot', 'fc7451ecd9a0feab88cef6ab582c2297'),
  ('trainer_reissue_client_code', '57d59eac2dd5d143f96f6be992754e6a'),
  ('trainer_set_name', '991c28decba6b250c7ed31efd8b90860'),
  ('trainer_slots_alive', '3eadf8235cc0d9127da7ea5c3f2992cc'),
  ('trainer_upload_log', '9614f076054c51c988e213ceab15a451'),
  ('trainer_upload_overrides', '3bfd01ad1de6c34087b084bcbbd0f010'),
  ('trainer_upload_program', '5830cbff51deabbe74860ed3f9204105')
)

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
-- Permiso sobre la tabla, el que sea (también el que llega de PUBLIC); leer solo vale en trainer_clients.
select 'permiso de escritura directo', r || ' ' || p || ' ' || c.relname
  from pg_class c,
       unnest(array['anon', 'authenticated']) r,
       unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('trainer_clients', 'transfer_offers', 'seat_losses')
   and not (p = 'SELECT' and c.relname = 'trainer_clients')
   and has_table_privilege(r, c.oid, p)

union all
-- Lo mismo por columna (un `grant update (trainer_id)` no sale en el de tabla).
select 'permiso de escritura por columna', r || ' ' || p || ' ' || a.attname
  from pg_attribute a,
       unnest(array['anon', 'authenticated']) r,
       unnest(array['INSERT', 'UPDATE', 'REFERENCES']) p
 where a.attrelid = to_regclass('public.trainer_clients') and a.attnum > 0 and not a.attisdropped
   and has_column_privilege(r, a.attrelid, a.attnum, p)
   and not has_table_privilege(r, a.attrelid, p)

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
 where not exists (select 1 from pg_proc where proname = f and pronamespace = 'public'::regnamespace)

union all
-- RLS desactivada: sin ella, los permisos de tabla dejarían de filtrar filas.
select 'RLS desactivada', c.relname::text
  from pg_class c
 where c.relnamespace = 'public'::regnamespace and not c.relrowsecurity
   and c.relname in ('trainer_clients', 'profiles', 'transfer_offers', 'seat_losses')

union all
-- Política de lectura que deja ver todas las filas.
select 'política de lectura abierta', tablename || '.' || policyname
  from pg_policies
 where schemaname = 'public' and cmd in ('SELECT', 'ALL') and qual = 'true'

union all
-- Funciones ejecutables por anon (o por PUBLIC, que anon hereda).
select 'función ejecutable por anon', p.oid::regprocedure::text
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')

union all
-- Las internas (las que schema.sql no concede) no son para la app.
select 'función interna ejecutable por authenticated', p.oid::regprocedure::text
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')
   and p.proname in ('new_client_code', '_caller', '_trainer', '_check_target', '_locked_by',
                     '_merge_history', '_release_seat_of_deleted_user')

union all
-- Índices y claves ajenas que sostienen las reglas.
select 'falta el índice', i
  from unnest(array['trainer_clients_one_seat', 'trainer_clients_code_key']) i
 where to_regclass('public.' || i) is null

union all
select 'falta la clave ajena', f
  from unnest(array['trainer_clients_trainer_fk', 'trainer_clients_client_fk', 'profiles_id_fk']) f
 where not exists (select 1 from pg_constraint where conname = f)

union all
-- Perfiles de usuarios que ya no existen (la clave ajena de profiles es `not valid`: no los borra ella).
select 'perfil sin usuario', p.id::text
  from public.profiles p
 where not exists (select 1 from auth.users u where u.id = p.id)

union all
-- Las de la lista que faltan o tienen otro cuerpo.
select 'función distinta de schema.sql', f.n
  from huellas f
 where not exists (select 1 from pg_proc p
                    where p.pronamespace = 'public'::regnamespace and p.proname = f.n
                      and md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) = f.h)

union all
-- Y las que no están en la lista (una firma vieja que siga viva).
select 'función que no es de schema.sql', p.oid::regprocedure::text
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and not exists (select 1 from huellas f
                    where f.n = p.proname and f.h = md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')));
