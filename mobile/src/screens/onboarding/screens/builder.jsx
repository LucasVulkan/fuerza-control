/**
 * Las pantallas del constructor guiado del recorrido de entrada (O03 §10, tareas
 * O03-02 y O03-03): sesiones, un ejercicio, volumen y «ya tiene forma». Un solo constructor
 * para los tres sitios que lo usan (`startBuilder`: `'self'`, `'copy'`, `'trainer'`):
 * cambia la profundidad, no las pantallas.
 *
 * Crea el programa de verdad al salir del primer paso y los siguientes lo editan con
 * las acciones del store (ver `builderProgram.js`). Cada pantalla recibe `goTo(id)`.
 *
 * No hay paso de progresión (decisión del 14-oct-2026): el ejercicio se queda con la
 * que trae de la biblioteca y la nota de «ya tiene forma» dice dónde cambiarla.
 *
 * Maqueta: docs/mockups/onboarding-2.html (b_sessions, b_exercise, b_volume, b_done).
 */
import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Reanimated, {
  FadeInDown, FadeOut, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
  interpolateColor, useReducedMotion,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import { Text } from '../../../components/ui/Text';
import { Rise } from '../../../components/ui/Rise';
import NumberChips from '../../../components/ui/NumberChips';
import StepField from '../../../components/ui/StepField';
import NameField from '../../../components/ui/NameField';
import { FlowBody, FlowTitle, FlowFooter, FlowNote } from '../../../components/onboarding/flow';
import BuilderBar from '../../../components/onboarding/builder/BuilderBar';
import SessionBlock from '../../../components/onboarding/builder/SessionBlock';
import ExerciseSearch from '../../../components/onboarding/builder/ExerciseSearch';
import {
  LETTERS, useBuilderProgram, useExerciseDef, exerciseName,
} from '../../../components/onboarding/builder/useBuilderProgram';
import { spacing, textStyles, withOpacity, getCardRadii } from '../../../theme';
import ClientRow from '../../../components/ClientRow';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { equipmentOf } from '../../../utils/exerciseTaxonomy';
import { DEFAULT_TARGET } from '../../../utils/progression';
import {
  SESSION_CHOICES, isDeep, VOLUME_LIMITS, withReps, volumeLabel,
} from '../../../utils/onboardingBuilder';
import {
  ensureBuilderProgram, defaultProgramName, syncBuilderDone, sendBuilderProgram, builderExitNow, leaveBuilder,
} from '../builderProgram';

import { isNetworkError } from '../../../utils/networkError';

const K = 'onboardingFlow.builder';

// Tras el ejercicio viene el volumen, y de ahí «ya tiene forma».
const AFTER_EXERCISE = 'b_volume';

// Constante y no `{}` en el selector: zustand 5 repinta sin fin si devuelve un objeto nuevo cada vez.
const NONE = {};
const answersOf = (s) => s.onboardingFlow?.answers ?? NONE;

/** «B», «B y C», «B, C y D». */
const listLetters = (letters, and) => (letters.length < 2
  ? letters.join('')
  : `${letters.slice(0, -1).join(', ')} ${and} ${letters[letters.length - 1]}`);

// ── 1 · Sesiones (§10.1.1) ────────────────────────────────────────────────────

const GRID_GAP = spacing.sm2;
const SIDE = spacing.lg + 1;   // el relleno lateral de FlowBody

function SessionCard({ letter, index, width }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return (
    <Reanimated.View
      entering={FadeInDown.delay(index * 70).duration(400)}
      exiting={FadeOut.duration(150)}
      style={[styles.sess, { width }]}
    >
      <Text style={styles.sessLetter}>{letter}</Text>
      <Text style={styles.sessName}>{t(`${K}.session`, { letter })}</Text>
      <Text style={styles.sessEmpty}>{t(`${K}.empty`)}</Text>
    </Reanimated.View>
  );
}

function Sessions({ goTo }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const trainer = useStore((s) => answersOf(s).builderCtx === 'trainer');
  const days    = useStore((s) => answersOf(s).days);
  const { count } = useBuilderProgram();
  // Con el programa ya creado (se volvió atrás) viene su número; si no, los días contestados antes.
  const [n, setN] = useState(() => count || (Number.isInteger(days) && days > 0 ? Math.min(days, SESSION_CHOICES.length) : null));
  const busy = useRef(false);

  const cardW = Math.floor((width - 2 * SIDE - 2 * GRID_GAP) / 3);

  // El programa nace al elegir el número (y se ajusta si lo cambia), así «Saltar» en cualquier
  // momento sale con él hecho. Los días ya contestados cuentan como elegidos.
  function choose(v) {
    setN(v);
    ensureBuilderProgram(v, t);
  }
  useEffect(() => { if (n && !count) ensureBuilderProgram(n, t); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  function next() {
    if (!n || busy.current) return;
    if (ensureBuilderProgram(n, t)) goTo('b_exercise');
  }

  async function later() {
    if (busy.current) return;
    busy.current = true;
    await leaveBuilder(goTo, t, n ?? 0);
    busy.current = false;
  }

  return (
    <FlowBody
      footer={(
        <FlowFooter
          primary={{ label: t('onboardingFlow.common.next'), onPress: next, disabled: !n }}
          secondary={[{ label: t(`${K}.later`), onPress: later }]}
        />
      )}
    >
      <Rise index={0}><BuilderBar sessions={n ?? 0} /></Rise>
      <FlowTitle text={t(`${K}.sessions.${trainer ? 'titleTrainer' : 'titleSelf'}`)} sub={t(`${K}.sessions.sub`)} index={1} />
      <Rise index={3}><NumberChips values={SESSION_CHOICES} value={n} onChange={choose} /></Rise>
      <View style={styles.grid}>
        {LETTERS.slice(0, n ?? 0).split('').map((letter, i) => (
          <SessionCard key={letter} letter={letter} index={i} width={cardW} />
        ))}
      </View>
    </FlowBody>
  );
}

// ── 2 · Un ejercicio (§10.1.2) ────────────────────────────────────────────────

/** «+ Añadir ejercicio»: el borde discontinuo late en lima para decir dónde tocar. */
function AddButton({ label, onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const beat = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    beat.set(withRepeat(withSequence(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
    ), -1));
  }, [beat, reduced]);
  // Fuera del worklet: `withOpacity` es JS normal y en el hilo de UI no existe.
  const clear = withOpacity(th.colors.accent, 0);
  const glow = useAnimatedStyle(() => ({
    borderColor:     interpolateColor(beat.get(), [0, 1], [th.colors.muted, th.colors.accent]),
    backgroundColor: interpolateColor(beat.get(), [0, 1], [clear, th.tint.accent10]),
  }));
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Reanimated.View style={[styles.add, glow]}>
        <Text style={styles.addTxt}>{label}</Text>
      </Reanimated.View>
    </Pressable>
  );
}

function Exercise({ goTo }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const language = useStore((s) => s.profile.language ?? 'es');
  const deep = useStore((s) => { const a = answersOf(s); return isDeep(a.builderCtx, a.level); });
  const { count, tplId, exId, exCount } = useBuilderProgram();
  const def = useExerciseDef(exId);
  const [open, setOpen] = useState(false);
  const busy = useRef(false);

  function pick(id) {
    const s = useStore.getState();
    if (tplId) {
      if (!exId) s.addExercise(tplId, id);
      else if (id !== exId) {
        s.replaceExercise(tplId, exId, id);
        s.flowAnswer({ volDone: false, volLabel: null });   // otro ejercicio, otro volumen
      }
    }
    setOpen(false);
    syncBuilderDone(t);
  }

  async function later() {
    if (busy.current) return;
    busy.current = true;
    await leaveBuilder(goTo, t);
    busy.current = false;
  }

  const rest = LETTERS.slice(1, count).split('');
  // Mientras busca, el pie se queda en «Lo termino después»: el botón estorba con el teclado.
  const footer = (
    <FlowFooter
      primary={open ? undefined : { label: t('onboardingFlow.common.next'), onPress: () => goTo(AFTER_EXERCISE), disabled: !exId }}
      secondary={[{ label: t(`${K}.later`), onPress: later }]}
    />
  );

  return (
    <FlowBody footer={footer}>
      <Rise index={0}><BuilderBar /></Rise>
      <FlowTitle text={t(`${K}.exercise.title`)} sub={open ? undefined : t(`${K}.exercise.sub`)} index={1} />
      <Rise index={3}>
        <SessionBlock letter="A" title={t(`${K}.session`, { letter: 'A' })} note={t(`${K}.exCount`, { count: exCount })}>
          {open ? (
            <ExerciseSearch deep={deep} exclude={exId} onPick={pick} onClose={() => setOpen(false)} />
          ) : def ? (
            <View style={styles.exRow}>
              <View style={styles.exMain}>
                <Text style={styles.exName} numberOfLines={1}>{exerciseName(def, language)}</Text>
                <Text style={styles.exMeta} numberOfLines={1}>{equipmentOf(def).map((e) => t(`exerciseSelector.equipment.${e}`, e)).join(', ')}</Text>
              </View>
              <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button">
                <Text style={styles.change}>{t(`${K}.exercise.change`)}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.addWrap}><AddButton label={t(`${K}.exercise.add`)} onPress={() => setOpen(true)} /></View>
          )}
        </SessionBlock>
      </Rise>
      {rest.map((letter, i) => (
        <Rise key={letter} index={4 + i}>
          <SessionBlock dim letter={letter} title={t(`${K}.session`, { letter })} note={t(`${K}.exercise.later`)} />
        </Rise>
      ))}
    </FlowBody>
  );
}

