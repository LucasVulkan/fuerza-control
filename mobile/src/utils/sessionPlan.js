import { startOfWeek } from './weekProgress';

/**
 * sessionPlan — «¿cuál sesión toca, y por qué?».
 *
 * Las tres frases que daban por hecho que se entrena rotando estaban repartidas
 * por la HomeView disfrazadas de detalles de maquetación (docs/specs/
 * home-sessions.md §5): el rótulo del hero, el marcador de la fila y el
 * contador. Aquí están juntas, y es la ÚNICA regla de "qué toca": la usan la
 * Home del atleta, la tarjeta de cliente y "Preparar sesión" del entrenador,
 * cada uno con su historial (el propio, o el espejado del cliente).
 *
 * Desde weeks-model.md §3.5 no hay rotación guardada: toca **la que más tiempo
 * llevas sin hacer**. En el uso normal es la misma rotación (A B C A B → C; si
 * te saltas C y repites A, sigue siendo C) y con 3 sesiones y 4 días reproduce
 * `weekPattern`. Al leerse del historial, borrar una sesión cambia la
 * sugerencia — es una sugerencia, no progreso.
 *
 * @param {object}   args
 * @param {Array}    args.days             `[{ templateId, label }]` de la etapa, en orden A→F.
 * @param {Array}    [args.log]            Historial: `[{ sessionTemplateId, timestamp }]`.
 * @param {string}   [args.activeTemplateId] Sesión a medias, si la hay.
 * @param {number}   [args.now]            Reloj inyectable.
 * @param {Function} args.t                i18n.
 * @returns {{
 *   heroTemplateId: string|null,  // null ⇒ no hay sesiones
 *   heroLabel:      string|null,
 *   rows:           Array<{ templateId: string, marker: string, isDone: boolean, isHero: boolean }>,
 *   subtitle:       string|null,  // null ⇒ no se pinta contador
 *   weekDone:       number,       // entrenos de la etapa desde el lunes, repeticiones incluidas
 * }}
 */
export function sessionPlan({ days = [], log = [], activeTemplateId, now = Date.now(), t }) {
  const ids       = new Set(days.map((d) => d.templateId));
  const weekStart = startOfWeek(now);
  const lastDone  = {};
  let weekDone    = 0;
  log.forEach(({ sessionTemplateId: tid, timestamp: ts }) => {
    if (!ids.has(tid) || typeof ts !== 'number') return;
    if (!(lastDone[tid] >= ts)) lastDone[tid] = ts;
    if (ts >= weekStart) weekDone += 1;
  });

  // La sesión a medias manda: es literalmente la que estás haciendo. Si no, la
  // de última vez más antigua; las nunca hechas primero y, a igualdad, el orden
  // del programa (el `<` estricto se queda con la primera).
  const active = days.find((d) => d.templateId === activeTemplateId) ?? null;
  const oldest = days.reduce((best, d) =>
    (best == null || (lastDone[d.templateId] ?? -Infinity) < (lastDone[best.templateId] ?? -Infinity) ? d : best),
  null);
  const hero = active ?? oldest;

  return {
    heroTemplateId: hero?.templateId ?? null,
    heroLabel:      hero == null ? null : t(active ? 'home.sessionActive' : 'home.sessionNext'),
    // El hero no sale de la lista: la pantalla las pinta todas en orden y a la
    // que toca le da otra escala en su hueco (home-sesiones-plegables.md §4.4).
    rows: days.map((d) => ({
      templateId: d.templateId,
      // Cadena corta, no "la letra": el hueco de marcador aguanta tres
      // caracteres sin que nada se rompa.
      marker:     d.label ?? '',
      // Hecha ESTA semana (weeks-model.md §3.6), no "en este ciclo".
      isDone:     (lastDone[d.templateId] ?? -Infinity) >= weekStart,
      isHero:     d.templateId === hero?.templateId,
    })),
    // Entrenos de la semana contra las sesiones de la etapa, que son los que se
    // esperan cada semana (weeks-model.md §0.4). Se cuentan entrenos y no filas
    // marcadas: repetir la A cuenta como uno más.
    subtitle: days.length
      ? t('home.weekCount', { done: weekDone, total: days.length })
      : null,
    // El número suelto, para quien compone su propia frase (tarjeta de cliente).
    weekDone,
  };
}
