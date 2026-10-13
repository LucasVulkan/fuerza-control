/**
 * ProgramStages — las etapas del tab Programa (docs/specs/U14-pantalla-programa.md §5)
 * y las piezas de su entrada por partes (§4.3).
 *
 * Una fila por etapa; la en curso, en su sitio de la lista, va en ficha: «EN
 * CURSO · SEMANA 3 DE 4», número y nombre en Barlow, la barra corta por semanas
 * y las sesiones hechas. Sin relleno lima: destaca por tamaño.
 *
 * Elegir otra etapa se nota como en el onboarding: la fila se rellena de lima
 * desde su marca y se abre una hoja con titular. Cambiar de etapa deja la nueva
 * sin empezar —lo que llevas de la en curso deja de contar—, así que se confirma.
 *
 * Rótulo y filas entran por partes con `Rise` (el reloj, de la pantalla).
 */
import { useContext, useEffect, useRef, useState } from 'react';
import { View, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, interpolate,
} from 'react-native-reanimated';
import { Rise } from './ui/Rise';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import { Text } from './ui/Text';
import Marked from './ui/Marked';
import DragSheet from './DragSheet';
import { SheetContext } from './ui/sheetContext';
import { CheckIcon, LockIcon } from './ui/EditorIcons';
import { stageWeekLabel, programTotals, weeklySessions } from '../utils/stageProgress';
import { stageWeekRanges, stageRangeLabel, isDeload } from '../utils/stageStats';
import { isStageLocked } from '../utils/stageLocks';
import { spacing, textStyles, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

/**
 * Las semanas de una etapa en tramos inclinados, encendidos hasta la en curso
 * incluida. `wide`: la barra corta de la ficha (ancho fijo, tramos que se
 * reparten); si no, los de 16 dp de la tarjeta.
 */
export function WeekTicks({ total, on, color, wide = false }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.ticks, wide && styles.ticksWide]}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.tick, wide ? styles.tickFlex : styles.tickFixed, i < on && { backgroundColor: color }]} />
      ))}
    </View>
  );
}

// ── Una fila ──────────────────────────────────────────────────────────────────

const MARK   = 22;
// El relleno sale del centro de la marca de la derecha y cubre la fila entera.
const MARK_X = spacing.lg + 1 + MARK / 2;
const FILL_R = 420;
const FILL_MS  = 450;            // como las entradas del paywall y las pestañas de Inicio
const EMPTY_MS = 200;
const PRESS_DELAY = 100;

function StageRow({ number, name, meta, done, deload, locked, picked, onPress }) {
  const th     = useTheme();
  const C      = th.colors;
  const styles = useThemedStyles(makeStyles);
  const p      = useSharedValue(0);

  useEffect(() => {
    p.set(withTiming(picked ? 1 : 0, { duration: picked ? FILL_MS : EMPTY_MS, easing: Easing.out(Easing.cubic) }));
  }, [picked, p]);

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: p.get() }] }));
  const off    = useAnimatedStyle(() => ({ opacity: interpolate(p.get(), [0, 0.6], [1, 0], 'clamp') }));
  const on     = useAnimatedStyle(() => ({ opacity: interpolate(p.get(), [0.4, 1], [0, 1], 'clamp') }));

  const numColor = deload ? C.blue : done ? C.muted : C.text;
  const mark = locked
    ? <LockIcon size={13} color={C.muted} />
    : done
      ? <View style={styles.check}><CheckIcon size={12} color={C.mutedLight} /></View>
      : <View style={styles.ring} />;

  // Las dos caras (sin elegir y sobre el lima) en el mismo sitio: se funden.
  const face = (num, title, sub, withMark) => (
    <>
      <Text style={[styles.rowNum, { color: num }]}>{number}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: title }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.rowMeta, { color: sub }]} numberOfLines={1}>{meta}</Text>
      </View>
      <View style={styles.mark}>{withMark && mark}</View>
    </>
  );

  return (
    // El retraso: sin él, empezar un scroll encima de una fila la encogía como si
    // se hubiera tocado. Un scroll cancela el toque antes de que llegue.
    <Pressable
      onPress={onPress}
      disabled={locked}
      unstable_pressDelay={PRESS_DELAY}
      accessibilityRole="button"
      accessibilityLabel={`${number} ${name}, ${meta}`}
    >
      {({ pressed }) => (
        <View style={[styles.row, pressed && !locked && styles.rowPressed]}>
          <Reanimated.View pointerEvents="none" style={[styles.fill, circle]} />
          <Reanimated.View style={[styles.rowFace, off]}>
            {face(numColor, done ? C.mutedLight : C.text, C.mutedLight, true)}
          </Reanimated.View>
          <Reanimated.View pointerEvents="none" style={[styles.rowFace, styles.rowFaceOn, on]}>
            {face(C.onAccent, C.onAccent, withOpacity(C.onAccent, 0.68), false)}
          </Reanimated.View>
        </View>
      )}
    </Pressable>
  );
}