// ── 3 · Volumen (§10.3) ───────────────────────────────────────────────────────

const isTimeEx = (cfg, def) => ['time', 'weight_time'].includes(cfg?.inputType ?? def?.inputType)
  || (cfg?.progressionModel ?? def?.progressionModel) === 'time_progression';

function Volume({ goTo }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  // Todos ven series, repeticiones y descanso, como en el editor (14-oct: la versión
  // sencilla «Fuerza · Músculo · Resistencia» costaba entenderla).
  const { tplId, exId } = useBuilderProgram();
  const def = useExerciseDef(exId);
  const language = useStore((s) => s.profile.language ?? 'es');
  const cfg = useStore((s) => (tplId && exId ? s.sessionTemplates[tplId]?.exercises?.find((e) => e.exerciseId === exId) ?? null : null));
  const time = isTimeEx(cfg, def);
  const busy = useRef(false);

  // Los valores que ya tiene el ejercicio (los de la biblioteca si no se tocó): se puede pasar sin tocar nada.
  const [v, setV] = useState(() => ({
    sets:    cfg?.sets    ?? 3,
    restSec: cfg?.restSec ?? 90,
    minReps: cfg?.minReps ?? def?.minReps ?? DEFAULT_TARGET.minReps,
    maxReps: cfg?.maxReps ?? def?.maxReps ?? DEFAULT_TARGET.maxReps,
    minTime: cfg?.minTime ?? def?.minTime ?? DEFAULT_TARGET.minTime,
  }));

  // Cada cambio va al ejercicio real: «Saltar» y «Lo termino después» se llevan lo que haya.
  function write(patch) {
    setV((p) => ({ ...p, ...patch }));
    if (tplId && exId) useStore.getState().updateExerciseParams(tplId, exId, patch);
  }
  const setReps = (change) => write(withReps(v.minReps, v.maxReps, change));

  function lightChip() {
    useStore.getState().flowAnswer({
      volDone: true,
      volLabel: volumeLabel({ sets: v.sets, minReps: time ? v.minTime : v.minReps, maxReps: v.maxReps, time }),
    });
  }
  function next() { lightChip(); goTo('b_done'); }
  async function later() {
    if (busy.current) return;
    busy.current = true;
    lightChip();
    await leaveBuilder(goTo, t);
    busy.current = false;
  }

  const [sMin, sMax] = VOLUME_LIMITS.sets;
  const [rMin, rMax] = VOLUME_LIMITS.rest;
  const [pMin, pMax] = VOLUME_LIMITS.reps;
  const fixed = v.minReps === v.maxReps;

  return (
    <FlowBody
      footer={(
        <FlowFooter
          primary={{ label: t('onboardingFlow.common.next'), onPress: next }}
          secondary={[{ label: t(`${K}.later`), onPress: later }]}
        />
      )}
    >
      <Rise index={0}><BuilderBar /></Rise>
      <FlowTitle
        // El nombre del ejercicio de la sesión A: el volumen es suyo, no de todo el programa.
        text={def ? exerciseName(def, language).replace(/\*/g, '') : t(`${K}.volume.title`)}
        sub={t(`${K}.volume.subDeep`)}
        index={1}
      />

      <Rise index={3}>
        <View style={styles.vGrid}>
          <View style={styles.vRow}>
            <StepField label={t('exerciseEditor.fieldSets')} value={v.sets} onChange={(x) => write({ sets: x })} min={sMin} max={sMax} />
            <StepField label={t('exerciseEditor.fieldRest')} value={v.restSec} onChange={(x) => write({ restSec: x })} min={rMin} max={rMax} unit="s" />
          </View>
          {!time && (
            <View style={styles.vRow}>
              <StepField label={t('exerciseEditor.fieldMinReps')} value={v.minReps} onChange={(x) => setReps({ minReps: x })} min={pMin} max={pMax} />
              <StepField label={t('exerciseEditor.fieldMaxReps')} value={v.maxReps} onChange={(x) => setReps({ maxReps: x })} min={pMin} max={pMax} />
            </View>
          )}
        </View>
      </Rise>
      {!time && (
        <Rise index={4}>
          <Text style={styles.hint}>
            {fixed ? t(`${K}.volume.hintFixed`, { reps: v.minReps }) : t(`${K}.volume.hintRange`, { min: v.minReps, max: v.maxReps })}
          </Text>
        </Rise>
      )}
    </FlowBody>
  );
}

