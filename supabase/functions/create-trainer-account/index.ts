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
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const { code } = await req.json()
  const email = `trainer-${code.toLowerCase().replace(/-/g, '')}@noreply.fuerzacontrol.com`

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: code,
    email_confirm: true,  // confirma sin enviar email
  })

  if (error) {
    // Si el usuario ya existe, no es un error real
    if (error.message.includes('already')) {
      return new Response(JSON.stringify({ exists: true }), { status: 200 })
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }

  return new Response(JSON.stringify({ userId: data.user.id }), { status: 200 })
})
