/**
 * ProgramDetailScreen — visualizador de programa.
 *
 * Spec: `mobile/docs/specs/program-view.md`.
 *
 * Es un VISUALIZADOR, no un tracker: no dice en qué etapa va el atleta ni por
 * qué semana. Dice qué ES el programa — cuántas etapas, cuánto volumen por
 * grupo lleva cada ciclo y qué se hace en cada sesión. Por eso la cabecera
 * lleva el resumen y no el estado, y por eso el selector de etapas cambia lo
 * que se mira sin tocar la etapa activa del programa.
 *
 * Todo lo que compara —marca del carril, delta y línea de cambios— usa la
 * ETAPA 1 como referencia, que es además contra la que `applyRx` deriva los
 * peldaños de una escalera. Con la etapa 1 seleccionada no hay nada que
 * comparar y esas tres cosas desaparecen.
 */
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { spacing, textStyles, borders } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { resolveColor } from '../themes';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { ArrowIcon } from '../components/ui/EditorIcons';
import { sessionSlots } from '../utils/sessionSlots';
import { sessionStats } from '../utils/sessionStats';
import { warmupSteps } from '../../../src/utils/warmup';
import { stageDiff, isEmptyDiff } from '../../../src/utils/programDiff';
import {
  plannedSets, plannedSetsByGroup, SETS_TARGET_MIN, SETS_TARGET_MAX,
} from '../../../src/utils/trainingLoad';

const HEADER_H = 64;
// Misma escala mínima que las barras de `LoadTab`: sin suelo, un programa de
// 6 series por grupo pinta barras llenas y parece que va sobrado.
const SETS_SCALE_MIN = 24;

// ── Texto ─────────────────────────────────────────────────────────────────────

/** Prescripción de un ejercicio, cayendo al `def` cuando el `exConfig` no la trae. */
function prescription(exConfig, def, t) {
  const sets    = plannedSets(exConfig, def);
  const model   = exConfig.progressionModel ?? def?.progressionModel;
  const timed   = exConfig.inputType === 'time' || exConfig.inputType === 'weight_time'
               || model === 'time_progression';
  const minReps = exConfig.minReps ?? def?.minReps;
  const maxReps = exConfig.maxReps ?? def?.maxReps;
  const minTime = exConfig.minTime ?? def?.minTime;
  const maxTime = exConfig.maxTime ?? def?.maxTime;

  let range;
  if (timed)                       range = `${minTime ?? 20}–${maxTime ?? 40} s`;
  else if (model === 'submax')     range = t('workout.submax');
  else if (minReps == null)        range = '—';
  else if (minReps === maxReps)    range = `${minReps}`;
  else                             range = `${minReps}–${maxReps ?? minReps}`;
  if (def?.isUnilateral)           range += ` ${t('workout.perSide')}`;

  return { main: `${sets} × ${range}`, restSec: exConfig.restSec ?? def?.restSec ?? null };
}

/** Una etapa sin nombre se llama por su número, aquí y en el chip. */
function stageName(stage, i, t) {
  return stage?.name ?? t('programView.stageFallback', { n: i + 1 });
}

function blockMeta(block, t) {
  if (block.format === 'amrap') {
    return t('programView.blockMin', { count: Math.round((block.capSec ?? 600) / 60) });
  }
  if (block.format === 'emom') {
    const s  = block.intervalSec ?? 60;
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return t('programView.blockEmom', {
      count: block.rounds ?? 10,
      interval: `${mm}:${String(ss).padStart(2, '0')}`,
    });
  }
  const rounds = t('programView.blockRounds', { count: block.rounds ?? 3 });
  return block.capSec
    ? `${rounds} · ${t('programView.blockMin', { count: Math.round(block.capSec / 60) })}`
    : rounds;
}

