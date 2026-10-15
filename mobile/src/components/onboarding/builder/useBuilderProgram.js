/**
 * Lo que las pantallas del constructor guiado leen del programa que están
 * montando (O03 §10). Solo valores simples: un selector de zustand que devolviera
 * un objeto o una lista nuevos en cada llamada repintaría sin fin.
 */
import { useStore } from '../../../../store/useStore';
import { stageDays } from '../../../utils/stageProgress';

export const LETTERS = 'ABCDEFG';

/**
 * `programId` el del recorrido, `count` sus sesiones, `tplId` la plantilla de la
 * sesión A, `exId` su primer ejercicio y `exCount` cuántos tiene.
 */
export function useBuilderProgram() {
  const programId = useStore((s) => s.onboardingFlow?.answers.programId ?? null);
  const count     = useStore((s) => (programId ? stageDays(s.programs[programId]).length : 0));
  const tplId     = useStore((s) => (programId ? stageDays(s.programs[programId])[0]?.sessionTemplateId ?? null : null));
  const exId      = useStore((s) => (tplId ? s.sessionTemplates[tplId]?.exercises?.[0]?.exerciseId ?? null : null));
  const exCount   = useStore((s) => (tplId ? s.sessionTemplates[tplId]?.exercises?.length ?? 0 : 0));
  return { programId, count, tplId, exId, exCount };
}

/** La definición de un ejercicio de la biblioteca o propio; `null` si no está. */
export const useExerciseDef = (id) => useStore((s) => (id ? s.customExercises[id] ?? s.exerciseLibrary[id] ?? null : null));

/** El nombre en el idioma de la app (los propios no tienen `nameEn`). */
export const exerciseName = (def, language) => (language === 'en' ? def.nameEn ?? def.name : def.name);