// ── La ficha de la en curso ───────────────────────────────────────────────────

function CurrentStage({ number, name, meta, status, deload }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tone   = deload ? th.colors.blue : th.colors.accent;

  const week = status.started ? stageWeekLabel(status, t) : t('programCard.stageNotStarted');
  // Sin empezar sale «0 de 12 sesiones»: la ceja ya dice «sin empezar».
  const sessions = status.expected != null
      ? (
        <Text style={styles.nowSessions}>
          <Text style={styles.nowSessionsDone}>{status.done}</Text> {t('myProgram.stageSessionsOf', { expected: status.expected })}
        </Text>
      )
      : <Text style={styles.nowSessions}>{t('myProgram.stageSessionsOpen', { count: status.done })}</Text>;

  return (
    <View style={styles.now}>
      <Text style={[styles.caps, { color: tone }]} numberOfLines={1}>
        {`${t('myProgram.stageNow')} · ${week}`.toUpperCase()}
      </Text>
      <View style={styles.nowHead}>
        <Text style={[styles.nowNum, { color: tone }]}>{number}</Text>
        <Text style={styles.nowName} numberOfLines={2}>{name}</Text>
      </View>
      <Text style={styles.nowMeta} numberOfLines={1}>{meta}</Text>
      <View style={styles.nowFoot}>
        {/* Sin techo no hay semanas que contar: solo las sesiones. */}
        {status.lengthWeeks != null && (
          <WeekTicks wide total={status.lengthWeeks} on={status.started ? status.weekInStage : 0} color={tone} />
        )}
        {sessions}
      </View>
    </View>
  );
}

// ── La hoja de cambio ─────────────────────────────────────────────────────────

