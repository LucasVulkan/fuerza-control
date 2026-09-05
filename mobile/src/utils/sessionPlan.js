/**
 * sessionPlan — «¿cuál sesión toca, y por qué?».
 *
 * Las tres frases que daban por hecho que se entrena rotando estaban repartidas
 * por la HomeView disfrazadas de detalles de maquetación (docs/specs/
 * home-sessions.md §5): el rótulo del hero salía de una rama de
 * `getSessionStatus`, el marcador de la fila leía `template.label` dentro de la
 * propia fila, y el contador se componía en la pantalla con los dos números de
 * `computeCycleProgress`. Aquí están juntas, que es lo único que hace esta
 * función: NO añade ni una funcionalidad, devuelve exactamente lo que la
 * pantalla calculaba antes.
 *
 * Hoy solo sabe rotar. Cuando haya otro modo de programa, un `switch` — y el
 * único que choca de frente (a la carta) sale con `heroLabel: null`, que la
 * pantalla ya sabe interpretar: sin hero manda la lista (§5.3).
 *
 * @param {object}   args
 * @param {Array}    args.days               `[{ templateId, label }]` en orden fijo A→F.
 * @param {string[]} [args.cycleCompletedIds] Plantillas ya hechas en este ciclo.
 * @param {string}   [args.activeTemplateId]  Sesión a medias, si la hay.
 * @param {Function} args.t                   i18n.
 * @returns {{
 *   heroTemplateId: string|null,  // null ⇒ no se pinta hero
 *   heroLabel:      string|null,
 *   rows:           Array<{ templateId: string, marker: string, isDone: boolean }>,
 *   subtitle:       string|null,  // null ⇒ no se pinta contador
 * }}
 */
export function sessionPlan({ days = [], cycleCompletedIds, activeTemplateId, t }) {
  const doneIds = new Set(cycleCompletedIds ?? []);
  const done    = days.filter((d) => doneIds.has(d.templateId)).length;

  // La sesión a medias manda sobre el orden: es literalmente la que estás
  // haciendo. Sin ninguna abierta, la que toca es la primera SIN completar en
  // orden fijo — por plantilla y no por posición, que es lo que aguanta
  // entrenar fuera de orden.
  const active = days.find((d) => d.templateId === activeTemplateId) ?? null;
  const hero   = active ?? days.find((d) => !doneIds.has(d.templateId)) ?? null;

  return {
    heroTemplateId: hero?.templateId ?? null,
    heroLabel:      hero == null ? null : t(active ? 'home.sessionActive' : 'home.sessionNext'),
    // El hero SALE de la lista: las demás conservan su orden alfabético, así
    // que ninguna cambia de sitio al completarse.
    rows: days
      .filter((d) => d.templateId !== hero?.templateId)
      .map((d) => ({
        templateId: d.templateId,
        // Cadena corta, no "la letra": los 20 px del hueco de marcador aguantan
        // tres caracteres sin que nada se rompa (no hay caja que reventar).
        marker:     d.label ?? '',
        isDone:     doneIds.has(d.templateId),
      })),
    subtitle: days.length ? t('home.cycleCount', { done, total: days.length }) : null,
  };
}
