/**
 * clientLink — con app o sin app, en UN sitio (docs/specs/C05-trainer-logging.md
 * §4.0, C28). Antes la lista, el aviso de cambios y la ficha lo decidían cada
 * uno a su manera, y un cliente presencial salía «Cambios sin enviar» siempre.
 *
 *   'none'    sin app: no tiene código. Le apunta el entrenador (C19).
 *   'invited' le generaste el código y aún no lo ha canjeado. Ya no se le
 *             apunta nada: lo decidió el entrenador al generarlo, no el cliente
 *             al canjearlo. Lo que cambie se le sube solo, sin aviso.
 *   'linked'  entrena con su app.
 *
 * Con el entrenador sin nube no viaja nada, así que todos son 'none'.
 */
export function clientLink(client, trainerSync) {
  if (!client?.syncSlotId) return 'none';
  const mode = trainerSync?.mode;
  if (!mode || mode === 'offline') return 'none';
  return client.syncLinked ? 'linked' : 'invited';
}