/** Línea de cambios de la etapa. Se salta lo que está a cero; todo a cero → null. */
function diffLine(d, fromName, t) {
  if (isEmptyDiff(d)) return null;
  const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
  const parts = [];
  if (d.setsDelta !== 0) parts.push(t('programView.diffSets', { signed: signed(d.setsDelta) }));
  if (d.replaced)        parts.push(t('programView.diffReplaced', { count: d.replaced }));
  if (d.added)           parts.push(t('programView.diffAdded',    { count: d.added }));
  if (d.removed)         parts.push(t('programView.diffRemoved',  { count: d.removed }));
  if (d.blocksDelta > 0) parts.push(t('programView.diffBlocksAdded',   { count: d.blocksDelta }));
  if (d.blocksDelta < 0) parts.push(t('programView.diffBlocksRemoved', { count: -d.blocksDelta }));
  if (d.reps) {
    parts.push(t('programView.diffReps', { signed: signed(d.reps.delta), count: d.reps.count }));
  }
  return `${t('programView.diffPrefix', { name: fromName })} · ${parts.join(' · ')}`;
}

// ── Piezas ────────────────────────────────────────────────────────────────────

function Stat({ value, label }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function VolumeBar({ group, sets, baseSets, scale, showBase }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const inRange = sets >= SETS_TARGET_MIN && sets <= SETS_TARGET_MAX;
  // Fuera de rango en naranja, por arriba y por abajo — nunca rojo (UI-MIGRATION §4.9).
  const color = inRange ? th.colors.accent : th.colors.orange;
  const delta = sets - baseSets;

  return (
    <View style={styles.groupRow}>
      <Text style={styles.groupName} numberOfLines={1}>
        {group === 'other' ? t('load.groupOther') : t(`exerciseSelector.groups.${group}`)}
      </Text>
      <View style={styles.groupTrack}>
        <View style={[styles.groupFill, {
          width: `${Math.min(100, (sets / scale) * 100)}%`,
          backgroundColor: color,
        }]} />
        <View style={[styles.groupMark, { left: `${(SETS_TARGET_MIN / scale) * 100}%` }]} />
        <View style={[styles.groupMark, { left: `${(SETS_TARGET_MAX / scale) * 100}%` }]} />
        {showBase && (
          <View style={[styles.groupBaseMark, {
            left: `${Math.min(100, (baseSets / scale) * 100)}%`,
          }]} />
        )}
      </View>
      <Text style={[styles.groupCount, { color }]}>{sets}</Text>
      {showBase && (
        <Text style={[styles.groupDelta, delta === 0 && styles.groupDeltaFlat]}>
          {delta === 0 ? '' : delta > 0 ? `+${delta}` : `${delta}`}
        </Text>
      )}
    </View>
  );
}

function ExerciseRow({ num, exConfig, def, name, inGroup }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const { main, restSec } = prescription(exConfig, def, t);
  const warmup = exConfig.warmup ? warmupSteps(exConfig.warmup).length : 0;

  return (
    <View style={styles.exRow}>
      <Text style={styles.exNum}>{num}</Text>
      <View style={styles.exInfo}>
        <Text style={styles.exName}>{name}</Text>
        <View style={styles.exRxLine}>
          <Text style={styles.exRxMain}>{main}</Text>
          {exConfig.isKey && <Text style={styles.keyBadge}>{t('common.keyExercise')}</Text>}
          {/* En superserie el descanso es del grupo, no de la fila: lo pinta la
              cabecera del grupo (strength-blocks.md §2). */}
          {restSec != null && !inGroup && <Text style={styles.exRxRest}>{restSec} s</Text>}
        </View>
        {warmup > 0 && (
          <Text style={styles.exNote}>{t('programView.warmupLine', { count: warmup })}</Text>
        )}
        {exConfig.dropset && (
          <Text style={styles.exNote}>{t('programView.dropsetLine')}</Text>
        )}
      </View>
    </View>
  );
}

function SupersetGroup({ num, members, allExercises, exName }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const last   = members[members.length - 1];
  const lastDef = allExercises[last.exerciseId];
  const rounds = plannedSets(members[0], allExercises[members[0].exerciseId]);
  const rest   = last.restSec ?? lastDef?.restSec ?? 90;

  return (
    <View style={styles.ssGroup}>
      <Text style={styles.ssHead}>
        {t('programView.supersetHead', { count: rounds, rest })}
      </Text>
      {members.map((ex, i) => (
        <ExerciseRow
          key={ex.exerciseId}
          // La superserie comparte número y se distingue por letra (03A / 03B),
          // igual que el editor de sesión y la pantalla de entreno.
          num={`${num}${String.fromCharCode(65 + i)}`}
          exConfig={ex}
          def={allExercises[ex.exerciseId]}
          name={exName(allExercises[ex.exerciseId], ex.exerciseId)}
          inGroup
        />
      ))}
    </View>
  );
}

function BlockCard({ num, block, allExercises, exName }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const { fmt } = useWeightUnit();

  const line = (block.movements ?? []).map((m) => {
    const unit = m.unit && m.unit !== 'reps' ? ` ${t(`blocks.units.${m.unit}`)}` : '';
    const w    = m.weight ? ` · ${fmt(m.weight)}` : '';
    return `${exName(allExercises[m.exerciseId], m.exerciseId)} ${m.amount}${unit}${w}`;
  }).join('  ·  ');

  return (
    <View style={styles.blockRow}>
      <Text style={styles.exNum}>{num}</Text>
      <View style={styles.blockCard}>
      <View style={styles.blockHead}>
        {/* El formato no se sustituye por el nombre: "Metcon final" no dice si
            es un AMRAP o un EMOM, y eso es lo que hay que leer de un vistazo. */}
        <Text style={styles.blockFormat}>
          {t(`blocks.formats.${block.format}`)}
          {block.name ? ` · ${block.name}` : ''}
        </Text>
        <Text style={styles.blockMeta}>{blockMeta(block, t)}</Text>
      </View>
      {line ? <Text style={styles.blockMovements}>{line}</Text> : null}
      {block.notes ? <Text style={styles.blockNote}>{block.notes}</Text> : null}
      </View>
    </View>
  );
}

function SessionCard({ day, template, allExercises, exName }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const slots = sessionSlots(template);
  const stats = sessionStats(template, allExercises);
  const color = resolveColor(th, template?.color ?? 'var(--day1)');

  return (
    <View style={styles.session}>
      <View style={styles.sessionHead}>
        <Text style={[styles.sessionLetter, { color }]}>{day.label ?? '·'}</Text>
        <View style={styles.sessionTitles}>
          <Text style={styles.sessionName} numberOfLines={1}>{template?.name ?? ''}</Text>
          {/* Nº de ejercicios y duración, no `template.emphasis` (etiqueta interna
              tipo "pull"/"push" del generador, sin traducir y no siempre presente). */}
          <Text style={styles.sessionSubtitle} numberOfLines={1}>
            {t('programView.sessionExercises', { count: stats.exercises })}
            {' · '}
            {t('programView.sessionMin', { count: stats.minutes })}
          </Text>
        </View>
        <Text style={styles.sessionStat}>{t('programView.sessionSets', { count: stats.sets })}</Text>
      </View>

      <View style={styles.sessionBody}>
        {slots.length === 0 && (
          <Text style={styles.emptySession}>{t('programView.emptySession')}</Text>
        )}
        {slots.map((slot, i) => {
          const num = String(i + 1).padStart(2, '0');
          if (slot.kind === 'block') {
            return (
              <BlockCard
                key={slot.id}
                num={num}
                block={slot.block}
                allExercises={allExercises}
                exName={exName}
              />
            );
          }
          if (slot.members.length > 1) {
            return (
              <SupersetGroup
                key={slot.id}
                num={num}
                members={slot.members}
                allExercises={allExercises}
                exName={exName}
              />
            );
          }
          const ex = slot.members[0];
          return (
            <ExerciseRow
              key={slot.id}
              num={num}
              exConfig={ex}
              def={allExercises[ex.exerciseId]}
              name={exName(allExercises[ex.exerciseId], ex.exerciseId)}
            />
          );
        })}
      </View>
    </View>
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export default function ProgramDetailScreen() {
  const { t, i18n }  = useTranslation();
  const insets       = useSafeAreaInsets();
  const navigation   = useNavigation();
  const th           = useTheme();
  const styles       = useThemedStyles(makeStyles);

  const ui                   = useStore((s) => s.ui);
  const programs             = useStore((s) => s.programs);
  const profile              = useStore((s) => s.profile);
  const clients              = useStore((s) => s.clients);
  const clientSync           = useStore((s) => s.clientSync);
  const sessionTemplates     = useStore((s) => s.sessionTemplates);
  const userPrograms         = useStore((s) => s.userPrograms);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);

  // Arranca en la etapa 1 a propósito: es un visualizador, y la etapa 1 es la
  // referencia de todo lo que se compara.
  const [stageIdx, setStageIdx] = useState(0);

  const programId = ui._viewingProgramId ?? profile.activeProgramId;
  const program   = programs[programId];

  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );
  const allTemplates = useMemo(
    () => ({ ...sessionTemplates, ...userPrograms }),
    [sessionTemplates, userPrograms],
  );

  // `program.days` es el espejo de la etapa ACTIVA, no la lista de días del
  // programa (stage-planner.md §3.1). Aquí se leen las etapas; el espejo solo
  // vale de respaldo para programas anteriores a la fase 0 del planificador.
  const stages = useMemo(() => (
    program?.stages?.length > 0
      ? program.stages
      : [{ id: '_only', name: null, durationWeeks: null, days: program?.days ?? [] }]
  ), [program]);

  const idx   = Math.min(stageIdx, stages.length - 1);
  const stage = stages[idx];

  const resolve = useMemo(() => (stg) => (stg?.days ?? [])
    .map((day) => ({ day, template: getEffectiveTemplate(day.sessionTemplateId) }))
    .filter((d) => d.template), [getEffectiveTemplate]);

  const sessions     = useMemo(() => resolve(stage),    [resolve, stage]);
  const baseSessions = useMemo(() => resolve(stages[0]), [resolve, stages]);

  const volume = useMemo(() => {
    const cur  = plannedSetsByGroup(sessions.map((s) => s.template), allExercises);
    const base = new Map(
      plannedSetsByGroup(baseSessions.map((s) => s.template), allExercises)
        .map(({ group, sets }) => [group, sets]),
    );
    // Un grupo que la etapa 1 entrenaba y ésta ya no tiene que salir a cero: el
    // hueco es justo lo que hay que ver.
    const rows = cur.map(({ group, sets }) => ({ group, sets, baseSets: base.get(group) ?? 0 }));
    for (const [group, sets] of base) {
      if (!rows.some((r) => r.group === group)) rows.push({ group, sets: 0, baseSets: sets });
    }
    const max = rows.reduce((m, r) => Math.max(m, r.sets, r.baseSets), 0);
    return { rows: rows.sort((a, b) => b.sets - a.sets), scale: Math.max(SETS_SCALE_MIN, max) };
  }, [sessions, baseSessions, allExercises]);

  const diff = useMemo(() => (
    idx === 0 ? null : diffLine(
      stageDiff(
        baseSessions.map((s) => s.template),
        sessions.map((s) => s.template),
        allTemplates,
      ),
      stageName(stages[0], 0, t),
      t,
    )
  ), [idx, baseSessions, sessions, allTemplates, stages, t]);

  const totalCycles = useMemo(() => (
    stages.some((s) => s.durationWeeks == null)
      ? t('programView.cyclesOpen')
      : String(stages.reduce((acc, s) => acc + (s.durationWeeks ?? 0), 0))
  ), [stages, t]);

  // Autoría: el cliente ve de quién es el programa; el entrenador, para quién es.
  const client   = program?.clientId ? clients?.[program.clientId] : null;
  const byline   = client
    ? t('programView.forClient', { name: client.name })
    : clientSync?.trainerName
      ? t('programView.byTrainer', { name: clientSync.trainerName })
      : null;

  function exName(def, fallbackId) {
    if (!def) return fallbackId;
    return i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name;
  }

  if (!program) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.headerSide}>
            <ArrowIcon size={20} color={th.colors.onAccent} back />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('programView.eyebrow')}</Text>
          </View>
          <View style={styles.headerSide} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('programView.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.headerSide}>
          <ArrowIcon size={20} color={th.colors.onAccent} back />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow}>{t('programView.eyebrow')}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{program.name}</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Resumen del programa ─────────────────────────────────────────── */}
        {byline ? <Text style={styles.byline}>{byline}</Text> : null}
        <View style={styles.stats}>
          <Stat value={String(stages.length)} label={t('programView.statStages')} />
          <Stat value={totalCycles}           label={t('programView.statCycles')} />
          <Stat value={String(sessions.length)} label={t('programView.statSessions')} />
        </View>

        {/* ── Selector de etapas ───────────────────────────────────────────── */}
        {stages.length > 1 && (
          <>
            <View style={styles.chipRow}>
              {stages.map((s, i) => (
                <TouchableOpacity
                  key={s.id ?? i}
                  style={[styles.chip, i === idx && styles.chipOn]}
                  onPress={() => setStageIdx(i)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipName, i === idx && styles.chipNameOn]} numberOfLines={1}>
                    {stageName(s, i, t)}
                  </Text>
                  <Text style={[styles.chipMeta, i === idx && styles.chipMetaOn]}>
                    {s.durationWeeks == null
                      ? t('programView.cyclesOpen')
                      : t('programView.stageCycles', { count: s.durationWeeks })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {diff ? <Text style={styles.diffLine}>{diff}</Text> : null}
          </>
        )}

        {/* ── Volumen del ciclo ────────────────────────────────────────────── */}
        {volume.rows.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{t('programView.volumeTitle')}</Text>
              {idx > 0 && (
                <Text style={styles.cardMeta}>
                  {t('programView.volumeMark', { name: stageName(stages[0], 0, t) })}
                </Text>
              )}
            </View>
            <View style={styles.groupList}>
              {volume.rows.map((row) => (
                <VolumeBar
                  key={row.group}
                  group={row.group}
                  sets={row.sets}
                  baseSets={row.baseSets}
                  scale={volume.scale}
                  showBase={idx > 0}
                />
              ))}
            </View>
            <Text style={styles.groupHint}>
              {t('programView.volumeHint', { min: SETS_TARGET_MIN, max: SETS_TARGET_MAX })}
            </Text>
          </View>
        )}

        {/* ── Sesiones, todas desplegadas ──────────────────────────────────── */}
        {sessions.map(({ day, template }) => (
          <SessionCard
            key={day.sessionTemplateId}
            day={day}
            template={template}
            allExercises={allExercises}
            exName={exName}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: th.colors.bg },
  flex:   { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    gap:               spacing.md,
  },

  // Cabecera — mismo patrón que StagePlannerScreen, su pantalla hermana.
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    height:            HEADER_H,
    marginHorizontal:  spacing.lg,
    marginTop:         spacing.lg,
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
  },
  headerSide:    { width: 26, alignItems: 'center' },
  headerCenter:  { flex: 1, alignItems: 'center', gap: spacing.xs, minWidth: 0 },
  headerEyebrow: {
    ...textStyles.btnAction,
    fontSize:      10,
    letterSpacing: 1,
    color:         th.colors.muted,
  },
  headerTitle: { ...textStyles.hero, color: th.colors.onAccent, lineHeight: 22, flexShrink: 1 },

  // Resumen
  byline: { ...textStyles.subtitle, color: th.colors.mutedLight },
  stats:  { flexDirection: 'row', gap: spacing.xxl, paddingVertical: spacing.xs2 },
  stat:   { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs2 },
  statValue: { ...textStyles.hero, color: th.colors.accent, fontSize: 22, lineHeight: 24 },
  // Misma familia/peso/tracking que smallBold, solo el tamaño sube: en columna
  // 8px se leía bien de etiqueta, en línea junto al número se queda corto.
  statLabel: { ...textStyles.smallBold, color: th.colors.mutedLight, fontSize: 11 },

  // Selector de etapas
  // Todas las etapas ocupan lo mismo. Sin scroll: con más de 5 el nombre se
  // trunca, que es preferible a que unas se vean más importantes que otras.
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex:              1,
    alignItems:        'center',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      th.radius.sm,
    backgroundColor:   th.colors.surface,
    gap:               spacing.xs,
  },
  chipOn:      { backgroundColor: th.colors.accent },
  chipName:    { ...textStyles.subtitle, color: th.colors.mutedLight },
  chipNameOn:  { color: th.colors.onAccent },
  chipMeta:    { ...textStyles.tag, color: th.colors.muted },
  chipMetaOn:  { color: th.colors.onAccent },
  diffLine:    { ...textStyles.subtitle, color: th.colors.mutedLight, lineHeight: 17 },

  // Tarjeta de volumen
  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    gap:             spacing.md,
  },
  cardHead:  { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { ...textStyles.spacingTag, color: th.colors.mutedLight },
  cardMeta:  { ...textStyles.tag, color: th.colors.muted },

  groupList:  { gap: spacing.sm2 },
  groupRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
  groupName:  { ...textStyles.tag, color: th.colors.mutedLight, width: 76 },
  groupTrack: {
    flex: 1, height: 9, borderRadius: 3,
    backgroundColor: th.colors.surface2,
    overflow: 'hidden',
  },
  groupFill:     { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  groupMark:     { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: th.colors.bg },
  groupBaseMark: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: th.colors.text },
  groupCount: {
    ...textStyles.cardType, width: 22, textAlign: 'right', fontVariant: ['tabular-nums'],
  },
  groupDelta: {
    ...textStyles.tag, width: 24, textAlign: 'right',
    color: th.colors.accent, fontVariant: ['tabular-nums'],
  },
  groupDeltaFlat: { color: th.colors.muted },
  groupHint: { ...textStyles.tag, color: th.colors.muted, lineHeight: 15 },

  // Sesión
  session: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  sessionHead: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  sessionLetter:    { ...textStyles.hero, fontSize: 26, lineHeight: 28 },
  sessionTitles:    { flex: 1, gap: spacing.xs, minWidth: 0 },
  sessionName:      { ...textStyles.cardTitle, color: th.colors.text },
  sessionSubtitle:  { ...textStyles.tag, color: th.colors.mutedLight },
  sessionStat:      { ...textStyles.tag, color: th.colors.mutedLight },
  sessionBody:     { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  emptySession:    { ...textStyles.subtitle, color: th.colors.muted, paddingVertical: spacing.sm },

  // Fila de ejercicio
  exRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            spacing.md,
    paddingVertical: spacing.sm2,
  },
  exNum:      { ...textStyles.cardType, color: th.colors.accent, width: 26, marginTop: 1 },
  exInfo:     { flex: 1, gap: spacing.xs, minWidth: 0 },
  exRxLine:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  exName:     { ...textStyles.subtitle, fontSize: 14, color: th.colors.text },
  keyBadge: {
    ...textStyles.smallBold,
    color:             th.colors.accent,
    borderWidth:       borders.thin,
    borderColor:       th.tint.accent50,
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.xs2,
    paddingVertical:   1,
  },
  exNote:    { ...textStyles.tag, color: th.colors.mutedLight },
  exRxMain:  { ...textStyles.cardType, color: th.colors.accent, fontVariant: ['tabular-nums'] },
  exRxRest:  { ...textStyles.tag, color: th.colors.muted, marginLeft: 'auto' },

  // Superserie
  ssGroup: {
    borderLeftWidth: borders.medium,
    borderLeftColor: th.colors.accent,
    paddingLeft:     spacing.md,
    marginVertical:  spacing.sm,
  },
  ssHead: { ...textStyles.smallBold, color: th.colors.accent, marginBottom: spacing.xs2 },

  // Bloque de acondicionamiento
  blockRow: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.md,
    paddingVertical: spacing.sm2,
  },
  blockCard: {
    flex:            1,
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
    gap:             spacing.xs2,
  },
  blockHead:      { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  blockFormat:    { ...textStyles.smallBold, color: th.colors.blue },
  blockMeta:      { ...textStyles.tag, color: th.colors.mutedLight },
  blockMovements: { ...textStyles.subtitle, color: th.colors.text, lineHeight: 17 },
  blockNote:      { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 15 },

  // Vacío
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...textStyles.subtitle, color: th.colors.mutedLight },
});
