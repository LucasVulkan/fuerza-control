/**
 * Entrada al constructor guiado (docs/specs/O03-onboarding-caminos.md §10, §18).
 *
 * La llaman los tres caminos que crean un programa: «por mi cuenta» (`'self'`),
 * «lo copio a mano» del camino con entrenador (`'copy'`) y el programa del
 * cliente del entrenador (`'trainer'`). Vive aparte de `screens/builder.jsx`
 * para que los caminos la importen sin depender de las pantallas del
 * constructor (se implementan en paralelo, O03 §27).
 */
import { useStore } from '../../../store/useStore';

/** `goTo`: el que recibe cada pantalla del recorrido. `ctx`: 'self' | 'trainer' | 'copy'. */
export function startBuilder(goTo, ctx) {
  useStore.getState().flowAnswer({ builderCtx: ctx });
  goTo('b_sessions');
}
