-- ============================================================================
-- release_client_slot
--
-- Un cliente suelta el hueco que ocupa en `trainer_clients` y borra LO SUYO,
-- dejando intacto lo del entrenador.
--
-- Qué se va (del cliente):   client_id, history_json, sessions_count, overrides
-- Qué se queda (del entrenador): client_name, client_code, program_json, trainer_id
--
-- Por qué hace falta una función y no un UPDATE normal:
-- la política "Client can update their slot" lleva
--   with check (auth.uid() = client_id)
-- así que poner `client_id = null` viola el check — el cliente no puede
-- soltarse a sí mismo con un update directo. SECURITY DEFINER lo salva, y la
-- autorización sigue siendo estricta: el WHERE es `client_id = auth.uid()`,
-- o sea que solo puedes soltar TU hueco. Mismo patrón que
-- `link_client_to_slot` y `transfer_client_slot`.
--
-- Por qué se borra el historial:
-- el código es una credencial permanente del hueco (re-enlazar está permitido
-- por diseño), así que el entrenador puede dárselo a otra persona. Si el
-- historial del anterior siguiera ahí, al nuevo se le ofrecería descargarlo en
-- la pantalla de confirmar — el historial de un desconocido.
--
-- `disconnected_at` es lo que ve el entrenador en su lista de clientes.
--
-- Idempotente: se puede ejecutar tal cual en el SQL editor las veces que haga
-- falta.
-- ============================================================================

create or replace function public.release_client_slot()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.trainer_clients
     set client_id            = null,
         disconnected_at      = now(),
         history_json         = null,
         history_updated_at   = null,
         sessions_count       = 0,
         overrides_json       = null,
         overrides_updated_at = null
   where client_id = auth.uid();

  get diagnostics v_count = row_count;
  return v_count;   -- 0 si no había hueco enlazado; no es un error
end;
$$;

revoke all on function public.release_client_slot() from public;
grant execute on function public.release_client_slot() to authenticated;
