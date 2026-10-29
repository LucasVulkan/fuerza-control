/**
 * El programa del constructor guiado (docs/specs/O03-onboarding-caminos.md §10, §18).
 *
 * El constructor CREA el programa de verdad al salir del primer paso y los demás
 * pasos lo editan con las acciones del store: lo que se aprende aquí es lo que se
 * verá en el editor. Este fichero reúne lo que las pantallas de `screens/builder.jsx`
 * (y las que añada O03-03) hacen con el store, para que ninguna lo repita:
 * crear o ajustar el programa, las líneas de «Listo», enviar al cliente y salir.
 *
 * Vive junto a `startBuilder.js`; las dos leen y escriben `onboardingFlow.answers`.
 */
import { useStore } from '../../../store/useStore';
import { stageDays } from '../../utils/stageProgress';
import { builderExit } from '../../utils/onboardingFlow';

const K = 'onboardingFlow.builder';

/** Lo que el constructor tiene ahora en el store: respuestas, programa y sus sesiones de la etapa activa. */
export function builderState() {
  const s = useStore.getState();
  const a = s.onboardingFlow?.answers ?? {};
  const program   = a.programId ? s.programs[a.programId] ?? null : null;
  const templates = program ? stageDays(program).map((d) => s.sessionTemplates[d.sessionTemplateId]).filter(Boolean) : [];
  const trainer   = a.builderCtx === 'trainer' && !!a.clientId;
  return { s, a, program, templates, trainer, client: trainer ? s.clients[a.clientId] ?? null : null };
}

/** El nombre con el que nace el programa: «Mi programa» / «Programa de {cliente}». */
export function defaultProgramName(t) {
  const { trainer, client } = builderState();
  return trainer ? t(`${K}.defaultNameClient`, { name: client?.name ?? '' }) : t(`${K}.defaultName`);
}

/**
 * Pone el programa en `n` sesiones. La primera vez lo crea (`createEmptyProgram`
 * para `self`/`copy`; el programa del cliente para `trainer`, sin abrir el editor y
 * como el activo del cliente); si ya existe, añade o quita sesiones VACÍAS del
 * final, sin recrearlo. Devuelve el id, o `null` si no se pudo (el cliente está
 * congelado: el store ya enseñó el paywall).
 */
export function ensureBuilderProgram(n, t) {
  const { s, program, templates, trainer, a } = builderState();
  if (program) {
    for (let i = templates.length; i > n; i--) s.removeSessionFromProgram(program.id, templates[i - 1].id);
    for (let i = templates.length; i < n; i++) s.addSessionToProgram(program.id);
    syncBuilderDone(t);
    return program.id;
  }
  const name = defaultProgramName(t);
  let id;
  if (trainer) {
    id = s.createProgramForClient(a.clientId, n, name, null, { openEditor: false });
    if (id) s.setClientActiveProgram(a.clientId, id);
  } else {
    id = s.createEmptyProgram(n, name);
  }
  if (!id) return null;
  s.flowAnswer({ programId: id, programSource: 'builder' });
  syncBuilderDone(t);
  return id;
}

/**
 * Las líneas de «Listo» (§11.5): el programa creado (y enviado) y, si quedan
 * sesiones vacías, el pendiente de rellenarlas con dónde se retoma. Se llama tras
 * cada cambio, así que «Saltar» y «Lo termino después» llegan a «Listo» al día.
 */
export function syncBuilderDone(t) {
  const { s, a, program, templates, trainer, client } = builderState();
  if (!program) return;
  s.flowDone({ key: 'program', ok: true, label: t(`${K}.${a.sent ? 'doneSent' : 'doneCreated'}`, { name: program.name }) });
  const empty = templates.filter((tpl) => !tpl.exercises?.length).map((tpl) => tpl.label);
  if (empty.length) {
    s.flowDone({
      key: 'fill', ok: false,
      label: t(`${K}.${trainer ? 'fillClient' : 'fillSelf'}`, { count: empty.length, letters: empty.join(', '), client: client?.name ?? '' }),
    });
  } else if (s.onboardingFlow?.done.some((d) => d.key === 'fill')) {
    useStore.setState((st) => (st.onboardingFlow
      ? { onboardingFlow: { ...st.onboardingFlow, done: st.onboardingFlow.done.filter((d) => d.key !== 'fill') } }
      : {}));
  }
}

/**
 * Envía el programa al cliente si procede: es el programa de un cliente con
 * hueco en la nube y ya tiene algún ejercicio (un programa vacío se queda en su
 * ficha sin enviar, §10.1). Marca `answers.sent`. Lanza si la subida falla.
 */
export async function sendBuilderProgram() {
  const { s, a, program, templates, trainer, client } = builderState();
  if (!trainer || !program || !client?.slotId) return false;
  if (!templates.some((tpl) => tpl.exercises?.length)) return false;
  await s.uploadProgramToClient(a.clientId, program.id);
  s.flowAnswer({ sent: true });
  return true;
}

/** Adónde sale el constructor con lo que haya en las respuestas ahora. */
export function builderExitNow() {
  const f = useStore.getState().onboardingFlow;
  return builderExit(f?.answers ?? {}, f?.entry);
}

/**
 * «Lo termino después»: sale del constructor guardando lo que haya (§10.1). Si es
 * el programa de un cliente con app y ya tiene algún ejercicio, se envía; un fallo
 * de red no lo impide (queda en su ficha como «cambios sin enviar»). `n`: las
 * sesiones elegidas aún sin crear, para el primer paso. Si el usuario vuelve atrás
 * mientras sube, no navega.
 */
export async function leaveBuilder(goTo, t, n = 0) {
  const screen = useStore.getState().onboardingFlow?.screen;
  if (n > 0) ensureBuilderProgram(n, t);
  try { await sendBuilderProgram(); } catch { /* sin conexión: se envía desde Clientes */ }
  syncBuilderDone(t);
  if (useStore.getState().onboardingFlow?.screen === screen) goTo(builderExitNow());
}
