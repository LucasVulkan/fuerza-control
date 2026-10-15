/**
 * Las reglas del recorrido de entrada (docs/specs/O03-onboarding-caminos.md §16.3).
 *
 * Puro y sin React: qué tramo es cada pantalla, cuánto lleva hecho el tramo, adónde
 * lleva «Saltar» y las rutas que dependen de lo contestado. `OnboardingFlowScreen`
 * lo consume; cada camino (O03-02…O03-11) añade aquí sus ids y sus casos al test.
 *
 * Valores de `answers` que usan estas funciones (el resto de campos, §16.2, no
 * cambian ninguna ruta):
 *   role         'self' | 'coached' | 'trainer'
 *   viaInvite    boolean — llegó por forma://join
 *   path         'own' | 'template' — «por mi cuenta»: el mío o una plantilla
 *   coachApp     'code' | 'nocode' | 'no'
 *   clientMode   'app' | 'self'
 *   account      'apple' | 'google' | 'code'
 *   programSource 'builder' | 'catalog' | 'proposal' | 'import' | 'coach'
 *   builderCtx   'self' | 'trainer' | 'copy'
 *   sent         boolean — el programa del cliente se envió
 *   alsoTrains   boolean — el entrenador también entrena
 */

export const SECTIONS = ['settings', 'you', 'setup', 'learn'];

/** Tramo de cada pantalla. Lo que no está aquí no pinta barra (−1). */
const SECTION_OF = {
  welcome: -1, recover: -1, r_trainer: -1, r_code: -1, r_client: -1,
  units: 0, theme: 0,
  role: 1, t_clients: 1, t_groups: 1, s_level: 1, s_choice: 1,
  t_client: 2, t_account: 2, t_code: 2, t_program: 2, t_catalog: 2, t_assign: 2, t_invite: 2, t_self: 2,
  c_code: 2, c_confirm: 2, c_linked: 2, c_ask: 2, c_wait: 2, c_copy: 2,
  s_goal: 2, s_days: 2, s_props: 2, s_adjust: 2,
  b_sessions: 2, b_exercise: 2, b_volume: 2, b_done: 2,
  n_source: 2, n_templates: 2, n_done: 2,
  a_home: 3, a_input: 3, a_cards: 3,
  done: 4,
};

/** 0-3 el tramo de la barra, −1 sin barra (bienvenida y recuperar), 4 completado (listo). */
export const sectionOf = (id) => SECTION_OF[id] ?? -1;

/**
 * Cuántas pantallas espera el tramo según lo contestado. Es lo que hace que la
 * barra no mienta cuando un camino es más largo que otro (la maqueta, `secTotal`).
 */
function sectionTotal(sec, a) {
  if (sec === 0) return 2;
  if (sec === 1) return a.viaInvite ? 1 : a.role === 'coached' ? 1 : 3;
  if (sec === 2) {
    if (a.role === 'trainer') {
      // cliente, su programa y «¿entrenas tú?»; con app, la cuenta (y el código);
      // constructor (4) o catálogo + asignar (2); invitar si tiene app y programa
      const app = a.clientMode === 'app';
      const built = a.programSource === 'builder' || !!a.builderCtx;
      const prog = built || !!a.programSource;
      return 3 + (app ? (a.account === 'code' ? 2 : 1) : 0) + (built ? 4 : prog ? 2 : 0) + (prog && app ? 1 : 0);
    }
    if (a.role === 'self') return a.path === 'own' ? 4 : 3;
    if (a.role === 'coached') {
      // El código abre el camino (14-oct): código → encontrado → conectado; o
      // código → pedirlo; o código → crear su programa → las 4 del constructor.
      if (a.builderCtx) return 6;
      return 3;   // código → encontrado → conectado · código → pedirlo → cuando llegue
    }
    return 3;
  }
  return a.role === 'trainer' && a.alsoTrains !== true ? 1 : 3;
}

/**
 * Cuánto lleva hecho el tramo de `id`, de 0 a 1: pantallas del tramo ya vistas
 * (el historial más la actual) entre las esperadas.
 */
export function sectionProgress(id, history = [], answers = {}) {
  const sec = sectionOf(id);
  if (sec < 0) return 0;
  if (sec >= SECTIONS.length) return 1;
  const seen = new Set([...history, id].filter((x) => sectionOf(x) === sec));
  return Math.min(1, seen.size / sectionTotal(sec, answers));
}

/** Los cuatro tramos de la barra, de 0 a 1: los anteriores llenos, el actual a su avance. */
export function barFills(id, history = [], answers = {}) {
  const sec = sectionOf(id);
  return SECTIONS.map((_, i) => (i < sec ? 1 : i === sec ? sectionProgress(id, history, answers) : 0));
}

// ── Rutas condicionales ──────────────────────────────────────────────────────

/** Tras los ajustes: la invitación se salta la bifurcación, el código ya viene puesto. */
export const afterSettings = (a) => (a.viaInvite ? 'c_code' : 'role');

