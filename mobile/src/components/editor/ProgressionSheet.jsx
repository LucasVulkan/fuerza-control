/**
 * ProgressionSheet — el cuerpo de la hoja de Progresión, por niveles
 * (P18-motor-progresion.md §7, maqueta `docs/mockups/progresion-hoja.html`):
 * qué sube en tarjetas de carácter con su frase, cuándo y cuánto sube, y lo
 * avanzado plegado. Lo usan el editor de ejercicio y el alta de ejercicio
 * propio: la misma hoja en los dos sitios.
 *
 * Solo pinta. Lo de «dejar el estado coherente» tras un cambio (encender RPE,
 * pasar a un solo valor de inicio…) toca el Volumen de cada pantalla y se queda
 * en quien la usa: aquí solo sale `onPatch(patch)`.
 *
 * `prog` es el formulario de `utils/progressionForm`; `ctx` = { def, sets,
 * metric, range }; el resto son los valores de Volumen que se recuerdan bajo el
 * nombre (series y reps no se tocan aquí: siguen en Volumen).
 */
import { useState, useEffect } from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, interpolate, interpolateColor,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Text } from '../ui/Text';
import { useTranslation } from 'react-i18next';
import { MAX_RELIABLE_REPS } from '../../utils/oneRm';
import { progressionRule } from '../../utils/progression';
import {
  upOptions, showHow, effortBlocked, isEffort as isEffortForm, libraryStep, buildProgression,
} from '../../utils/progressionForm';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { spacing, textStyles, lh, LINE } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import SegmentedControl from '../ui/SegmentedControl';
import StepField from '../ui/StepField';
import AnimatedHeight from '../ui/AnimatedHeight';

// Los iconos de las tarjetas de «Qué sube» (24×24): un solo trazo, sin rellenos,
// y cada uno centrado en su caja (el dibujo ocupa lo mismo a cada lado del 12).
const SW = 2;
const line = (c, extra) => ({ stroke: c, strokeWidth: SW, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none', ...extra });
const TILE_ICON = {
  // Mancuerna: barra, un disco y un tope por lado.
  weight: (c) => (<>
    <Path d="M7 12h10M2.5 10v4M21.5 10v4" {...line(c)} />
    <Rect x={4.5} y={7} width={2.5} height={10} rx={1} {...line(c)} />
    <Rect x={17} y={7} width={2.5} height={10} rx={1} {...line(c)} />
  </>),
  // Ayuda: la barra de dominadas y la flecha que baja la ayuda.
  assist: (c) => <Path d="M4 5h16M12 8.5v11M7.5 15l4.5 4.5 4.5-4.5" {...line(c)} />,
  // Reps: «×10», como en una tipografía: la × pequeña apoyada en la línea de
  // base (y = 17) y los números de caja alta, el 1 recto con su asta y el 0 de
  // lados rectos.
  reps: (c) => (<>
    <Path d="M2.5 13l4 4M6.5 13l-4 4" {...line(c)} />
    <Path d="M10 9l2.8-2v10" {...line(c, { strokeLinecap: 'butt', strokeLinejoin: 'miter' })} />
    <Rect x={15.5} y={7} width={6} height={10} rx={3} {...line(c)} />
  </>),
  // Tiempo: cronómetro con su corona.
  time: (c) => (<>
    <Circle cx={12} cy={13.2} r={7.3} {...line(c)} />
    <Path d="M10 3h4M12 3v2.8M12 9.5v3.9l2.6 1.7" {...line(c)} />
  </>),
  // Esfuerzo: un cuentarrevoluciones con la aguja.
  effort: (c) => (<>
    <Path d="M4 15.5a8 8 0 0 1 16 0M12 15.5l4.3-4.8" {...line(c)} />
    <Circle cx={12} cy={15.5} r={1.8} fill={c} />
  </>),
  // Nada: una raya.
  none: (c) => <Path d="M6 12h12" {...line(c, { strokeWidth: 2.4 })} />,
};
const TILE_ORDER = ['weight', 'reps', 'time', 'effort', 'none'];
const WEIGHT_CHIPS = [1.25, 2.5, 5];
const PCT_CHIP = 5;
const REPS_CHIPS = [1, 2, 3];
const SECS_CHIPS = [5, 10, 15];

// El relleno de lo elegido, como las fichas de etapa (StageCards) y las pestañas
// de Inicio: se llena de lima desde la esquina de arriba a la derecha.
const FILL_MS  = 450;
const EMPTY_MS = 200;

function useFill(on) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(on ? 1 : 0, { duration: on ? FILL_MS : EMPTY_MS, easing: Easing.out(Easing.cubic) }));
  }, [on, p]);
  return p;
}

