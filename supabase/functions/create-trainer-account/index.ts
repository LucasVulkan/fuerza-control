/**
 * create-trainer-account — crea la cuenta del entrenador en modo "código".
 *
 * La llama `setupTrainerCodeAccount` en src/services/supabaseAuth.js. Va por
 * admin API en vez de `signUp` para no mandar email de confirmación ni chocar
 * con el rate limit de Supabase: el email es sintético
 * (trainer-{code}@noreply.fuerzacontrol.com) y no existe de verdad.
 *
 * Copia de lo que está desplegado, para que el backend no viva solo dentro del
 * dashboard. Si tocas una, toca la otra.
 *
 * Despliegue: supabase functions deploy create-trainer-account
 *
 * ── Lo que NO arregla esto ──────────────────────────────────────────────────
 * La contraseña sigue siendo el propio código, que es lo que el entrenador ve
 * y guarda. Endurecer la entrada quita los bordes, no el fondo: quien conozca
 * un código tiene la cuenta. Eso se cierra moviendo la recuperación a una
 * función que valide el código y emita la sesión, con la contraseña real como
 * secreto aleatorio que nadie ve — ver `docs/specs/client-connection.md` §4.3.
 *
 * ponytail: sin cabeceras CORS, igual que `delete-account` — solo la llama la
 * app móvil, donde fetch no aplica CORS.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

/** El formato que emite `generateTrainerCode` en src/services/supabaseAuth.js. */
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  try {
    // `req.json()` estaba fuera de todo try: una peticion sin cuerpo, o con un
    // cuerpo que no fuera JSON, salia como un 500 sin explicacion.
    const body = await req.json().catch(() => null)
    const code = (body as { code?: unknown } | null)?.code

    // Y `code.toLowerCase()` se llamaba a pelo: con {"code": 123} o {} era un
    // TypeError. Ademas la clave anonima se extrae del APK, asi que sin validar
    // el formato cualquiera puede crear usuarios en auth.users en masa, ya
    // confirmados. El formato no es una defensa fuerte, pero corta el ruido.
    if (typeof code !== 'string' || !CODE_RE.test(code)) {
      return json({ error: 'Código inválido' }, 400)
    }

    const email = `trainer-${code.toLowerCase().replace(/-/g, '')}@noreply.fuerzacontrol.com`

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: code,
      email_confirm: true,  // confirma sin enviar email
    })

    if (error) {
      // Que el usuario ya exista no es un error real: el codigo ya estaba dado
      // de alta y la app seguira con signInWithPassword.
      if (error.message.includes('already')) return json({ exists: true })

      // El mensaje interno se queda en el log, no viaja al cliente: describe la
      // forma del backend a quien pregunte.
      console.error('[create-trainer-account]', error)
      return json({ error: 'No se pudo crear la cuenta' }, 400)
    }

    return json({ userId: data.user.id })
  } catch (e) {
    console.error('[create-trainer-account]', e)
    return json({ error: 'Petición inválida' }, 400)
  }
})
