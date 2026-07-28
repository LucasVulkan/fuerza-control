/**
 * ConditioningBlockCard — metcon block runtime (AMRAP / EMOM / for time).
 *
 * Wall-clock (spec §4): the only stored times are blockState.startedAt /
 * finishedAt; every clock value is re-derived each render from Date.now()
 * via the pure utils in src/utils/conditioningBlocks. The 1 s tick only
 * repaints, so kill/minimize recovery is automatic.
 */
import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  amrapRemaining, emomPosition, emomTotalIntervals, forTimeElapsed, currentMovement,
  buildBlockResult, formatBlockScore,
} from '../../../../src/utils/conditioningBlocks';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { spacing, typography, borders, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

const fmtClock = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ── Stepper — the −/value/＋ row used for rounds and partial reps ─────────────

function Stepper({ value, onChange, min = 0, big = false }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stepperRow}>
      <TouchableOpacity
        style={[styles.stepBtn, big && styles.stepBtnBig]}
        onPress={() => onChange(Math.max(min, value - 1))}
        hitSlop={6}
      >
        <Text style={[styles.stepBtnTxt, big && styles.stepBtnTxtBig]}>−</Text>
      </TouchableOpacity>
      <Text style={[styles.stepValue, big && styles.stepValueBig]}>{value}</Text>
      <TouchableOpacity
        style={[styles.stepBtn, big && styles.stepBtnBig]}
        onPress={() => onChange(value + 1)}
        hitSlop={6}
      >
        <Text style={[styles.stepBtnTxt, big && styles.stepBtnTxtBig]}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── ConditioningBlockCard ─────────────────────────────────────────────────────

export default function ConditioningBlockCard({
  block, state, allExercises, orderNumber, onStart, onUpdate, onFinish, onReset,
}) {
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { fmt } = useWeightUnit();

  const status  = !state?.startedAt ? 'idle' : state.finishedAt ? 'finished' : 'running';
  const running = status === 'running';
  const [expanded, setExpanded] = useState(false);

  // 1 s repaint while running — the derivation does the real work.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Keep the screen awake while a block is running — the user is watching
  // the clock, not touching the screen (unlike normal sets).
  useEffect(() => {
    if (!running) return;
    activateKeepAwakeAsync(block.id, { suppressDeactivateWarnings: true });
    return () => deactivateKeepAwake(block.id);
  }, [running, block.id]);

  const now       = Date.now();
  const movements = block.movements ?? [];
  const failed    = state?.failed ?? [];

  const color = block.format === 'amrap' ? th.colors.accent
    : block.format === 'emom' ? th.colors.blue
    : th.colors.orange;
  const title = block.name || t(`blocks.formats.${block.format}`);

  const moveName = (m) => {
    const def = allExercises[m.exerciseId];
    if (!def) return m.exerciseId;
    return i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name;
  };
  const moveLine = (m) =>
    `${m.amount} ${t(`blocks.units.${m.unit ?? 'reps'}`)} — ${moveName(m)}`
    + (m.weight != null ? ` · ${fmt(m.weight)}` : '');

  const count = movements.length;
  const metaLine = block.format === 'amrap'
    ? t('blocks.meta.amrap', { min: Math.round((block.capSec ?? 600) / 60), count })
    : block.format === 'emom'
      ? t('blocks.meta.emom', { n: block.rounds ?? 0, interval: fmtClock(block.intervalSec ?? 60), count })
      : t('blocks.meta.forTime', { rounds: block.rounds ?? 0, count });

  // Live derivations (running only; utils clamp on their own)
  const emomTotal = block.format === 'emom' ? emomTotalIntervals(block) : 0;
  const pos       = block.format === 'emom' && state?.startedAt ? emomPosition(block, state.startedAt, now) : null;
  const remaining = block.format === 'amrap' && state?.startedAt ? amrapRemaining(block, state.startedAt, now) : null;
  const ft        = block.format === 'for_time' && state?.startedAt ? forTimeElapsed(block, state.startedAt, now) : null;

  // EMOM interval-change haptic + auto-finish; for_time cap auto-finish.
  // Runs every repaint but is idempotent: finishBlock no-ops once finished.
  const prevIntervalRef = useRef(null);
  useEffect(() => {
    if (!running) { prevIntervalRef.current = null; return; }
    if (block.format === 'emom' && pos) {
      if (pos.finished) { onFinish(); return; }
      if (prevIntervalRef.current != null && pos.interval !== prevIntervalRef.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      prevIntervalRef.current = pos.interval;
    }
    if (block.format === 'for_time' && ft?.capped) onFinish();
  });

  // AMRAP time-up haptic, once per run.
  const timeUpFiredRef = useRef(false);
  useEffect(() => {
    if (running && block.format === 'amrap' && remaining === 0 && !timeUpFiredRef.current) {
      timeUpFiredRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (!running) timeUpFiredRef.current = false;
  });

  function handleCancel() {
    Alert.alert(t('blocks.cancel'), t('blocks.cancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('blocks.cancel'), style: 'destructive', onPress: onReset },
    ]);
  }

  function handleReopen() {
    // for_time: clear the frozen score so TERMINAR re-freezes the real clock.
    onUpdate({ finishedAt: null, ...(block.format === 'for_time' ? { timeSec: null } : {}) });
  }

  function toggleFailed(idx) {
    onUpdate({
      failed: failed.includes(idx) ? failed.filter((i) => i !== idx) : [...failed, idx],
    });
  }

  const badge = (
    <Text style={[styles.badge, { color, backgroundColor: withOpacity(color, 0.12) }]}>
      {t(`blocks.formats.${block.format}`)}
    </Text>
  );

  // Los bloques cuentan como un hueco más de la sesión, así que llevan su número
  // igual que los ejercicios (mismo estilo que el `num` de ExerciseCard). En el
  // estado terminado no se pinta: ahí manda el ✓, como en la tarjeta colapsada
  // de ejercicio.
  const num = orderNumber ? <Text style={styles.num}>{orderNumber}</Text> : null;

  // ── Finished ────────────────────────────────────────────────────────────────
  if (status === 'finished') {
    const result = buildBlockResult(block, state, now);
    const score  = formatBlockScore(result, block.format)
      + (result.capped ? ` ${t('blocks.cappedTag')}` : '');
    return (
      <View style={[styles.card, { borderLeftColor: color }]}>
        <TouchableOpacity style={styles.doneRow} onPress={() => setExpanded((v) => !v)} activeOpacity={0.75}>
          <View style={styles.doneIcon}><Text style={styles.doneIconTxt}>✓</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.metaTxt}>{metaLine}</Text>
          </View>
          <Text style={styles.scorePill}>{score}</Text>
        </TouchableOpacity>
        {expanded && (
          <View style={styles.doneDetail}>
            {movements.map((m, i) => (
              <Text key={i} style={styles.moveTxt}>{moveLine(m)}</Text>
            ))}
            <TouchableOpacity style={styles.reopenBtn} onPress={handleReopen}>
              <Text style={styles.reopenTxt}>{t('blocks.reopen')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ── Idle ────────────────────────────────────────────────────────────────────
  if (status === 'idle') {
    return (
      <View style={[styles.card, { borderLeftColor: color }]}>
        <View style={styles.headerRow}>
          {num}
          {badge}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.metaTxt}>{metaLine}</Text>
          </View>
        </View>
        {count > 0 && (
          <View style={styles.moveList}>
            {movements.map((m, i) => (
              <Text key={i} style={styles.moveTxt}>{moveLine(m)}</Text>
            ))}
          </View>
        )}
        {block.notes ? (
          <View style={styles.noteStrip}><Text style={styles.noteTxt}>{block.notes}</Text></View>
        ) : null}
        {count > 0 ? (
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: color }]}
            onPress={onStart}
            activeOpacity={0.85}
          >
            <Text style={styles.startTxt}>{t('blocks.start')}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.hint}>{t('blocks.addMovementsHint')}</Text>
        )}
      </View>
    );
  }

  // ── Running ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.headerRow}>
        {num}
        {badge}
        <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>{title}</Text>
      </View>

      {/* AMRAP */}
      {block.format === 'amrap' && (
        <>
          <Text style={[styles.bigClock, { color }]}>{fmtClock(remaining)}</Text>
          {remaining === 0 ? (
            <Text style={styles.timeUp}>{t('blocks.timeUp')}</Text>
          ) : (
            <Text style={styles.clockSub}>{t('blocks.remaining')}</Text>
          )}

          <Text style={styles.secLabel}>{t('blocks.perRound').toUpperCase()}</Text>
          <View style={styles.moveList}>
            {movements.map((m, i) => (
              <Text key={i} style={styles.moveTxt}>{moveLine(m)}</Text>
            ))}
          </View>

          <View style={styles.counterRow}>
            <Text style={styles.counterLabel}>{t('blocks.roundsDone')}</Text>
            <Stepper big value={state.rounds ?? 0} onChange={(v) => onUpdate({ rounds: v })} />
          </View>
          <View style={styles.counterRow}>
            <Text style={styles.counterLabel}>{t('blocks.partialReps')}</Text>
            <Stepper value={state.extraReps ?? 0} onChange={(v) => onUpdate({ extraReps: v })} />
          </View>

          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: color }]}
            onPress={onFinish}
            activeOpacity={0.85}
          >
            <Text style={styles.startTxt}>
              {t('blocks.finishWithScore', {
                score: formatBlockScore(buildBlockResult(block, state, now), 'amrap'),
              })}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* EMOM */}
      {block.format === 'emom' && pos && (
        <>
          <Text style={styles.clockSub}>
            {t('blocks.intervalOf', { k: pos.interval + 1, n: emomTotal })}
          </Text>
          <Text style={[styles.bigClock, { color }]}>{fmtClock(pos.intervalRemaining)}</Text>

          <Text style={styles.secLabel}>{t('blocks.thisInterval').toUpperCase()}</Text>
          <View style={styles.moveList}>
            {(block.emomMode === 'all' ? movements : [currentMovement(block, pos.interval)].filter(Boolean))
              .map((m, i) => <Text key={i} style={styles.moveTxt}>{moveLine(m)}</Text>)}
          </View>
          {block.emomMode !== 'all' && movements.length > 1 && pos.interval + 1 < emomTotal && (
            <Text style={styles.nextUpTxt}>
              {t('blocks.nextUp')}: {moveLine(currentMovement(block, pos.interval + 1))}
            </Text>
          )}

          {/* Interval dots — tap a past one to toggle done/fail */}
          <View style={styles.dotsGrid}>
            {Array.from({ length: emomTotal }, (_, i) => {
              const isPast    = i < pos.interval;
              const isCurrent = i === pos.interval;
              const isFailed  = failed.includes(i);
              const dotStyle = isPast
                ? (isFailed ? styles.dotFail : styles.dotDone)
                : isCurrent ? [styles.dotCurrent, { borderColor: color }]
                : styles.dotPending;
              return (
                <TouchableOpacity
                  key={i}
                  disabled={!isPast}
                  onPress={() => toggleFailed(i)}
                  style={[styles.dot, dotStyle]}
                  hitSlop={4}
                >
                  <Text style={styles.dotTxt}>{i + 1}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.failBtn, failed.includes(pos.interval) && styles.failBtnActive]}
            onPress={() => toggleFailed(pos.interval)}
            activeOpacity={0.8}
          >
            <Text style={styles.failTxt}>{t('blocks.fail')}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* FOR TIME */}
      {block.format === 'for_time' && ft && (
        <>
          <Text style={[styles.bigClock, { color }]}>{fmtClock(ft.elapsedSec)}</Text>
          {block.capSec != null && (
            <Text style={styles.clockSub}>{t('blocks.capLabel')}: {fmtClock(block.capSec)}</Text>
          )}

          <Text style={styles.secLabel}>{metaLine.toUpperCase()}</Text>
          <View style={styles.moveList}>
            {movements.map((m, i) => (
              <Text key={i} style={styles.moveTxt}>{moveLine(m)}</Text>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: color }]}
            onPress={onFinish}
            activeOpacity={0.85}
          >
            <Text style={styles.startTxt}>{t('blocks.finish').toUpperCase()}</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
        <Text style={styles.cancelTxt}>{t('blocks.cancel')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  card: {
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    borderLeftWidth: 3,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
  },

  // Mismo tratamiento que el número de ExerciseCard, para que las dos tarjetas
  // numeren igual dentro de la sesión.
  num: {
    fontFamily:  'Inter_900Black',
    fontSize:    17,
    fontWeight:  '900',
    lineHeight:  22,
    color:       th.colors.accent,
    fontVariant: ['tabular-nums'],
    minWidth:    22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  badge: {
    fontSize:          typography.xs,
    fontWeight:        typography.bold,
    letterSpacing:     0.8,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical:   2,
    borderRadius:      th.radius.sm,
    overflow:          'hidden',
  },
  title: {
    fontSize:   typography.md,
    fontWeight: typography.semibold,
    color:      th.colors.text,
  },
  metaTxt: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 1,
  },

  // Movements
  secLabel: {
    fontSize:      typography.xs - 1,
    fontWeight:    typography.bold,
    color:         th.colors.muted2,
    letterSpacing: 0.8,
    marginTop:     spacing.xs,
  },
  moveList: { gap: 3 },
  moveTxt: {
    fontSize:   typography.sm,
    color:      th.colors.mutedLight,
    lineHeight: typography.sm * 1.45,
  },
  nextUpTxt: {
    fontSize:  typography.xs,
    color:     th.colors.muted2,
    marginTop: 2,
  },

  // Trainer note
  noteStrip: {
    backgroundColor:   withOpacity(th.colors.accent, 0.07),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.accent, 0.25),
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   5,
  },
  noteTxt: {
    fontSize:   typography.xs,
    color:      th.colors.text,
    lineHeight: 17,
  },

  // Clock
  bigClock: {
    fontSize:    44,
    fontWeight:  typography.heavy,
    fontVariant: ['tabular-nums'],
    textAlign:   'center',
    marginTop:   spacing.xs,
  },
  clockSub: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    textAlign: 'center',
  },
  timeUp: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
    color:      th.colors.green,
    textAlign:  'center',
  },

  // Counters (amrap)
  counterRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      spacing.xs,
  },
  counterLabel: {
    fontSize:   typography.sm,
    color:      th.colors.text,
    fontWeight: typography.medium,
    flexShrink: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  stepBtn: {
    width:           34,
    height:          34,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stepBtnBig: { width: 46, height: 46 },
  stepBtnTxt: {
    fontSize:   16,
    color:      th.colors.muted,
    lineHeight: 20,
  },
  stepBtnTxtBig: { fontSize: 20, lineHeight: 24 },
  stepValue: {
    minWidth:    28,
    textAlign:   'center',
    fontSize:    typography.lg,
    fontWeight:  typography.bold,
    color:       th.colors.text,
    fontVariant: ['tabular-nums'],
  },
  stepValueBig: { fontSize: 26, minWidth: 40 },

  // EMOM dots
  dotsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    marginTop:     spacing.xs,
  },
  dot: {
    width:          28,
    height:         28,
    borderRadius:   th.radius.full,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    borders.thin,
  },
  dotDone: {
    backgroundColor: withOpacity(th.colors.green, 0.15),
    borderColor:     withOpacity(th.colors.green, 0.5),
  },
  dotFail: {
    backgroundColor: withOpacity(th.colors.red, 0.15),
    borderColor:     withOpacity(th.colors.red, 0.5),
  },
  dotCurrent: {
    backgroundColor: 'transparent',
    borderWidth:     2,
  },
  dotPending: {
    backgroundColor: th.colors.surface2,
    borderColor:     th.colors.border,
  },
  dotTxt: {
    fontSize:    10,
    color:       th.colors.muted,
    fontVariant: ['tabular-nums'],
  },
  failBtn: {
    alignSelf:         'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      th.radius.sm,
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.red, 0.4),
    marginTop:         spacing.xs,
  },
  failBtnActive: {
    backgroundColor: withOpacity(th.colors.red, 0.12),
  },
  failTxt: {
    fontSize:   typography.sm,
    color:      th.colors.red,
    fontWeight: typography.medium,
  },

  // Primary action
  startBtn: {
    borderRadius:    th.radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems:      'center',
    marginTop:       spacing.xs,
  },
  startTxt: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         th.colors.onAccent,
    letterSpacing: 0.8,
  },
  hint: {
    fontSize:  typography.xs,
    color:     th.colors.muted2,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  cancelBtn: {
    alignItems:      'center',
    paddingVertical: spacing.xs,
  },
  cancelTxt: {
    fontSize: typography.xs,
    color:    th.colors.muted,
  },

  // Finished
  doneRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  doneIcon: {
    width:           22,
    height:          22,
    borderRadius:    th.radius.full,
    backgroundColor: withOpacity(th.colors.green, 0.15),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.green, 0.4),
    alignItems:      'center',
    justifyContent:  'center',
  },
  doneIconTxt: {
    fontSize:   11,
    color:      th.colors.green,
    fontWeight: typography.bold,
  },
  scorePill: {
    fontSize:          typography.sm,
    fontWeight:        typography.bold,
    color:             th.colors.green,
    backgroundColor:   withOpacity(th.colors.green, 0.1),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.green, 0.3),
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
    overflow:          'hidden',
    fontVariant:       ['tabular-nums'],
  },
  doneDetail: {
    borderTopWidth: borders.thin,
    borderTopColor: th.colors.border,
    paddingTop:     spacing.sm,
    gap:            spacing.xs,
  },
  reopenBtn: {
    alignSelf:       'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  reopenTxt: {
    fontSize: typography.sm,
    color:    th.colors.muted,
  },
});