/**
 * Un botón que se rellena al elegirlo. `face(on)` pinta su contenido con los
 * colores de cada estado; las dos caras se funden mientras entra el lima.
 * `bg` es el fondo en reposo; `faceStyle`, la colocación de las dos caras.
 */
function FillButton({ on, disabled, onPress, style, bg, faceStyle, face, a11yLabel }) {
  const th = useTheme();
  const p  = useFill(on);
  const [r, setR] = useState(0);
  const circle = useAnimatedStyle(() => ({ transform: [{ scale: p.get() }] }));
  const offS   = useAnimatedStyle(() => ({ opacity: interpolate(p.get(), [0, 0.6], [1, 0], 'clamp') }));
  const onS    = useAnimatedStyle(() => ({ opacity: interpolate(p.get(), [0.4, 1], [0, 1], 'clamp') }));
  return (
    <Pressable
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected: on, disabled }}
    >
      {({ pressed }) => (
        <View
          style={[fillStyles.box, { backgroundColor: bg }, pressed && fillStyles.pressed, disabled && fillStyles.off]}
          onLayout={(e) => setR(Math.ceil(Math.hypot(e.nativeEvent.layout.width, e.nativeEvent.layout.height)))}
        >
          <Reanimated.View style={[faceStyle, offS]}>{face(false)}</Reanimated.View>
          <Reanimated.View
            pointerEvents="none"
            style={[fillStyles.circle, { width: r * 2, height: r * 2, borderRadius: r, right: -r, top: -r, backgroundColor: th.colors.accent }, circle]}
          />
          <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, faceStyle, onS]}>{face(true)}</Reanimated.View>
        </View>
      )}
    </Pressable>
  );
}

const fillStyles = StyleSheet.create({
  box:     { overflow: 'hidden', flexGrow: 1 },
  circle:  { position: 'absolute' },
  pressed: { transform: [{ scale: 0.96 }] },
  off:     { opacity: 0.4 },
});

/** Las tarjetas de «Cuándo sube» van con borde (no rellenas): el borde se enciende. */
function WhenCard({ on, disabled, onPress, children }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const p      = useFill(on);
  const border = useAnimatedStyle(() => ({
    borderColor: interpolateColor(p.get(), [0, 1], [th.colors.surface, th.colors.accent]),
  }));
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.cardSlot} accessibilityRole="button" accessibilityState={{ selected: on, disabled }}>
      {({ pressed }) => (
        <Reanimated.View style={[styles.card, border, pressed && fillStyles.pressed, disabled && fillStyles.off]}>
          {children}
        </Reanimated.View>
      )}
    </Pressable>
  );
}

/** «**negrita** y el resto»: la parte que importa de cada frase va en negrita. */
function Bold({ text, style, boldStyle }) {
  return (
    <Text style={style}>
      {text.split('**').map((part, i) => (i % 2 ? <Text key={i} style={boldStyle}>{part}</Text> : part))}
    </Text>
  );
}

