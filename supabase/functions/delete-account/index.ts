/**
 * delete-account — borra la cuenta de quien llama.
 *
 * Requisito de la App Store (5.1.1(v)): si la app permite crear cuenta, tiene
 * que permitir borrarla desde dentro.
 *
 * Hace falta admin API para eliminar el usuario de `auth.users`, y eso no se
 * puede hacer desde el cliente. Hermana de `create-trainer-account`.
 *
 * La identidad NO se acepta del body: se saca del JWT del llamante. Un body
 * con `userId` sería un borra-cuentas ajeno.
 *
 * Qué borra según lo que sea el usuario (puede ser las dos cosas a la vez):
 *
 *  Entrenador → sus filas de `trainer_clients`. Sus clientes pierden el
 *               programa y el código deja de funcionar. Es lo esperado: el
 *               programa lo escribió él y se va con él.
 *
 *  Cliente    → NO borra la fila, la suelta: es del entrenador (programa,
 *               nombre y código son suyos). Se va solo lo del cliente, y el
 *               historial se limpia porque el entrenador puede darle ese mismo
 *               código a otra persona. Mismo criterio que
 *               `release_client_slot()` en release_client_slot.sql.
 *
 * Al final, `profiles` y el usuario de auth.
 *
 * Despliegue:  supabase functions deploy delete-account
 *
 * ponytail: sin cabeceras CORS — solo la llama la app móvil, donde fetch no
 * aplica CORS. Si algún día la web hace lo mismo, habrá que añadirlas.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
    // ── Quién llama ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Falta la sesión' }, 401);

    // Cliente con el JWT del llamante: solo para resolver su identidad.
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await asCaller.auth.getUser();
    if (userError || !user) return json({ error: 'Sesión no válida' }, 401);

    // A partir de aquí, service role: salta RLS a propósito, y el `where`
    // siempre lleva el id del llamante.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Como entrenador: sus huecos se van con él ────────────────────────────
    const { error: slotsError } = await admin
      .from('trainer_clients')
      .delete()
      .eq('trainer_id', user.id);
    if (slotsError) throw slotsError;

    // ── Como cliente: suelta el hueco, no lo borra ───────────────────────────
    const { error: releaseError } = await admin
      .from('trainer_clients')
      .update({
        client_id:            null,
        disconnected_at:      new Date().toISOString(),
        history_json:         null,
        history_updated_at:   null,
        sessions_count:       0,
        overrides_json:       null,
        overrides_updated_at: null,
      })
      .eq('client_id', user.id);
    if (releaseError) throw releaseError;

    // ── Perfil ───────────────────────────────────────────────────────────────
    const { error: profileError } = await admin
      .from('profiles')
      .delete()
      .eq('id', user.id);
    if (profileError) throw profileError;

    // ── El usuario. Lo último: si algo de arriba falla, la cuenta sigue
    //    existiendo y se puede reintentar. Al revés dejaría filas huérfanas
    //    sin nadie que pueda tocarlas.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json({ ok: true });
  } catch (err) {
    console.error('[delete-account]', err);
    return json({ error: (err as Error)?.message ?? 'Error desconocido' }, 500);
  }
});