// ── 4 · «Ya tiene forma» (§10.1.4) ────────────────────────────────────────────

/** La fila de Clientes de verdad (C08), ya con el programa: así lo verá en Clientes. */
function BuilderClientRow({ line }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const client = useStore((s) => s.clients[answersOf(s).clientId]);
  if (!client) return null;
  const app = !!client.slotId;
  return (
    <ClientRow
      client={client}
      link={app ? 'invited' : 'none'}
      badgeLabel={t('clients.statusInvited')}
      radii={getCardRadii(th, true, true)}
      meta={{ text: line }}
      week={null}
    />
  );
}

function Done({ goTo }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const language   = useStore((s) => s.profile.language ?? 'es');
  const trainer    = useStore((s) => answersOf(s).builderCtx === 'trainer' && !!answersOf(s).clientId);
  const clientName = useStore((s) => (trainer ? s.clients[answersOf(s).clientId]?.name ?? '' : ''));
  const withApp    = useStore((s) => !!(trainer && s.clients[answersOf(s).clientId]?.slotId));
  const programName = useStore((s) => { const id = answersOf(s).programId; return id ? s.programs[id]?.name ?? '' : ''; });
  const stageName   = useStore((s) => { const id = answersOf(s).programId; return id ? s.programs[id]?.stages?.[0]?.name ?? '' : ''; });
  const renameProgram = useStore((s) => s.renameProgram);
  const showToast     = useStore((s) => s.showToast);
  const { programId, count, exId, exCount } = useBuilderProgram();
  const def = useExerciseDef(exId);

  const fallback = defaultProgramName(t);
  const [name, setName] = useState(() => (programName === fallback ? '' : programName));
  const [busy, setBusy] = useState(false);
  const shown = name.trim() || programName || fallback;

  // Las sesiones sin ejercicio: A lleva el que se eligió, el resto va vacío.
  const empty = LETTERS.slice(exCount ? 1 : 0, count).split('');
  const send  = withApp && exCount > 0;

  async function save() {
    if (busy) return;
    setBusy(true);
    const wanted = name.trim();
    if (programId && wanted && wanted !== programName) renameProgram(programId, wanted);
    try {
      await sendBuilderProgram();
    } catch (err) {
      // Sin conexión no es un fallo: el programa queda pendiente y sale solo (U15-01).
      if (!isNetworkError(err)) {
        showToast(t(`${K}.done.sendFailed`), 3500, 'error');
        setBusy(false);
        return;
      }
      showToast(t('sync.offlineQueued'), 3500, 'neutral');
    }
    syncBuilderDone(t);
    if (useStore.getState().onboardingFlow?.screen === 'b_done') goTo(builderExitNow());
  }

  const and = t(`${K}.done.listAnd`);
  const where = trainer
    ? t(`${K}.done.${empty.length ? 'noteClientEmpty' : 'noteClientFull'}`, { count: empty.length, letters: listLetters(empty, and), client: clientName })
    : t(`${K}.done.noteSelf`, { name: shown });

  return (
    <FlowBody
      footer={(
        <FlowFooter
          primary={{
            label: send ? t(`${K}.done.saveSend`, { name: clientName }) : t(`${K}.done.save`),
            onPress: save,
            disabled: busy,
          }}
        />
      )}
    >
      <Rise index={0}><BuilderBar /></Rise>
      <FlowTitle
        text={trainer ? t(`${K}.done.titleClient`, { name: clientName }) : t(`${K}.done.title`)}
        sub={t(`${K}.done.sub`)}
        index={1}
      />
      <Rise index={3}>
        <NameField
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder={programName || fallback}
          placeholderTextColor={th.colors.mutedLight}
          accessibilityLabel={t(`${K}.done.nameLabel`)}
          returnKeyType="done"
        />
      </Rise>

      {trainer ? (
        <>
          <Rise index={4}><Text style={styles.label}>{t(`${K}.done.clientsLabel`)}</Text></Rise>
          <Rise index={5}><BuilderClientRow line={`${shown} · ${stageName}`} /></Rise>
        </>
      ) : (
        <>
          <Rise index={4}>
            <SessionBlock letter="A" title={t(`${K}.session`, { letter: 'A' })} note={t(`${K}.exCount`, { count: exCount })}>
              {!!def && (
                <View style={styles.exRow}>
                  <Text style={[styles.exName, styles.exMain]} numberOfLines={1}>{exerciseName(def, language)}</Text>
                </View>
              )}
            </SessionBlock>
          </Rise>
          {empty.filter((l) => l !== 'A').map((letter, i) => (
            <Rise key={letter} index={5 + i}>
              <SessionBlock dim letter={letter} title={t(`${K}.session`, { letter })} note={t(`${K}.empty`)} />
            </Rise>
          ))}
        </>
      )}
      <Rise index={6}><FlowNote tone="acc" text={where} /></Rise>
    </FlowBody>
  );
}

