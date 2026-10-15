/**
 * Lo que el recorrido de entrada (O03 §11.2, §11.4) enseña de «las sesiones del
 * usuario» en las miniaturas de Inicio: las de su programa si ya lo tiene, o
 * ninguna (la pantalla pone entonces nombres genéricos).
 *
 * Puro y sin React para poder probarlo.
 */
import { stageDaysAt } from './stageProgress';
import { sessionStats } from './sessionStats';

/**
 * Hasta `max` sesiones de la primera etapa del programa, en su orden:
 * `[{ marker, name, exercises, minutes }]`. Sin programa, o con sesiones que ya
 * no existen, lo que haya (puede ser `[]`).
 */
export function previewSessions(program, sessionTemplates = {}, allExercises = {}, max = 4) {
  return stageDaysAt(program, 0)
    .map((d, i) => {
      const tpl = sessionTemplates[d.sessionTemplateId];
      if (!tpl) return null;
      const { exercises, minutes } = sessionStats(tpl, allExercises);
      return { marker: d.label || String.fromCharCode(65 + i), name: tpl.name ?? '', exercises, minutes };
    })
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Las tarjetas de «Aprende» (O03 §11.4) según lo contestado, por id:
 *  · entrenador que no entrena: clientes, plantillas, próxima sesión y, si su
 *    cliente es «le apuntas tú», apuntar sus sesiones
 *  · el resto: [clientes, si es entrenador] · hoy · «Cambia lo que quieras»
 *    —o, con entrenador conectado, que él ve tus entrenos— · sesión libre
 */
export function learnCards(a = {}) {
  if (a.role === 'trainer' && a.alsoTrains !== true) {
    return ['clients', 'templates', 'next', ...(a.clientMode === 'self' ? ['log'] : [])];
  }
  return [...(a.role === 'trainer' ? ['clients'] : []), 'today', a.linked ? 'sees' : 'edit', 'free'];
}
