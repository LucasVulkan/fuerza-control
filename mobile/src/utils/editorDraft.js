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

// ── Marcas «editada» (P16-05) ────────────────────────────────────────────────
// Comparan lo de ahora con la copia: lo que no está en ella (nuevo) cuenta como
// editado. Sin copia no hay marcas. `draft` = `ui._editorDraft`.

// ¿Se ha tocado esta plantilla de sesión?
export const templateEdited = (draft, id, tpl) =>
  !!draft && !deepEqual(draft.snapshot.templates[id], tpl);

// ¿Se ha tocado este ejercicio (`exerciseId`) o bloque (`id`) de la plantilla?
// `order` no cuenta: mover una fila no es editarla.
const noOrder = ({ order, ...rest }) => rest; // eslint-disable-line no-unused-vars
export function rowEdited(draft, templateId, row) {
  const tpl = draft?.snapshot.templates[templateId];
  if (!draft) return false;
  const was = row.exerciseId != null
    ? tpl?.exercises?.find((e) => e.exerciseId === row.exerciseId)
    : tpl?.blocks?.find((b) => b.id === row.id);
  return !was || !deepEqual(noOrder(was), noOrder(row));
}