export default function ProgressionSheet({ name, prog, ctx, minReps, maxReps, minTime, maxTime, onPatch }) {
  const styles = useThemedStyles(makeStyles);
  const th     = useTheme();
  const { t }                  = useTranslation();
  const { label: weightLabel } = useWeightUnit();
  const [advOpen, setAdvOpen]       = useState(false);
  const [effortWhy, setEffortWhy]   = useState(false);
  const { def, sets } = ctx;
  const isTime    = ctx.metric === 'time';
  const repsFixed = !ctx.range;
  const effort    = isEffortForm(prog, ctx);
  const assist    = def?.progressionDirection === 'decrease';
  const isWeight  = prog.up === 'weight' && !effort;
  const libStep   = libraryStep(def, effort);

  // ── Qué sube: Esfuerzo es Peso calculado con el RPE (el `how` del formulario).
  const offered = upOptions(ctx);
  const effortTile = showHow({ ...prog, up: 'weight' }, ctx);
  const tiles = TILE_ORDER.filter((id) => (id === 'effort' ? effortTile : offered.includes(id)));
  const tile = effort ? 'effort' : prog.up;
  const pickTile = (id) => {
    if (id === 'effort' && effortBlocked(ctx)) { setEffortWhy(true); return; }
    setEffortWhy(false);
    onPatch(id === 'effort' ? { up: 'weight', how: 'effort' } : { up: id, how: 'rules' });
  };
  const sayKey = tile === 'weight'
    ? (assist ? 'assist' : isTime ? 'weightTime' : repsFixed ? 'weightFixed' : 'weight')
    : tile;

  // Bajo el nombre, su volumen como meta (en gris; se cambia en Volumen). Siempre,
  // también en Nada: si la línea desapareciera, todo lo de debajo daría un salto.
  const meta = prog.up === 'reps' ? t('exerciseEditor.sheet.metaReps', { sets, reps: minReps })
    : prog.up === 'time' ? t('exerciseEditor.sheet.metaSecs', { sets, secs: minTime })
    : isTime ? t('exerciseEditor.sheet.metaTime', { sets, min: minTime, max: maxTime })
    : repsFixed || effort ? t('exerciseEditor.sheet.metaFixed', { sets, reps: minReps })
    : t('exerciseEditor.sheet.metaRange', { sets, min: minReps, max: maxReps });

  // La meta de Peso: el máximo del rango o las reps fijas; con Tiempo, los segundos.
  const repsTxt = (n) => t('progression.next.reps', { count: n });
  const goalTxt  = isTime ? `${maxTime} s` : repsTxt(repsFixed ? minReps : maxReps);
  const floorTxt = isTime ? `${minTime} s` : repsTxt(minReps);
  const majority = Math.floor(sets / 2) + 1;

  // El escalón del ejercicio: el salto más pequeño que permite su material. A él
  // se redondea el peso cuando sube un % y cuando baja un 10 %.
  const stepField = (
    <StepField horizontal label={t('exerciseEditor.sheet.step')} unit={weightLabel}
      value={prog.step ?? libStep} onChange={(v) => onPatch({ step: v })} min={0.25} max={10} step={0.25} />
  );
  const caps = (txt) => <Text style={styles.caps}>{txt.toUpperCase()}</Text>;
  const hint = (txt) => <Text style={styles.hint}>{txt}</Text>;
  // Cuánto sube: las opciones como botones en fila, sin tarjeta alrededor.
  const options = (values, isOn, label, onPick) => (
    <View style={styles.options}>
      {values.map((v) => (
        <FillButton
          key={String(v)}
          on={isOn(v)}
          onPress={() => onPick(v)}
          style={styles.option}
          bg={th.colors.surface}
          faceStyle={styles.optionFace}
          face={(on) => <Text style={[styles.optionText, on && styles.optionTextOn]} numberOfLines={1}>{label(v)}</Text>}
        />
      ))}
    </View>
  );
  const squares = (hit) => (
    <View style={styles.squares}>
      {Array.from({ length: Math.min(sets, 10) }, (_, i) => (
        <View key={i} style={[styles.square, i < hit ? styles.squareHit : styles.squareMid]} />
      ))}
    </View>
  );
  const whenCard = (id, hit, title, sub, disabled) => (
    <WhenCard
      on={id === 'part' ? prog.when === 'part' : prog.when !== 'part'}
      disabled={disabled}
      onPress={() => onPatch({ when: id === 'part' ? 'part' : prog.when === 'rpe' ? 'rpe' : 'all_complete' })}
    >
      {squares(hit)}
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSub}>{sub}</Text>
    </WhenCard>
  );

  const effortRir = 10 - prog.targetRpe;
  // Misma regla que el motor: pasado MAX_RELIABLE_REPS no calcula (§2.3).
  const effortUnreliable = effort && minReps + effortRir >= MAX_RELIABLE_REPS;

  // La frase de la regla al pie: la misma que el motor (`progressionRule`).
  const ruleCfg = { sets, minReps, maxReps, minTime, maxTime, inputType: isTime ? 'weight_time' : 'weight_reps', ...buildProgression(prog, ctx) };
  const rule = progressionRule(ruleCfg, def, t, weightLabel);

  return (
    // Lo que se elige abre y cierra bloques: la hoja sigue su alto.
    <AnimatedHeight>
      <View style={styles.body}>
        <View>
          {name ? <Text style={styles.name}>{name}</Text> : null}
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>

        <View>
          {caps(t('exerciseEditor.sheet.up'))}
          <View style={styles.tiles}>
            {tiles.map((id) => {
              const icon = id === 'weight' && assist ? 'assist' : id;
              return (
                <FillButton
                  key={id}
                  on={id === tile}
                  disabled={id === 'effort' && effortBlocked(ctx)}
                  onPress={() => pickTile(id)}
                  style={styles.tile}
                  bg={th.colors.surface}
                  faceStyle={styles.tileFace}
                  a11yLabel={t(`exerciseEditor.sheet.tiles.${icon}`)}
                  face={(on) => (
                    <>
                      <Svg width={24} height={24} viewBox="0 0 24 24">
                        {TILE_ICON[icon](on ? th.colors.onAccent : id === 'none' ? th.colors.mutedLight : th.colors.accent)}
                      </Svg>
                      <Text style={[styles.tileText, on && styles.tileTextOn]} numberOfLines={1}>
                        {t(`exerciseEditor.sheet.tiles.${icon}`)}
                      </Text>
                    </>
                  )}
                />
              );
            })}
          </View>
          <Bold text={t(`exerciseEditor.sheet.say.${sayKey}`)} style={styles.say} boldStyle={styles.sayBold} />
          {effortWhy && <Text style={[styles.hint, styles.warn]}>{t('exerciseEditor.effortNeedsFixed')}</Text>}
        </View>

        {isWeight && (
          <View>
            {caps(t('exerciseEditor.sheet.when'))}
            <View style={styles.cards}>
              {whenCard('all', sets, t('exerciseEditor.sheet.allTitle'), t('exerciseEditor.sheet.allSub', { n: sets, goal: goalTxt }))}
              {whenCard('part', majority, t('exerciseEditor.sheet.partTitle'),
                t(repsFixed || isTime ? 'exerciseEditor.sheet.partSub' : 'exerciseEditor.sheet.partSubRange',
                  { need: majority, n: sets, goal: goalTxt, min: floorTxt }), sets < 2)}
            </View>
          </View>
        )}

        {isWeight && (
          <View>
            {caps(t(assist ? 'exerciseEditor.sheet.howMuchAssist' : 'exerciseEditor.sheet.howMuchEach'))}
            {options(
              [...WEIGHT_CHIPS, 'pct'],
              (v) => (v === 'pct' ? prog.incType === 'pct' : prog.incType === 'fixed' && prog.incValue === v),
              (v) => (v === 'pct' ? `${prog.incType === 'pct' ? prog.incPct : PCT_CHIP} %` : `${v} ${weightLabel}`),
              (v) => onPatch(v === 'pct' ? { incType: 'pct', incPct: prog.incType === 'pct' ? prog.incPct : PCT_CHIP } : { incType: 'fixed', incValue: v }),
            )}
            {/* Con porcentaje: cuánto, y a qué se redondea el peso que sale. */}
            {prog.incType === 'pct' && (
              <View style={styles.pctBox}>
                <StepField horizontal unit="%" label={t('exerciseEditor.sheet.pctLabel')}
                  value={prog.incPct} onChange={(v) => onPatch({ incPct: v })} min={1} max={50} />
                {stepField}
                {hint(t('exerciseEditor.sheet.pctHint', { pct: prog.incPct, step: prog.step ?? libStep, unit: weightLabel }))}
              </View>
            )}
          </View>
        )}

        {(prog.up === 'reps' || prog.up === 'time') && (
          <View>
            {caps(t('exerciseEditor.sheet.howMuchPerSet'))}
            {options(
              prog.up === 'reps' ? REPS_CHIPS : SECS_CHIPS,
              (v) => prog.incValue === v,
              (v) => (prog.up === 'reps' ? `+${repsTxt(v)}` : `+${v} s`),
              (v) => onPatch({ incValue: v }),
            )}
          </View>
        )}

        {effort && (
          <View>
            {caps(t('exerciseEditor.sheet.effortGoal'))}
            <StepField horizontal label="RPE" value={prog.targetRpe} onChange={(v) => onPatch({ targetRpe: v })} min={6} max={10} />
            {hint(effortRir === 0 ? t('exerciseEditor.effortFailure') : t('exerciseEditor.sheet.rir', { count: effortRir }))}
            {effortUnreliable && <Text style={[styles.hint, styles.warn]}>{t('exerciseEditor.effortUnreliable', { max: MAX_RELIABLE_REPS })}</Text>}
          </View>
        )}

        {(isWeight || effort) && (
          <View style={styles.adv}>
            <TouchableOpacity style={styles.advHead} onPress={() => setAdvOpen((v) => !v)} activeOpacity={0.7}>
              <Text style={styles.advTitle}>{t('exerciseEditor.sheet.advanced')}</Text>
              <Text style={styles.advChevron}>{advOpen ? '⌄' : '›'}</Text>
            </TouchableOpacity>
            {advOpen && (
              <View style={styles.advBody}>
                {isWeight ? (
                  <>
                    <View>
                      <Text style={styles.advLabel}>{t('exerciseEditor.sheet.brake')}</Text>
                      <SegmentedControl
                        options={['no', 'rpe'].map((id) => ({ id, label: t(`exerciseEditor.sheet.brakeOpt.${id}`) }))}
                        value={prog.when === 'rpe' ? 'rpe' : 'no'}
                        onChange={(id) => onPatch({ when: id === 'rpe' ? 'rpe' : 'all_complete' })}
                      />
                      {prog.when === 'rpe' && (
                        <View style={styles.gap}>
                          <StepField horizontal label={t('exerciseEditor.sheet.brakeMax')} value={prog.maxRpe}
                            onChange={(v) => onPatch({ maxRpe: v })} min={6} max={10} />
                        </View>
                      )}
                      {hint(prog.when === 'rpe'
                        ? t('exerciseEditor.sheet.brakeOnHint', { rpe: prog.maxRpe })
                        : t('exerciseEditor.sheet.brakeOffHint'))}
                    </View>
                    <View>
                      <Text style={styles.advLabel}>{t('exerciseEditor.sheet.down')}</Text>
                      <SegmentedControl
                        options={['fail', 'never'].map((id) => ({ id, label: t(`exerciseEditor.sheet.downOpt.${id}`) }))}
                        value={prog.down}
                        onChange={(id) => onPatch({ down: id })}
                      />
                      {hint(t(prog.down === 'never' ? 'exerciseEditor.sheet.downNeverHint'
                        : assist ? 'exerciseEditor.sheet.downFailHintAssist' : 'exerciseEditor.sheet.downFailHint'))}
                    </View>
                    {/* Con porcentaje el escalón ya está arriba, junto al %. */}
                    {prog.incType !== 'pct' && (
                      <View>
                        {stepField}
                        {hint(t('exerciseEditor.sheet.stepHint', { step: prog.step ?? libStep, unit: weightLabel }))}
                      </View>
                    )}
                  </>
                ) : (
                  // Por esfuerzo: el escalón (o Exacto) y cuándo sube, que antes eran pasos.
                  <>
                    <View>
                      <Text style={styles.advLabel}>{t('exerciseEditor.stepSize')}</Text>
                      <SegmentedControl
                        options={['step', 'exact'].map((id) => ({ id, label: t(`exerciseEditor.stepSizeOpt.${id}`) }))}
                        value={prog.exact ? 'exact' : 'step'}
                        onChange={(id) => onPatch({ exact: id === 'exact' })}
                      />
                      {!prog.exact && (
                        <View style={styles.gap}>
                          <StepField horizontal label={t('exerciseEditor.stepSizeLabel')} unit={weightLabel}
                            value={prog.step ?? libStep} onChange={(v) => onPatch({ step: v })} min={0.25} max={10} step={0.25} />
                        </View>
                      )}
                      {hint(t(prog.exact ? 'exerciseEditor.stepSizeExactHint' : 'exerciseEditor.stepSizeHint'))}
                    </View>
                    {/* Con Exacto el peso se mueve con cualquier cambio y «Al llegar» no se daría nunca. */}
                    {!prog.exact && (
                      <View>
                        <Text style={styles.advLabel}>{t('exerciseEditor.stepWhen')}</Text>
                        <SegmentedControl
                          options={['beat', 'reach'].map((id) => ({ id, label: t(`exerciseEditor.effWhen.${id}`) }))}
                          value={prog.effWhen}
                          onChange={(id) => onPatch({ effWhen: id })}
                        />
                        {hint(t(`exerciseEditor.effWhenHint.${prog.effWhen}`, { step: prog.step ?? libStep, unit: weightLabel }))}
                        {hint(t('exerciseEditor.effDownHint'))}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        )}

        <Text style={styles.rule}>{rule}</Text>
      </View>
    </AnimatedHeight>
  );
}

const makeStyles = (th) => StyleSheet.create({
  body: { gap: spacing.xl, paddingBottom: spacing.sm },
  name: { ...textStyles.bodyStrong, color: th.colors.text },
  meta: { ...textStyles.label, color: th.colors.mutedLight, marginTop: spacing.xs, fontVariant: ['tabular-nums'] },
  // Misma tipografía que las etiquetas de sección del editor (`secLabel`).
  caps: { ...textStyles.caps, color: th.colors.mutedLight, marginBottom: spacing.sm2 },
  hint: { ...textStyles.label, color: th.colors.mutedLight, marginTop: spacing.sm, lineHeight: lh(textStyles.label.fontSize, LINE.row) },
  // Aviso: el naranja de `optRowWarn` (EditorRows).
  warn: { color: th.colors.orange },
  off: { opacity: 0.4 },
  gap: { marginTop: spacing.sm2 },

  // Tarjetas de carácter sobre la hoja (`surface`; nada va en `bg` dentro de una
  // hoja, DragSheet): la elegida se rellena de lima con el texto en negro.
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, borderRadius: th.radius.md, overflow: 'hidden' },
  tileFace: {
    alignItems: 'center', justifyContent: 'center', gap: spacing.xs2,
    paddingTop: spacing.md, paddingBottom: spacing.sm2, paddingHorizontal: spacing.xs,
  },
  tileText: { ...textStyles.labelStrong, color: th.colors.mutedLight },
  tileTextOn: { color: th.colors.onAccent },
  say: { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.md, lineHeight: lh(textStyles.body.fontSize, LINE.row) },
  sayBold: { fontFamily: textStyles.labelStrong.fontFamily, color: th.colors.text },

  // Cuándo sube: tarjetas grandes con borde (no rellenas), un cuadradito por serie.
  cards: { flexDirection: 'row', gap: spacing.sm2 },
  cardSlot: { flex: 1 },
  card: {
    flex: 1, backgroundColor: th.colors.surface, borderRadius: th.radius.md,
    padding: spacing.md, borderWidth: 1.5,
  },
  squares: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs2, marginBottom: spacing.md },
  square: { width: 18, height: 18, borderRadius: th.radius.xs },
  squareHit: { backgroundColor: th.colors.accent },
  squareMid: { backgroundColor: th.colors.surface2, borderWidth: 1, borderColor: th.colors.mutedLight },
  cardTitle: { ...textStyles.bodyStrong, color: th.colors.text },
  cardSub: { ...textStyles.label, color: th.colors.mutedLight, marginTop: spacing.xs2 },

  // Cuánto sube: botones en fila, del mismo ancho.
  options: { flexDirection: 'row', gap: spacing.sm },
  option: { flex: 1, borderRadius: th.radius.md, overflow: 'hidden' },
  optionFace: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.xs },
  optionText: { ...textStyles.bodyStrong, color: th.colors.text },
  optionTextOn: { color: th.colors.onAccent },

  pctBox: { marginTop: spacing.sm2, gap: spacing.sm2 },

  // Avanzado, plegado.
  adv: { backgroundColor: th.colors.surface, borderRadius: th.radius.md },
  advHead: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  advTitle: { ...textStyles.bodyStrong, color: th.colors.text },
  advChevron: { ...textStyles.bodyStrong, color: th.colors.muted },
  advBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.lg },
  advLabel: { ...textStyles.labelStrong, color: th.colors.text, marginBottom: spacing.sm },

  // La regla al pie, colgada de una raya lima.
  rule: {
    ...textStyles.body, color: th.colors.text, lineHeight: lh(textStyles.body.fontSize, LINE.row),
    borderLeftWidth: 2, borderLeftColor: th.colors.accent, paddingLeft: spacing.md,
  },
});
