/**
 * ConditioningBlockCard — metcon block runtime (AMRAP / EMOM / for time).
 *
 * Wall-clock (spec §4): the only stored times are blockState.startedAt /
 * finishedAt; every clock value is re-derived each render from Date.now()
 * via the pure utils in src/utils/conditioningBlocks. El tick de 1 s sólo
 * repinta, así que la recuperación tras matar/minimizar es automática.
 * Por eso NO hay pausa (decisión explícita): pausar obligaría a acumular
 * tiempo en el estado y romper esa propiedad.
 *
 * Restyle contra la referencia `formfit-workout-v12-amrap-emom.html`
 * (workout-screen-migration.md §6, Parte 4). Mapeo de la referencia a tokens,
 * el mismo que ya usa ExerciseCard (spec v6):
 *   card #161616 → surface · card-head #1f1f1f → surface2 · cell #0e0e0e → bg
 *   btn-fill #1e1e1e → surface2 · lime → accent · lime-dim → tint.accent10
 *   muted → mutedLight · muted-2 → muted
 * Decisiones de usuario sobre la referencia: todo en lima (se pierde la
 * distinción azul/naranja por formato, vive en el meta), sin play/pausa,
 * las reps parciales sólo aparecen al agotarse el tiempo, for time gana
 * contador de rondas (visual: el score guardado sigue siendo el tiempo) y el
 * fallo de un intervalo se marca tocando su casilla (fuera el botón "Fallo").
 */
import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Reanimated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  amrapRemaining, emomPosition, emomTotalIntervals, forTimeElapsed, currentMovement,
  buildBlockResult, formatBlockScore,
} from '../../../../src/utils/conditioningBlocks';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { useThemedStyles } from '../../useTheme';

// ── Geometría (referencia v12) ───────────────────────────────────────────────
const R_CARD = 16;   // .exercise
const R_BOX  = 12;   // .timer / .now
const R_BTN  = 12;   // .round-btn
const R_CELL = 10;   // .minute
const BTN_H  = 56;   // .round-btn / botón primario
const CELL_W = 54;   // casilla de intervalo (5 por fila en un móvil normal)
const CELL_H = 40;

const fmtClock = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const haptic = {
  tick: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  hit:  () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  end:  () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};

// ── Stepper — la fila −/valor/＋ del ajuste post-tiempo ───────────────────────

function Stepper({ value, onChange, min = 0 }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stepperRow}>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - 1))} hitSlop={6}>
        <Text style={styles.stepBtnTxt}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(value + 1)} hitSlop={6}>
        <Text style={styles.stepBtnTxt}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── ConditioningBlockCard ─────────────────────────────────────────────────────

