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
import { useState, useEffect, useId, startTransition } from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, interpolate, interpolateColor,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
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

// Los iconos de las tarjetas de «Qué sube»: un solo trazo, sin rellenos, cada uno
// centrado en su caja de 24×24 (el dibujo ocupa lo mismo a cada lado del 12).
// Peso y Esfuerzo son la excepción (P19-04): los dibujó el usuario, son de relleno
// y llevan su propia caja (`TILE_BOX`) recortada para que pesen como los demás.
// `draw(color, gradId)`: el id del degradado de Esfuerzo es único por cara (cada
// botón pinta la cara apagada y la elegida a la vez, cada una con su color).
const SW = 2;
const line = (c, extra) => ({ stroke: c, strokeWidth: SW, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none', ...extra });
const TILE_BOX = {
  weight: { w: 32, vb: '0 7 54 40' },     // mockups/iconos/peso.svg
  effort: { w: 43, vb: '1 11.5 52 29' },  // mockups/iconos/esfuerzo.svg
};
const DEFAULT_BOX = { w: 24, vb: '0 0 24 24' };
const TILE_ICON = {
  // Mancuerna: la barra, un disco y un tope por lado.
  weight: (c) => (<>
    <Path d="M17.5625 25.375H35.4375V28.625H17.5625V25.375Z" fill={c} />
    <Rect x={37.0625} y={14} width={6.5} height={26} rx={1.625} fill={c} />
    <Rect x={45.1875} y={20.5} width={4.875} height={13} rx={1.625} fill={c} />
    <Rect x={2.9375} y={20.5} width={4.875} height={13} rx={1.625} fill={c} />
    <Rect x={9.4375} y={14} width={6.5} height={26} rx={1.625} fill={c} />
  </>),
  // Ayuda: la barra de dominadas y la flecha que baja la ayuda.
  assist: (c) => <Path d="M4 5h16M12 8.5v11M7.5 15l4.5 4.5 4.5-4.5" {...line(c)} />,
  // Reps: dos flechas en círculo, las de la maqueta (dibujadas en 22, centradas en 24).
  reps: (c) => (
    <Path
      transform="translate(1 1)"
      d="M4.5 10a6.5 6.5 0 0 1 11.6-3.6M17.5 12a6.5 6.5 0 0 1-11.6 3.6M16.8 3.4v3.4h-3.4M5.2 18.6v-3.4h3.4"
      {...line(c)}
    />
  ),
  // Tiempo: cronómetro con su corona.
  time: (c) => (<>
    <Circle cx={12} cy={13.2} r={7.3} {...line(c)} />
    <Path d="M10 3h4M12 3v2.8M12 9.5v3.9l2.6 1.7" {...line(c)} />
  </>),
  // Esfuerzo: un cuentarrevoluciones. El «1» a medio tono, las letras llenas y el
  // arco con degradado de lleno a medio tono.
  effort: (c, gradId) => (<>
    <Path d="M18.8289 28.0218L17.3267 37.0703H15.1441L16.3105 30.063H16.2575L14.0263 31.3001L14.3356 29.4091L16.8009 28.0218H18.8289Z" fill={c} fillOpacity={0.5} />
    <Path d="M19.3447 37.0703L20.8469 28.0218H24.5848C25.2622 28.0218 25.8277 28.144 26.2814 28.3885C26.735 28.63 27.0575 28.9776 27.2489 29.4312C27.4404 29.8818 27.4846 30.4165 27.3815 31.035C27.2813 31.6595 27.0575 32.1911 26.7099 32.63C26.3653 33.0659 25.9205 33.3988 25.3756 33.6285C24.8336 33.8583 24.218 33.9731 23.5288 33.9731H21.165L21.4566 32.25H23.4139C23.7409 32.25 24.0236 32.2073 24.2622 32.1219C24.5008 32.0335 24.6908 31.901 24.8322 31.7243C24.9765 31.5446 25.0722 31.3148 25.1194 31.035C25.1635 30.7552 25.1429 30.524 25.0575 30.3413C24.975 30.1558 24.8292 30.0173 24.6201 29.926C24.4139 29.8318 24.1488 29.7846 23.8248 29.7846H22.7468L21.5318 37.0703H19.3447ZM25.1238 32.9348L26.6922 37.0703H24.3064L22.7865 32.9348H25.1238ZM29.1819 28.0218H31.8903L33.26 33.6241H33.366L36.5913 28.0218H39.2997L37.7975 37.0703H35.6679L36.5913 31.5122H36.5162L33.4323 37.0129H32.0759L30.8211 31.4812H30.746L29.8093 37.0703H27.6797L29.1819 28.0218Z" fill={c} />
    <Path d="M26.1045 13.4062C29.3486 13.2771 32.5644 13.8851 35.5625 15.083L33.5898 18.374C31.2438 17.394 28.7105 16.8402 26.1045 16.8281C15.9611 16.384 6.064 24.3311 4.36621 34.6895C4.16188 35.8226 4.04639 36.9751 4.02051 38.1348C4.01507 38.3767 3.91197 38.6092 3.7373 38.7803C3.56225 38.9515 3.32905 39.0478 3.08691 39.0479C2.84479 39.0479 2.61159 38.9514 2.43652 38.7803C2.26186 38.6092 2.15876 38.3767 2.15332 38.1348C2.12736 36.8794 2.19861 35.6218 2.36816 34.376C3.71232 23.0058 14.2979 13.4282 26.1045 13.4062ZM50.374 30.6748C50.7438 31.8043 51.031 32.9675 51.2227 34.1582C51.4196 35.2695 51.5404 36.3954 51.5889 37.5264L46.6367 37.5166C46.632 36.6434 46.5746 35.7719 46.46 34.9072C46.3502 33.9459 46.1616 32.9988 45.9033 32.0723L50.374 30.6748ZM37.4111 15.9092C42.6323 18.5002 47.0155 22.9099 49.4482 28.291L45.0557 29.6631C43.2072 25.3445 39.8083 21.6555 35.625 19.3555L37.4111 15.9092Z" fill={`url(#${gradId})`} />
    <Defs>
      <LinearGradient id={gradId} x1="44.215" y1="18.8489" x2="21.1664" y2="26.3368" gradientUnits="userSpaceOnUse">
        <Stop stopColor={c} />
        <Stop offset="0.5" stopColor={c} stopOpacity={0.5} />
      </LinearGradient>
    </Defs>
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

/** El cuadro con la tendencia que va delante de «Progresión» (`titleIcon` de DragSheet). */
export function ProgressionTitleIcon() {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.titleIcon}>
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path d="M3 17l6-6 4 4 8-8M15 7h6v6" {...line(th.colors.accent)} />
      </Svg>
    </View>
  );
}

export default function ProgressionSheet({ name, prog, ctx, minReps, maxReps, minTime, maxTime, onPatch }) {
  const styles = useThemedStyles(makeStyles);
  const th     = useTheme();
  const { t }                  = useTranslation();
  const { label: weightLabel } = useWeightUnit();
  const [advOpen, setAdvOpen]       = useState(false);
  const [effortWhy, setEffortWhy]   = useState(false);
  // Id del degradado del icono de Esfuerzo (sin los «:» de useId, que url(#…) no admite en web).
  const gradUid = `eff${useId().replace(/:/g, '')}`;
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
  // La tarjeta tocada se rellena al momento: el cambio del formulario repinta
  // todo el editor y va en una transición, sin frenar el toque ni la animación.
  const [picked, setPicked] = useState(tile);
  const [seen, setSeen]     = useState(tile);
  if (seen !== tile) { setSeen(tile); setPicked(tile); }
  const pickTile = (id) => {
    if (id === 'effort' && effortBlocked(ctx)) { setEffortWhy(true); return; }
    setEffortWhy(false);
    setPicked(id);
    startTransition(() => onPatch(id === 'effort' ? { up: 'weight', how: 'effort' } : { up: id, how: 'rules' }));
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
        <View style={styles.exercise}>
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
                  on={id === picked}
                  disabled={id === 'effort' && effortBlocked(ctx)}
                  onPress={() => pickTile(id)}
                  style={styles.tile}
                  bg={th.colors.surface}
                  faceStyle={styles.tileFace}
                  a11yLabel={t(`exerciseEditor.sheet.tiles.${icon}`)}
                  face={(on) => (
                    <>
                      <Svg width={(TILE_BOX[icon] ?? DEFAULT_BOX).w} height={24} viewBox={(TILE_BOX[icon] ?? DEFAULT_BOX).vb}>
                        {TILE_ICON[icon](
                          on ? th.colors.onAccent : id === 'none' ? th.colors.mutedLight : th.colors.accent,
                          `${gradUid}-${on ? 'on' : 'off'}`,
                        )}
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
  titleIcon: {
    width: 28, height: 28, borderRadius: th.radius.sm, backgroundColor: th.tint.accent10,
    alignItems: 'center', justifyContent: 'center',
  },
  // La ficha del ejercicio: tarjeta `surface` con su nombre y su volumen debajo.
  exercise: {
    backgroundColor: th.colors.surface, borderRadius: th.radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.xs2,
  },
  name: { ...textStyles.bodyStrong, color: th.colors.text },
  meta: { ...textStyles.label, color: th.colors.mutedLight, fontVariant: ['tabular-nums'] },
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
