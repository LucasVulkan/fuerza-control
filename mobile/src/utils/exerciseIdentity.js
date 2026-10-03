/**
 * Qué ejercicio es: la parte que SÍ separa historial (docs/specs/P09-exercise-variants.md §2.5).
 *
 * Un ejercicio se describe como `{ root, uni, variant }`:
 *   - `root`    el de dos manos del que sale (o él mismo, si es unilateral de por sí);
 *   - `uni`     a una mano;
 *   - `variant` la variante fijada como «ejercicio aparte», o null.
 *
 * Lo que no existe en la librería se DERIVA: una copia del de partida con id fijo
 * que se guarda en `customExercises`. Los ejercicios propios ya funcionan en toda
 * la app (se resuelven como librería + propios) y viajan con el programa y el
 * historial, así que un derivado no necesita ninguna capa de resolución nueva.
 * El id es canónico —siempre el mismo para el mismo ejercicio—, así dos móviles
 * que lo creen por separado llegan al mismo.
 *
 *   <root>__uni                unilateral sin gemelo en la librería
 *   <base>__<variantKey>       ejercicio aparte (base = root, gemelo o <root>__uni)
 *
 * Puro: sin store. Los nombres salen de es.json/en.json y no de la `t` del
 * idioma activo, porque el derivado guarda los dos.
 */
import es from '../locales/es.json';
import en from '../locales/en.json';
import { variantKey, variantLabel, isEmptyVariant } from './variants';

/** Material con el que tiene sentido hacer a una mano algo de dos. */
const UNI_EQUIPMENT = ['dumbbells', 'cables', 'machines', 'kettlebell', 'resistance_band'];

function tFrom(dict) {
  return (key, vars) => {
    const v = key.split('.').reduce((o, k) => o?.[k], dict);
    if (typeof v !== 'string') return key;
    return v.replace(/{{(\w+)}}/g, (_, k) => vars?.[k] ?? '');
  };
}
const T = { es: tFrom(es), en: tFrom(en) };

/** El gemelo unilateral de la librería (`unilateralOf === root`), o null. */
export function twinOf(root, lib) {
  for (const [id, def] of Object.entries(lib ?? {})) {
    if (def?.unilateralOf === root) return id;
  }
  return null;
}

/** `id` → `{ root, uni, natural, variant }`. `natural`: unilateral de por sí. */
export function decompose(id, lib) {
  const def = lib?.[id];
  if (def?.derived) {
    const { root, unilateral, variant } = def.derived;
    return { root, uni: !!unilateral, natural: !!lib?.[root]?.isUnilateral, variant: variant ?? null };
  }
  if (def?.unilateralOf) return { root: def.unilateralOf, uni: true, natural: false, variant: null };
  if (def?.isUnilateral) return { root: id, uni: true, natural: true, variant: null };
  return { root: id, uni: false, natural: false, variant: null };
}

/** El ejercicio de antes del «aparte»: el root, su gemelo o `<root>__uni`. */
function baseIdOf(root, uni, lib) {
  if (!uni || lib?.[root]?.isUnilateral) return root;
  return twinOf(root, lib) ?? `${root}__uni`;
}

function copy(def, patch) {
  const out = { ...def, ...patch, isCustom: false };
  delete out.unilateralOf;
  return out;
}

function unilateralDef(root, rootDef) {
  return copy(rootDef, {
    id:           `${root}__uni`,
    name:         T.es('variants.nameUnilateral', { name: rootDef.name }),
    nameEn:       T.en('variants.nameUnilateral', { name: rootDef.nameEn ?? rootDef.name }),
    isUnilateral: true,
    // Una mano no tiene anchura.
    variants:     rootDef.variants?.grip ? { grip: rootDef.variants.grip } : undefined,
    derived:      { root, unilateral: true, variant: null },
  });
}

/**
 * `{ root, uni, variant }` → `{ id, def }`. `def` es la definición a guardar en
 * `customExercises`, o null si el id ya existe en `lib`.
 */
export function compose({ root, uni = false, variant = null }, lib) {
  const apart  = variant && !isEmptyVariant(variant) ? variant : null;
  const baseId = baseIdOf(root, uni, lib);
  const id     = apart ? `${baseId}__${variantKey(apart)}` : baseId;
  if (lib?.[id]) return { id, def: null };

  const rootDef = lib?.[root];
  if (!rootDef) return { id, def: null };
  const baseDef = lib[baseId] ?? unilateralDef(root, rootDef);
  if (!apart) return { id, def: baseDef };

  return {
    id,
    def: copy(baseDef, {
      id,
      name:     T.es('variants.nameApart', { name: baseDef.name, variant: variantLabel(apart, T.es) }),
      nameEn:   T.en('variants.nameApart', { name: baseDef.nameEn ?? baseDef.name, variant: variantLabel(apart, T.en) }),
      variants: {},   // la variante ya es parte del ejercicio
      derived:  { root, unilateral: !!uni, variant: apart },
    }),
  };
}

/**
 * ¿Sale el interruptor «Unilateral» para este ejercicio de dos manos? Si hay
 * gemelo en la librería, o si el material permite hacerlo a una mano (una
 * barra se coge con dos).
 */
export function canBeUnilateral(def, lib) {
  if (!def || def.isUnilateral) return false;
  if (twinOf(def.id, lib)) return true;
  return (def.equipment ?? []).some((e) => UNI_EQUIPMENT.includes(e));
}
