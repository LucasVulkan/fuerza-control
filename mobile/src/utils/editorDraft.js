/**
 * Borrador del editor de programa (P16-01). Puro: sin store ni React.
 *
 * Al entrar en la base del editor se guarda una copia de lo que se puede tocar
 * (`ui._editorDraft`); el editor sigue escribiendo en el store como siempre.
 * Cancelar compara la copia con lo actual y, si hace falta, la escribe de vuelta.
 *
 * `kind: 'program'` → el programa `id` y todas sus sesiones.
 * `kind: 'template'` → una plantilla de sesión o sesión libre `id`, sin programa.
 */

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

export function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => k in b && deepEqual(a[k], b[k]));
}

// Lo editable ahora mismo: { program, templates }. Sin copiar.
export function captureEditable(state, kind, id) {
  if (kind === 'program') {
    const templates = Object.fromEntries(
      Object.entries(state.sessionTemplates).filter(([, tpl]) => tpl.programId === id),
    );
    return { program: state.programs[id] ?? null, templates };
  }
  const tpl = state.sessionTemplates[id];
  return { program: null, templates: tpl ? { [id]: tpl } : {} };
}

export function makeEditorDraft(state, kind, id) {
  const cur = captureEditable(state, kind, id);
  if (kind === 'program' && !cur.program) return null;
  return { kind, id, snapshot: clone(cur), startedAt: Date.now() };
}

// Qué `programs` / `sessionTemplates` dejan el estado como estaba en la copia:
// las sesiones creadas dentro se van y las borradas vuelven.
export function restoreEditorDraft(state, draft) {
  const { kind, id, snapshot } = draft;
  const kept = Object.fromEntries(
    Object.entries(state.sessionTemplates)
      .filter(([tid, tpl]) => (kind === 'program' ? tpl.programId !== id : tid !== id)),
  );
  const out = { sessionTemplates: { ...kept, ...snapshot.templates } };
  if (kind === 'program' && snapshot.program) out.programs = { ...state.programs, [id]: snapshot.program };
  return out;
}

// ¿Hay algo que descartar? Selector del store.
export const selectEditorDirty = (state) => {
  const d = state.ui?._editorDraft;
  return !!d && !deepEqual(d.snapshot, captureEditable(state, d.kind, d.id));
};