export default { b_sessions: Sessions, b_exercise: Exercise, b_volume: Volume, b_done: Done };

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  // Sesiones
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginTop: spacing.lg },
  sess: { backgroundColor: th.colors.surface, borderRadius: th.radius.lg, padding: spacing.md + 2 },
  sessLetter: { ...textStyles.heroGlyph, color: th.colors.accent, lineHeight: 40, paddingRight: 2, includeFontPadding: false },
  sessName:   { ...textStyles.bodyStrong, color: th.colors.text, marginTop: spacing.xs2 },
  sessEmpty:  { ...textStyles.label, color: th.colors.muted },

  // Un ejercicio
  addWrap: { marginTop: spacing.md },
  add: {
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: th.radius.md,
    paddingVertical: spacing.lg - 2, alignItems: 'center',
  },
  addTxt: { ...textStyles.button, color: th.colors.accent },
  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: th.colors.bg, borderRadius: th.radius.md,
    paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg - 3, marginTop: spacing.md,
  },
  exMain: { flex: 1, minWidth: 0 },
  exName: { ...textStyles.bodyStrong, color: th.colors.text },
  exMeta: { ...textStyles.label, color: th.colors.mutedLight },
  change: { ...textStyles.button, color: th.colors.accent },

  // Volumen
  vGrid: { gap: spacing.md, marginTop: spacing.sm2 },
  vRow:  { flexDirection: 'row', gap: spacing.md },
  hint:  { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.md },

  // Ya tiene forma
  nameInput: {
    ...textStyles.bodyStrong, color: th.colors.text,
    backgroundColor: th.colors.surface, borderRadius: th.radius.md,
    paddingVertical: spacing.lg - 2, paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  label: { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase', marginBottom: spacing.sm2 },
});