function ConfirmBody({ title, body, onConfirm }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const sheet  = useContext(SheetContext);
  return (
    <View style={styles.sheet}>
      <Marked text={title} style={styles.sheetTitle} accentStyle={styles.sheetAccent} />
      <Text style={styles.sheetBody}>{body}</Text>
      <TouchableOpacity
        style={styles.cta}
        activeOpacity={0.8}
        accessibilityRole="button"
        onPress={() => { onConfirm(); sheet?.dismiss(); }}
      >
        <Text style={styles.ctaText}>{t('myProgram.stageConfirm.confirm').toUpperCase()}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancel} activeOpacity={0.7} accessibilityRole="button" onPress={() => sheet?.dismiss()}>
        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── La lista ──────────────────────────────────────────────────────────────────

/**
 * `status` es el `stageStatus` de la pantalla (la etapa en la que va el atleta,
 * la misma que dice la tarjeta). `firstIndex`: el turno del rótulo en la entrada
 * por partes; las filas van detrás. `onSelect(idx)` cambia de etapa, ya confirmado.
 */
export default function ProgramStages({ program, status, firstIndex, onSelect }) {
  const { t }      = useTranslation();
  const styles     = useThemedStyles(makeStyles);
  const clientSync = useStore((s) => s.clientSync);

  const [picked, setPicked] = useState(null);
  const [sheet,  setSheet]  = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const stages  = program.stages ?? [];
  const current = status.stageIdx;
  const ranges  = stageWeekRanges(stages);
  const totals  = programTotals(program);
  const nameOf  = (st, i) => st.name ?? t('home.stageDefault', { n: i + 1 });
  const metaOf  = (st, i) => `${stageRangeLabel(st, ranges[i], t)} · ${t('home.stageSessionsPerWeek', { count: weeklySessions(st) })}`;

  // El texto de la hoja se fija al abrirla: al confirmar la pantalla se repinta
  // con la etapa nueva mientras la hoja aún se va.
  const pick = (idx) => {
    if (picked != null) return;
    setPicked(idx);
    const name = nameOf(stages[idx], idx);
    timer.current = setTimeout(() => setSheet({
      idx,
      title: t('myProgram.stageConfirm.title', { name }),
      body:  status.started ? t('myProgram.stageConfirm.bodyStarted', { name }) : t('myProgram.stageConfirm.body'),
    }), 300);
  };

  return (
    <>
      <Rise index={firstIndex}>
        <View style={styles.label}>
          <Text style={[styles.caps, styles.labelText]}>{t('myProgram.stagesLabel').toUpperCase()}</Text>
          <Text style={[styles.caps, styles.labelCount]}>
            {t('myProgram.stagesTotal', { count: stages.length, weeks: totals.open ? `${totals.weeks}+` : totals.weeks }).toUpperCase()}
          </Text>
        </View>
      </Rise>

      <View style={styles.list}>
        {stages.map((st, i) => (
          <Rise key={st.id ?? i} index={firstIndex + 1 + i}>
            {i === current ? (
              <CurrentStage number={i + 1} name={nameOf(st, i)} meta={metaOf(st, i)} status={status} deload={isDeload(st)} />
            ) : (
              <StageRow
                number={i + 1}
                name={nameOf(st, i)}
                meta={isStageLocked(program, i, clientSync) ? t('home.stageLockedShort') : metaOf(st, i)}
                done={i < current}
                deload={isDeload(st)}
                locked={isStageLocked(program, i, clientSync)}
                picked={picked === i}
                onPress={() => pick(i)}
              />
            )}
          </Rise>
        ))}
      </View>

      {!!sheet && (
        <DragSheet visible onClose={() => { setSheet(null); setPicked(null); }}>
          <ConfirmBody title={sheet.title} body={sheet.body} onConfirm={() => onSelect(sheet.idx)} />
        </DragSheet>
      )}
    </>
  );
}

const makeStyles = (th) => StyleSheet.create({
  caps: { ...textStyles.caps },

  // ── Rótulo ──
  label: {
    flexDirection:     'row',
    alignItems:        'baseline',
    gap:               spacing.sm2,
    marginTop:         spacing.xl + spacing.xs2,
    marginBottom:      spacing.md,
    paddingHorizontal: spacing.xs2,
  },
  labelText:  { color: th.colors.text },
  labelCount: { color: th.colors.mutedLight, marginLeft: 'auto' },
  list:       { gap: spacing.sm },

  // ── Tramos ──
  ticks:     { flexDirection: 'row', gap: spacing.xs2 },
  ticksWide: { width: 132, flexShrink: 0 },
  tick:      { height: 8, borderRadius: 2, backgroundColor: th.colors.surface3, transform: [{ skewX: '-12deg' }] },
  tickFixed: { width: 16 },
  tickFlex:  { flex: 1 },

  // ── Fila ──
  row: {
    minHeight:       66,
    borderRadius:    th.radius.lg,
    backgroundColor: th.colors.surface,
    overflow:        'hidden',
  },
  rowPressed: { transform: [{ scale: 0.98 }] },
  fill: {
    position:        'absolute',
    width:           FILL_R * 2,
    height:          FILL_R * 2,
    borderRadius:    FILL_R,
    right:           MARK_X - FILL_R,
    top:             '50%',
    marginTop:       -FILL_R,
    backgroundColor: th.colors.accent,
  },
  rowFace: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    minHeight:         66,
    paddingVertical:   spacing.md + spacing.xs,
    paddingHorizontal: spacing.lg + 1,
  },
  rowFaceOn: { ...StyleSheet.absoluteFillObject },
  // La Barlow pide 1.2 em para no cortarse, y 2 de aire a la derecha para la cursiva.
  rowNum:  { ...textStyles.heroName, lineHeight: 34, includeFontPadding: false, minWidth: 20, paddingRight: 2 },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { ...textStyles.itemTitleQuiet },
  rowMeta: { ...textStyles.label, marginTop: spacing.xs },
  mark:    { width: MARK, alignItems: 'center', justifyContent: 'center' },
  ring:    { width: MARK, height: MARK, borderRadius: MARK / 2, borderWidth: 2, borderColor: th.colors.muted },
  check: {
    width:           MARK,
    height:          MARK,
    borderRadius:    MARK / 2,
    backgroundColor: th.colors.surface3,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Ficha de la en curso ──
  now: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.lg,
    paddingTop:        14,
    paddingHorizontal: spacing.lg + 1,
    paddingBottom:     spacing.lg + 1,
  },
  // Número y nombre apoyados en el mismo suelo, como la letra y el nombre de la
  // sesión que toca en Inicio (la cuenta de los 39/34 está en `SessionList`).
  nowHead: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs2 },
  nowNum:  { ...textStyles.heroGlyph, lineHeight: 39, includeFontPadding: false, paddingRight: 2 },
  nowName: {
    ...textStyles.heroName,
    lineHeight:         34,
    includeFontPadding: false,
    textTransform:      'uppercase',
    color:              th.colors.text,
    flex:               1,
    paddingRight:       2,
  },
  nowMeta:  { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.xs },
  nowFoot:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  nowSessions:     { ...textStyles.body, color: th.colors.text, flexShrink: 1 },
  nowSessionsDone: { ...textStyles.bodyStrong, color: th.colors.text },

  // ── Hoja ──
  sheet:      { paddingTop: spacing.sm2 },
  sheetTitle: { ...textStyles.heroName, lineHeight: 34, includeFontPadding: false, textTransform: 'uppercase', color: th.colors.text },
  sheetAccent: { color: th.colors.accent },
  sheetBody:  { ...textStyles.body, lineHeight: 21, color: th.colors.mutedLight, marginTop: spacing.sm2 },
  cta: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.lg + 2,
    alignItems:      'center',
    marginTop:       spacing.xl,
  },
  ctaText:    { ...textStyles.button, color: th.colors.onAccent },
  cancel:     { paddingVertical: spacing.lg, alignItems: 'center' },
  cancelText: { ...textStyles.bodyStrong, color: th.colors.mutedLight },
});