/**
 * Tras dejar el programa del cliente (entrenador). Solo se invita con app Y con
 * programa enviado: un código sin programa le da error al cliente al canjearlo.
 */
export const afterProgram = (a) => (a.clientMode === 'app' && a.sent ? 't_invite' : 't_self');

/**
 * Adónde sale el constructor guiado (§10). Desde la app, `null` (no hay pantalla =
 * se termina el recorrido) mientras no exista el programa: «Saltar» antes de
 * «Siguiente» no crea nada y `n_done` no tendría qué decir (§25.4.3).
 */
export function builderExit(a, entry = 'first') {
  if (entry === 'newProgram') return a.programId ? 'n_done' : null;
  if (a.builderCtx === 'trainer') return afterProgram(a);
  return 'a_home';
}

/** Tras confirmar una propuesta (§8). */
export const afterProposal = (entry = 'first') => (entry === 'newProgram' ? 'n_done' : 'a_home');

/**
 * Adónde salen las tres puntas del camino «con entrenador» (conectado, «lo hago
 * después» y esperar el código). Desde la app no hay Aprende: `null` termina el
 * recorrido (§25.4.2).
 */
export const coachedExit = (a, entry = 'first') => (entry === 'newProgram' ? null : learnStart(a));

/** Primera pantalla de Aprende: el entrenador que no entrena solo ve sus tarjetas. */
export const learnStart = (a) => (a.role === 'trainer' && a.alsoTrains !== true ? 'a_cards' : 'a_home');

/** Primera pantalla de cada camino, la que abre la bifurcación. */
export const ROLE_START = { self: 's_level', coached: 'c_code', trainer: 't_clients' };

/**
 * Adónde lleva «Saltar», o `null` si no se puede (bifurcación, cuenta del
 * entrenador, su código personal…). Saltar es saltar el tramo con los valores por
 * defecto. Desde la app (`entry: 'newProgram'`) solo se salta dentro del constructor.
 */
export function skipTarget(id, a = {}, entry = 'first') {
  if (entry === 'newProgram' && !id.startsWith('b_')) return null;
  switch (id) {
    case 'units': case 'theme': return afterSettings(a);
    case 't_clients': case 't_groups': return 't_client';
    case 't_client': return learnStart(a);
    case 't_program': case 't_catalog': case 't_assign': return afterProgram(a);
    case 't_invite': return 't_self';
    case 't_self': return 'a_cards';
    case 'c_code': case 'c_confirm': case 'c_ask': case 'c_wait': case 'c_copy': case 'c_linked': return 'a_home';
    case 's_level': case 's_choice': case 's_goal': case 's_days': return 's_props';
    case 's_props': return 'a_home';
    case 's_adjust': return null;   // se vuelve con atrás
    case 'a_home': case 'a_input': case 'a_cards': return 'done';
    case 'b_sessions': case 'b_exercise': case 'b_volume': case 'b_done': return builderExit(a, entry);
    default: return null;   // welcome, recover, role, t_account, t_code, done, n_*
  }
}

/**
 * ¿Se puede volver atrás? Con historial, y no desde el cierre (en «Listo» la
 * barra ya está llena y volver a una tarjeta no cambia nada).
 */
export const canGoBack = (flow) => !!flow && flow.history.length > 0 && flow.screen !== 'done' && flow.screen !== 'n_done';

/**
 * La pestaña con la que se abre la app (§7.9): Clientes para el entrenador que no
 * entrena (`profile.homeTab`), salvo que tenga ocultas las pestañas de entrenador.
 */
export const entryTab = (profile) => (profile?.homeTab === 'Clients' && !profile?.proTabsHidden ? 'Clients' : 'Home');

// ── Entrada ──────────────────────────────────────────────────────────────────

/** El idioma del móvil: `en…` → inglés, lo demás → español (§5.2). */
export const deviceLanguage = (locale) => (String(locale ?? '').toLowerCase().startsWith('en') ? 'en' : 'es');

/**
 * La ruta con la que arranca la app (§16.4). Un programa creado a mitad del
 * recorrido (el constructor, las propuestas) no lo corta: manda el recorrido en curso.
 */
export function initialRouteFor({ flow, onboardingCompleted, hasProgram, hasActiveSession }) {
  if (flow?.entry === 'first' || (!onboardingCompleted && !hasProgram)) return 'Start';
  return hasActiveSession ? 'Workout' : 'Main';
}

/** El estado de un recorrido recién empezado (§16.2). */
export function newFlow(entry = 'first') {
  return {
    screen: entry === 'newProgram' ? 'n_source' : 'welcome',
    history: [],
    entry,
    answers: {
      langTouched: false, viaInvite: false, role: null,
      level: null, goal: null, days: null, path: null,
      coachApp: null, linked: null,
      clientsBand: null, groups: null,
      clientId: null, clientMode: null, account: null, codeSaved: false,
      programId: null, programSource: null, sent: false, builderCtx: null,
      alsoTrains: null,
    },
    done: [],
  };
}