export default function ConditioningBlockCard({
  block, state, allExercises, orderNumber, onStart, onUpdate, onFinish, onReset,
  // Sólo la sesión libre lo pasa: sin plantilla, el bloque se edita desde aquí.
  onEdit,
}) {
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const { fmt } = useWeightUnit();

  const status  = !state?.startedAt ? 'idle' : state.finishedAt ? 'finished' : 'running';
  const running = status === 'running';
  const [expanded, setExpanded] = useState(false);

  // 1 s repaint while running — la derivación hace el trabajo real.
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
  const count     = movements.length;

  const fmtLabel = t(`blocks.formats.${block.format}`);
  const title    = block.name || fmtLabel;

  const moveName = (m) => {
    const def = allExercises[m.exerciseId];
    if (!def) return m.exerciseId;
    return i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name;
  };
  // La unidad sólo se nombra cuando NO son reps (la referencia pinta "10", no
  // "10 reps"); cal/m/seg sí necesitan decir de qué hablan.
  const moveUnit   = (m) => ((m.unit ?? 'reps') === 'reps' ? '' : ` ${t(`blocks.units.${m.unit}`)}`);
  const moveInline = (m) =>
    `${m.amount}${moveUnit(m)} × ${moveName(m)}` + (m.weight != null ? ` · ${fmt(m.weight)}` : '');

  const baseMeta = block.format === 'amrap'
    ? t('blocks.meta.amrap', { min: Math.round((block.capSec ?? 600) / 60), count })
    : block.format === 'emom'
      ? t('blocks.meta.emom', { n: block.rounds ?? 0, interval: fmtClock(block.intervalSec ?? 60), count })
      : t('blocks.meta.forTime', { rounds: block.rounds ?? 0, count });
  // El formato encabeza el meta sólo si el título no lo dice ya.
  const metaLine = block.name ? `${fmtLabel} · ${baseMeta}` : baseMeta;

  // Live derivations (running only; utils clamp on their own)
  const emomTotal = block.format === 'emom' ? emomTotalIntervals(block) : 0;
  const pos       = block.format === 'emom' && state?.startedAt ? emomPosition(block, state.startedAt, now) : null;
  const remaining = block.format === 'amrap' && state?.startedAt ? amrapRemaining(block, state.startedAt, now) : null;
  const ft        = block.format === 'for_time' && state?.startedAt ? forTimeElapsed(block, state.startedAt, now) : null;

  const rounds = state?.rounds ?? 0;

  // Se acabó el tiempo del bloque — NO se autofinaliza en ningún formato: el
  // atleta confirma con el botón. Autofinalizar el EMOM no daba tiempo a marcar
  // el último intervalo como fallado y además hacía imposible "Reabrir" (el
  // efecto volvía a cerrarlo en el mismo tick).
  const over = !running ? false
    : block.format === 'amrap' ? remaining === 0
    : block.format === 'emom'  ? !!pos?.finished
    : !!ft?.capped;

  // EMOM: háptica de cambio de intervalo + cuenta atrás 3-2-1.
  const prevIntervalRef = useRef(null);
  const countdownRef    = useRef(null);
  useEffect(() => {
    if (!running) { prevIntervalRef.current = null; countdownRef.current = null; return; }
    if (block.format !== 'emom' || !pos || pos.finished) return;
    if (prevIntervalRef.current != null && pos.interval !== prevIntervalRef.current) haptic.hit();
    prevIntervalRef.current = pos.interval;
    // 3-2-1 antes de cerrar el intervalo, un toque por segundo.
    if (pos.intervalRemaining > 0 && pos.intervalRemaining <= 3) {
      const key = `${pos.interval}:${pos.intervalRemaining}`;
      if (countdownRef.current !== key) {
        countdownRef.current = key;
        haptic.tick();
      }
    }
  });

  // Aviso de "tiempo", una vez por vuelta (los tres formatos).
  const timeUpFiredRef = useRef(false);
  useEffect(() => {
    if (!running) { timeUpFiredRef.current = false; return; }
    if (over && !timeUpFiredRef.current) {
      timeUpFiredRef.current = true;
      haptic.end();
    }
  });

  function addRound() {
    haptic.tick();
    onUpdate({ rounds: rounds + 1 });
  }
  function removeRound() {
    if (rounds === 0) return;
    haptic.tick();
    onUpdate({ rounds: rounds - 1 });
  }

  function handleCancel() {
    Alert.alert(t('blocks.cancel'), t('blocks.cancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('blocks.cancel'), style: 'destructive', onPress: onReset },
    ]);
  }

  function handleReopen() {
    // El detalle se despliega para poder pulsar "Reabrir", así que hay que
    // recogerlo aquí: si no, al volver a terminar el bloque la tarjeta se
    // quedaba a medio colapsar, con la lista de movimientos a la vista.
    setExpanded(false);
    // for_time: clear the frozen score so TERMINAR re-freezes the real clock.
    onUpdate({ finishedAt: null, ...(block.format === 'for_time' ? { timeSec: null } : {}) });
  }

  function toggleFailed(idx) {
    haptic.tick();
    onUpdate({
      failed: failed.includes(idx) ? failed.filter((i) => i !== idx) : [...failed, idx],
    });
  }

  // ── Piezas compartidas ──────────────────────────────────────────────────────

  // Cabecera con la MISMA anatomía que ExerciseCard (num accent | nombre+meta):
  // un bloque es un hueco más de la sesión y numera igual. En terminado el ✓
  // ocupa el hueco del número, como en la card colapsada de ejercicio.
  const header = (done) => (
    <View style={styles.header}>
      <View style={styles.numSlot}>
        <Text style={styles.num}>{done ? '✓' : (orderNumber ?? '')}</Text>
      </View>
      <View style={styles.nameBlock}>
        <Text style={styles.name} numberOfLines={2}>{title}</Text>
        <Text style={styles.meta} numberOfLines={2}>{metaLine}</Text>
      </View>
      {done ? (
        <Text style={styles.scorePill}>
          {formatBlockScore(buildBlockResult(block, state, now), block.format)}
          {buildBlockResult(block, state, now).capped ? ` ${t('blocks.cappedTag')}` : ''}
        </Text>
      ) : null}
    </View>
  );

  // Fila de movimiento (.ref-row): cantidad · nombre · carga.
  const moveRow = (m, i) => (
    <View key={i} style={styles.moveRow}>
      <Text style={styles.moveAmount}>
        {m.amount}
        {moveUnit(m) ? <Text style={styles.moveUnit}>{moveUnit(m)}</Text> : null}
      </Text>
      <Text style={styles.moveName} numberOfLines={1}>{moveName(m)}</Text>
      {m.weight != null ? <Text style={styles.moveLoad}>{fmt(m.weight)}</Text> : null}
    </View>
  );

  const moveList = <View style={styles.moveList}>{movements.map(moveRow)}</View>;

  const secLabel = (txt) => <Text style={styles.secLabel}>{txt.toUpperCase()}</Text>;

  // Reloj + contador lateral (.timer).
  const timerBox = (clockTxt, sideValue, sideLabel, { bumpSide = false } = {}) => (
    <View style={styles.timerBox}>
      <Text style={styles.clock}>{clockTxt}</Text>
      <View style={styles.side}>
        {/* El contador "salta" al sumar una ronda: `key` lo remonta y `entering`
            hace el pop. Sin shared values — el resto del bump lo da la háptica. */}
        {bumpSide
          ? (
            <Reanimated.Text key={`r-${sideValue}`} entering={ZoomIn.duration(170)} style={styles.sideBig}>
              {sideValue}
            </Reanimated.Text>
          )
          : <Text style={styles.sideBig}>{sideValue}</Text>}
        <Text style={styles.sideLabel}>{sideLabel.toUpperCase()}</Text>
      </View>
    </View>
  );

  // Área grande de ronda + botón de restar (pedido explícito: equivocarse tiene
  // que costar un toque, no cancelar el bloque).
  const roundArea = (
    <View style={styles.roundRow}>
      <TouchableOpacity style={styles.roundBtn} onPress={addRound} activeOpacity={0.85}>
        <Text style={styles.roundBtnTxt}>{`✓  ${t('blocks.roundDone')}`}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.minusBtn}
        onPress={removeRound}
        activeOpacity={0.7}
        accessibilityLabel={t('blocks.removeRound')}
      >
        <Text style={styles.minusTxt}>−</Text>
      </TouchableOpacity>
    </View>
  );

  const primaryBtn = (label, onPress) => (
    <TouchableOpacity style={styles.primaryBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.primaryTxt}>{label}</Text>
    </TouchableOpacity>
  );

  const cancelBtn = (
    <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
      <Text style={styles.cancelTxt}>{t('blocks.cancel').toUpperCase()}</Text>
    </TouchableOpacity>
  );

  // ── Finished ────────────────────────────────────────────────────────────────
  if (status === 'finished') {
    return (
      <View style={[styles.card, styles.cardDone]}>
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.75}>
          {header(true)}
        </TouchableOpacity>
        {expanded && (
          <View style={styles.body}>
            {moveList}
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
      <View style={styles.card}>
        <TouchableOpacity onPress={onEdit} disabled={!onEdit} activeOpacity={0.75}>
          {header(false)}
        </TouchableOpacity>
        <View style={styles.body}>
          {block.notes ? (
            <View style={styles.noteStrip}><Text style={styles.noteTxt}>{block.notes}</Text></View>
          ) : null}
          {count > 0 ? (
            <>
              {secLabel(t('blocks.movements'))}
              {moveList}
              {primaryBtn(t('blocks.start'), onStart)}
            </>
          ) : (
            <Text style={styles.hint}>{t('blocks.addMovementsHint')}</Text>
          )}
        </View>
      </View>
    );
  }

  // ── Running ─────────────────────────────────────────────────────────────────
  const forTimeTarget = block.format === 'for_time' ? (block.rounds ?? 0) : 0;

  return (
    <View style={styles.card}>
      {header(false)}
      <View style={styles.body}>

        {/* AMRAP */}
        {block.format === 'amrap' && (
          <>
            {timerBox(fmtClock(remaining), rounds, t('blocks.roundsLabel'), { bumpSide: true })}
            {secLabel(t('blocks.perRound'))}
            {moveList}

            {over ? (
              <>
                <Text style={styles.timeUp}>{t('blocks.timeUp')}</Text>
                <View style={styles.counterRow}>
                  <Text style={styles.counterLabel}>{t('blocks.roundsDone')}</Text>
                  <Stepper value={rounds} onChange={(v) => onUpdate({ rounds: v })} />
                </View>
                <View style={styles.counterRow}>
                  <Text style={styles.counterLabel}>{t('blocks.partialReps')}</Text>
                  <Stepper value={state.extraReps ?? 0} onChange={(v) => onUpdate({ extraReps: v })} />
                </View>
                {primaryBtn(
                  t('blocks.finishWithScore', {
                    score: formatBlockScore(buildBlockResult(block, state, now), 'amrap'),
                  }),
                  onFinish,
                )}
              </>
            ) : (
              <>
                {roundArea}
                <Text style={styles.hint}>{t('blocks.partialHint')}</Text>
              </>
            )}
          </>
        )}

        {/* EMOM */}
        {block.format === 'emom' && pos && (
          <>
            <View style={styles.nowBox}>
              <View style={styles.nowTop}>
                <Text style={[styles.clock, styles.clockAccent]}>{fmtClock(pos.intervalRemaining)}</Text>
                <View style={styles.side}>
                  <Text style={styles.sideSmall}>{`${pos.interval + 1} / ${emomTotal}`}</Text>
                  <Text style={styles.sideLabel}>{t('blocks.intervalLabel').toUpperCase()}</Text>
                </View>
              </View>

              {/* El trabajo del intervalo "avanza" al cambiar: entra desde abajo.
                  `key` fuerza el remontaje, que es lo que dispara `entering`.
                  Con el tiempo agotado ya no hay trabajo que enseñar: manda la
                  rejilla, que es lo que queda por revisar antes de finalizar. */}
              {!over ? (
                <Reanimated.View
                  key={pos.interval}
                  entering={FadeInDown.duration(220)}
                  style={styles.nowMain}
                >
                  {block.emomMode === 'all'
                    ? movements.map(moveRow)
                    : (() => {
                        const m = currentMovement(block, pos.interval);
                        if (!m) return null;
                        return (
                          <>
                            <Text style={styles.work}>
                              {m.amount}
                              {moveUnit(m) ? <Text style={styles.workUnit}>{moveUnit(m)}</Text> : null}
                              <Text style={styles.workX}>{'  ×  '}</Text>
                              {moveName(m)}
                            </Text>
                            {m.weight != null ? <Text style={styles.workLoad}>{fmt(m.weight)}</Text> : null}
                          </>
                        );
                      })()}
                </Reanimated.View>
              ) : null}

              {!over && block.emomMode !== 'all' && movements.length > 1 && pos.interval + 1 < emomTotal ? (
                <View style={styles.nowNext}>
                  <Text style={styles.nextLabel}>{t('blocks.nextUp').toUpperCase()}</Text>
                  <Text style={styles.nextTxt} numberOfLines={1}>
                    {moveInline(currentMovement(block, pos.interval + 1))}
                  </Text>
                </View>
              ) : null}
            </View>

            {secLabel(t('blocks.intervalsLabel'))}
            <View style={styles.grid}>
              {Array.from({ length: emomTotal }, (_, i) => {
                // Con el tiempo agotado el último intervalo ya es pasado: se
                // puede marcar como fallado antes de confirmar el bloque.
                const isPast    = i < pos.interval || over;
                const isCurrent = i === pos.interval && !over;
                const isFailed  = failed.includes(i);
                return (
                  <TouchableOpacity
                    key={i}
                    disabled={i > pos.interval}
                    onPress={() => toggleFailed(i)}
                    activeOpacity={0.7}
                    style={[
                      styles.cell,
                      isFailed  ? styles.cellFailed
                        : isPast    ? styles.cellDone
                        : isCurrent ? styles.cellCurrent
                        : null,
                    ]}
                  >
                    <Text style={[
                      styles.cellTxt,
                      isFailed  ? styles.cellTxtFailed
                        : isPast    ? styles.cellTxtDone
                        : isCurrent ? styles.cellTxtCurrent
                        : null,
                    ]}>
                      {isFailed ? '✕' : isPast ? '✓' : i + 1}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {over ? (
              <>
                <Text style={[styles.timeUp, styles.timeUpTop]}>{t('blocks.timeUpEmom')}</Text>
                {primaryBtn(
                  t('blocks.finishWithScore', {
                    score: formatBlockScore(buildBlockResult(block, state, now), 'emom'),
                  }),
                  onFinish,
                )}
              </>
            ) : (
              <Text style={styles.hint}>{t('blocks.failHint')}</Text>
            )}
          </>
        )}

        {/* FOR TIME */}
        {block.format === 'for_time' && ft && (
          <>
            {forTimeTarget > 0
              ? timerBox(fmtClock(ft.elapsedSec), `${rounds} / ${forTimeTarget}`,
                  t('blocks.roundsLabel'), { bumpSide: true })
              : timerBox(fmtClock(ft.elapsedSec),
                  block.capSec != null ? fmtClock(block.capSec) : '—', t('blocks.capLabel'))}

            {secLabel(t('blocks.perRound'))}
            {moveList}

            {over ? <Text style={styles.timeUp}>{t('blocks.timeUp')}</Text> : null}

            {!over && forTimeTarget > 0 && rounds < forTimeTarget ? (
              <>
                {roundArea}
                <TouchableOpacity style={styles.tertiaryBtn} onPress={onFinish}>
                  <Text style={styles.tertiaryTxt}>{t('blocks.finish').toUpperCase()}</Text>
                </TouchableOpacity>
              </>
            ) : (
              primaryBtn(
                t('blocks.finishWithScore', {
                  score: formatBlockScore(buildBlockResult(block, state, now), 'for_time'),
                }),
                onFinish,
              )
            )}
          </>
        )}

        {cancelBtn}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    R_CARD,
    overflow:        'hidden',
    // Borde transparente OBLIGATORIO (misma trampa que ExerciseCard): en Android
    // un View con overflow:'hidden' + borderRadius no repinta sus hijos de forma
    // fiable sin un borde que fuerce la capa de recorte.
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardDone: { borderColor: th.tint.accent50 },

  // Header — anatomía de ExerciseCard (surface2, padding 14/12/14/16, gap 10).
  header: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             10,
    backgroundColor: th.colors.surface2,
    paddingTop:      14,
    paddingRight:    12,
    paddingBottom:   14,
    paddingLeft:     16,
  },
  numSlot: { minWidth: 22 },
  num: {
    fontFamily:  'Inter_900Black',
    fontSize:    17,
    fontWeight:  '900',
    lineHeight:  22,
    color:       th.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  nameBlock: { flex: 1, minWidth: 0 },
  name: {
    fontFamily:    'Inter_900Black',
    fontSize:      17,
    fontWeight:    '900',
    lineHeight:    22,
    letterSpacing: -0.17,
    color:         th.colors.text,
  },
  meta: {
    fontFamily:  'Inter_600SemiBold',
    fontSize:    12,
    fontWeight:  '600',
    color:       th.colors.mutedLight,
    marginTop:   3,
    fontVariant: ['tabular-nums'],
  },
  scorePill: {
    fontFamily:        'Inter_800ExtraBold',
    fontSize:          13,
    fontWeight:        '800',
    color:             th.colors.accent,
    backgroundColor:   th.tint.accent10,
    borderRadius:      9,
    paddingHorizontal: 8,
    paddingVertical:   4,
    overflow:          'hidden',
    fontVariant:       ['tabular-nums'],
  },

  body: {
    paddingTop:        12,
    paddingBottom:     14,
    paddingHorizontal: 16,
  },

  // Nota del entrenador — sin borde, sólo relleno (regla de identidad del spec).
  noteStrip: {
    backgroundColor:   th.tint.accent10,
    borderRadius:      9,
    paddingHorizontal: 10,
    paddingVertical:   6,
    marginBottom:      12,
  },
  noteTxt: {
    fontSize:   12,
    color:      th.colors.text,
    lineHeight: 17,
  },

  // .section-label
  secLabel: {
    fontFamily:    'Inter_700Bold',
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
    color:         th.colors.muted,
    marginBottom:  8,
  },

  // .timer / .now
  timerBox: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    backgroundColor: th.colors.bg,
    borderRadius:    R_BOX,
    paddingHorizontal: 16,
    paddingVertical:   14,
    marginBottom:      12,
  },
  nowBox: {
    backgroundColor: th.colors.bg,
    borderRadius:    R_BOX,
    padding:         16,
    marginBottom:    12,
  },
  nowTop: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
  },
  // La referencia lo pinta a 32; subido a 44 en QA — es el dato que se mira de
  // reojo a metro y medio del suelo.
  clock: {
    fontFamily:    'Inter_900Black',
    fontSize:      44,
    fontWeight:    '900',
    lineHeight:    46,
    letterSpacing: -0.88,
    color:         th.colors.text,
    fontVariant:   ['tabular-nums'],
  },
  clockAccent: { color: th.colors.accent },
  side: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
  },
  sideBig: {
    fontFamily:  'Inter_900Black',
    fontSize:    22,
    fontWeight:  '900',
    lineHeight:  24,
    color:       th.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  sideSmall: {
    fontFamily:  'Inter_900Black',
    fontSize:    15,
    fontWeight:  '900',
    lineHeight:  18,
    color:       th.colors.text,
    fontVariant: ['tabular-nums'],
  },
  sideLabel: {
    fontFamily:    'Inter_700Bold',
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
    color:         th.colors.muted,
    marginTop:     4,
  },

  // .now-main / .now-next
  nowMain: { marginTop: 16 },
  work: {
    fontFamily:    'Inter_900Black',
    fontSize:      24,
    fontWeight:    '900',
    lineHeight:    28,
    letterSpacing: -0.24,
    color:         th.colors.text,
    fontVariant:   ['tabular-nums'],
  },
  workUnit: { color: th.colors.mutedLight },
  workX:    { color: th.colors.muted, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  workLoad: {
    fontFamily: 'Inter_700Bold',
    fontSize:   14,
    fontWeight: '700',
    color:      th.colors.mutedLight,
    marginTop:  4,
  },
  nowNext: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           8,
    marginTop:     14,
  },
  nextLabel: {
    fontFamily:    'Inter_700Bold',
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
    color:         th.colors.muted,
  },
  nextTxt: {
    flexShrink:  1,
    fontFamily:  'Inter_700Bold',
    fontSize:    12,
    fontWeight:  '700',
    color:       th.colors.mutedLight,
    fontVariant: ['tabular-nums'],
  },

  // .ref-list / .ref-row
  moveList: { marginBottom: 14 },
  moveRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    height:        38,
  },
  moveAmount: {
    minWidth:    34,
    fontFamily:  'Inter_900Black',
    fontSize:    15,
    fontWeight:  '900',
    color:       th.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  moveUnit: {
    fontFamily: 'Inter_700Bold',
    fontSize:   12,
    fontWeight: '700',
    color:      th.colors.mutedLight,
  },
  moveName: {
    flex:       1,
    fontFamily: 'Inter_800ExtraBold',
    fontSize:   14,
    fontWeight: '800',
    color:      th.colors.text,
  },
  moveLoad: {
    fontFamily:  'Inter_700Bold',
    fontSize:    12,
    fontWeight:  '700',
    color:       th.colors.mutedLight,
    fontVariant: ['tabular-nums'],
  },

  // .minutes — casilla de intervalo
  grid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  cell: {
    width:           CELL_W,
    height:          CELL_H,
    borderRadius:    R_CELL,
    backgroundColor: th.colors.bg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cellDone:    { backgroundColor: th.colors.accent },
  cellFailed:  { backgroundColor: th.colors.surface2 },
  cellCurrent: { backgroundColor: th.tint.accent10 },
  cellTxt: {
    fontFamily:  'Inter_800ExtraBold',
    fontSize:    13,
    fontWeight:  '800',
    color:       th.colors.muted,
    fontVariant: ['tabular-nums'],
  },
  cellTxtDone:    { fontFamily: 'Inter_900Black', fontWeight: '900', color: th.colors.onAccent },
  cellTxtFailed:  { color: th.colors.mutedLight },
  cellTxtCurrent: { color: th.colors.accent },

  // .round-btn + restar
  roundRow: {
    flexDirection: 'row',
    gap:           8,
  },
  roundBtn: {
    flex:            1,
    height:          BTN_H,
    borderRadius:    R_BTN,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  roundBtnTxt: {
    fontFamily:    'Inter_900Black',
    fontSize:      16,
    fontWeight:    '900',
    letterSpacing: 0.32,
    color:         th.colors.onAccent,
  },
  minusBtn: {
    width:           BTN_H,
    height:          BTN_H,
    borderRadius:    R_BTN,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  minusTxt: {
    fontFamily: 'Inter_700Bold',
    fontSize:   22,
    fontWeight: '700',
    lineHeight: 26,
    color:      th.colors.mutedLight,
  },

  primaryBtn: {
    height:          BTN_H,
    borderRadius:    R_BTN,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  primaryTxt: {
    fontFamily:    'Inter_900Black',
    fontSize:      16,
    fontWeight:    '900',
    letterSpacing: 0.32,
    color:         th.colors.onAccent,
  },
  tertiaryBtn: {
    alignItems:      'center',
    paddingVertical: 12,
    marginTop:       4,
  },
  tertiaryTxt: {
    fontFamily:    'Inter_800ExtraBold',
    fontSize:      12,
    fontWeight:    '800',
    letterSpacing: 1.2,
    color:         th.colors.accent,
  },

  // .hint
  hint: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   11,
    fontWeight: '600',
    color:      th.colors.muted,
    textAlign:  'center',
    marginTop:  10,
  },
  timeUp: {
    fontFamily:   'Inter_800ExtraBold',
    fontSize:     12,
    fontWeight:   '800',
    color:        th.colors.accent,
    textAlign:    'center',
    marginBottom: 12,
  },
  timeUpTop: { marginTop: 14 },

  // Ajuste post-tiempo (AMRAP)
  counterRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   10,
  },
  counterLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize:   14,
    fontWeight: '700',
    color:      th.colors.text,
    flexShrink: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  stepBtn: {
    width:           40,
    height:          40,
    borderRadius:    11,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stepBtnTxt: {
    fontSize:   16,
    lineHeight: 20,
    color:      th.colors.mutedLight,
  },
  stepValue: {
    minWidth:    34,
    textAlign:   'center',
    fontFamily:  'Inter_900Black',
    fontSize:    20,
    fontWeight:  '900',
    color:       th.colors.text,
    fontVariant: ['tabular-nums'],
  },

  cancelBtn: {
    alignItems:      'center',
    paddingVertical: 12,
    marginTop:       4,
  },
  cancelTxt: {
    fontFamily:    'Inter_700Bold',
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 1.1,
    color:         th.colors.muted,
  },

  reopenBtn: {
    alignSelf:         'center',
    paddingVertical:   8,
    paddingHorizontal: 16,
  },
  reopenTxt: {
    fontFamily: 'Inter_700Bold',
    fontSize:   12,
    fontWeight: '700',
    color:      th.colors.mutedLight,
  },
});
