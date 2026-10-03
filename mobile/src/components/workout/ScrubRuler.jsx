/**
 * ScrubRuler — la capa que cubre la fila mientras se arrastra una casilla de KG,
 * reps o RPE (U10-01, docs/specs/U10-todo-pesa.md §2.2): crece de la casilla a la
 * fila, enseña la regla con su marca lima y, por encima de la fila, la burbuja
 * con el valor.
 *
 * Sin estado propio de gesto: `SetRow` le pasa el valor que va tomando (`value`)
 * y `closing` cuando se ha soltado; ella solo anima y pinta.
 *
 *  - Capa: `left`/`width` salen de UNA sola shared value (`prog`, 0 = casilla,
 *    1 = fila), así ida y vuelta son la misma animación. Las marcas viven en
 *    coordenadas de la FILA; como la capa se mueve, el contenido lleva el
 *    desplazamiento contrario y no se arrastra con ella.
 *  - Rayas cortas y anchas de partida (lima) y objetivo (azul del entrenador /
 *    blanco); indicadores lima de borde (peso y reps); en modo cancelar la capa
 *    baja a 0,4 y la burbuja enseña «Cancelar» (U10-10).
 *  - Burbuja: ancho FIJO por campo (la forma más larga: «999.5 kg»). La cifra de
 *    las unidades queda siempre en la misma x: la parte entera va en una caja de
 *    ancho fijo alineada a la derecha (crece hacia la izquierda) y el decimal con
 *    la unidad cuelgan de una caja de ancho fijo alineada a la izquierda.
 */

import { Fragment, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import { textStyles, borders } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { GRID } from './grid';
import Chevron from './Chevron';
import { scrubXOf, scrubTicks, scrubDiffText } from '../../utils/scrubScale';

// Mismo tiempo en las dos direcciones y la curva de «todo pesa» (§1.1).
export const SCRUB_MS = 180;
const EASE   = Easing.bezier(0.35, 0, 0.15, 1);
const TIMING = { duration: SCRUB_MS, easing: EASE };
// Al soltar, la capa se desvanece más deprisa de lo que encoge: el número nuevo
// de la casilla se ve en cuanto empieza a encoger, no cuando termina.
const FADE_OUT = { duration: 120, easing: EASE };

// Burbuja: itemTitle (16/900), como la maqueta. Los anchos salen del cuerpo en em
// (cifra tabular ≈ .66, punto/espacio ≈ .3, letra ≈ .7, VERSAL ≈ .76) con holgura;
// el texto no escala con la fuente del sistema (`allowFontScaling={false}`) para
// que el cálculo valga.
const BUBBLE_FS  = textStyles.itemTitle.fontSize;
// Dos líneas: el valor (itemTitle) y debajo la diferencia con la partida
// (labelStrong: en micro y apagada apenas se leía sobre lima).
const BUBBLE_H   = 42;
const LINE1_H    = 20;
const LINE2_H    = 14;
const BUBBLE_PAD = 12;
const BUBBLE_GAP = 6;
const EM = { digit: 0.66, dot: 0.3, space: 0.3, letter: 0.7, caps: 0.76 };
const em = (n) => Math.ceil(n * BUBBLE_FS) + 4;   // holgura: si se queda corto, el número se corta con «…»

const MARK_MAJOR = { top: 28, height: 12, width: 1.5 };
const MARK_MINOR = { top: 33, height: 6,  width: 1 };
// Paso sin marca (los 0,5 kg): un punto a media altura de la marca mediana.
const MARK_DOT   = { top: 35, height: 2,  width: 2 };
const LABEL_W = 34;
// Marcas de partida y objetivo: pastillas en la franja baja de la capa, bajo las
// rayas (que acaban en y = 40).
// Partida y objetivo: rayas cortas, a la altura de la raya pequeña (33-40), de
// color pleno y más anchas que una raya normal para que siempre se vean. La
// marca, alta y encima, sigue siendo «dónde estás».
const FLAG = { top: 33, height: 7, width: 3 };
const FLAG_OFF_ALPHA = 0.5;    // fuera de la regla: pegada al borde, a media opacidad
const CANCEL_DIM = 0.4;        // modo cancelar: la regla se apaga
const CHEVRON_SIZE = 12;
const CHEVRON_INSET = 5;

const DEC_SEP = '.';

// «102.5» → ['102', '.5'] · «102» → ['102', ''] (mismo separador que la casilla).
function splitValue(value) {
  const s = String(value);
  const i = s.indexOf('.');
  return i < 0 ? [s, ''] : [s.slice(0, i), DEC_SEP + s.slice(i + 1)];
}

export default function ScrubRuler({
  field, ruler, value, cell, rowWidth, closing,
  initial,      // valor de la casilla al empezar: la partida
  hasValue,     // la casilla tenía valor escrito (si no, partida = objetivo y solo se pinta el objetivo)
  prevValue,    // valor fantasma (progresión / plan / entrenador): el objetivo, o null
  prevSource,   // 'coach' → objetivo en azul
  edge = 0,     // −1..1: intensidad del indicador de borde (negativa = izquierdo)
  cancel = false,
}) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const { label: weightLabel } = useWeightUnit();

  const prog  = useSharedValue(0);
  const alpha = useSharedValue(1);
  const dim   = useSharedValue(1);
  useEffect(() => {
    prog.value  = withTiming(closing ? 0 : 1, TIMING);
    if (closing) alpha.value = withTiming(0, FADE_OUT);
  }, [closing, prog, alpha]);
  useEffect(() => {
    dim.value = withTiming(cancel ? CANCEL_DIM : 1, FADE_OUT);
  }, [cancel, dim]);

  // La marca se pinta en la x del valor (ajustada al paso): o sea, bajo el dedo.
  const markerX = scrubXOf(ruler, value);
  const ticks   = scrubTicks(ruler);

  // Partida y objetivo: si caen fuera de la regla, pegadas al borde por el que quedan.
  const flagAt = (v) => {
    const off = v < ruler.min - 1e-9 || v > ruler.max + 1e-9;
    return { x: scrubXOf(ruler, Math.min(ruler.max, Math.max(ruler.min, v))), off };
  };
  const hasTarget = prevValue != null;
  const showStart  = hasValue;
  const showTarget = hasTarget && (!hasValue || prevValue !== initial);
  // Partida en lima; objetivo en azul si es del entrenador, en blanco si es del plan
  // o de la última vez (el lima ya es de la partida y de la marca).
  const targetColor = prevSource === 'coach' ? th.colors.blue : th.colors.text;

  // ── Burbuja ────────────────────────────────────────────────────────────────
  const [intStr, decStr] = splitValue(value);
  const unit   = field === 'weight' ? weightLabel : field === 'reps' ? t('workout.reps').toLowerCase() : '';
  const prefix = field === 'rpe' ? 'RPE ' : '';
  // En libras la casilla también puede llevar .5 (toDisplay redondea a 0,5).
  const hasDecSlot = field === 'weight';
  const leftW  = em(prefix.length * EM.caps + 3 * EM.digit);
  const rightW = em(
    (hasDecSlot ? EM.dot + EM.digit : 0)
    + (unit ? EM.space + unit.length * EM.letter : 0),
  );
  const bubbleW = leftW + rightW + 2 * BUBBLE_PAD;
  // Segunda línea: diferencia con la partida («+2.5», «−1»), pivotando en las
  // unidades como el valor; en modo cancelar, «Cancelar». Con 0 va vacía pero
  // la burbuja reserva su alto.
  const [dInt, dDec] = splitValue(scrubDiffText(value, initial));
  const diffUnit = unit ? ` ${unit}` : '';
  const bubbleLeft = Math.max(0, Math.min(rowWidth - bubbleW, markerX - bubbleW / 2));

  const cx = cell.x;
  const cw = cell.width;
  const layerStyle = useAnimatedStyle(() => ({
    left:  cx * (1 - prog.value),
    width: cw + (rowWidth - cw) * prog.value,
    opacity: alpha.value * dim.value,
  }));
  // El contenido no se mueve con la capa: desplazamiento contrario (y el borde).
  const innerStyle = useAnimatedStyle(() => ({
    left: -(cx * (1 - prog.value)) - borders.thin,
  }));
  const bubbleStyle = useAnimatedStyle(() => ({ opacity: prog.value }));

  return (
    <View pointerEvents="none" style={styles.root}>
      <Animated.View style={[styles.layer, layerStyle]}>
        <Animated.View style={[styles.inner, { width: rowWidth }, innerStyle]}>
          {ticks.map((tk) => {
            const x = scrubXOf(ruler, tk.value);
            const m = tk.major ? MARK_MAJOR : tk.dot ? MARK_DOT : MARK_MINOR;
            return (
              <Fragment key={tk.value}>
                <View
                  style={[
                    styles.mark,
                    { left: x - m.width / 2, top: m.top, height: m.height, width: m.width },
                    tk.dot && styles.markDot,
                  ]}
                />
                {tk.numbered ? (
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[
                      styles.num,
                      tk.bright && styles.numBright,
                      { left: x - LABEL_W / 2 },
                      // Solo se ilumina el número que ES el valor, nunca el más cercano.
                      Math.abs(tk.value - value) < 1e-6 && styles.numNear,
                    ]}
                  >
                    {String(tk.value)}
                  </Text>
                ) : null}
              </Fragment>
            );
          })}
          {showStart ? (
            <View style={[styles.flag, { left: flagAt(initial).x - FLAG.width / 2, backgroundColor: th.colors.accent }, flagAt(initial).off && styles.flagOff]} />
          ) : null}
          {showTarget ? (
            <View style={[styles.flag, { left: flagAt(prevValue).x - FLAG.width / 2, backgroundColor: targetColor }, flagAt(prevValue).off && styles.flagOff]} />
          ) : null}
          <View style={[styles.marker, { left: markerX - 1 }]} />
          {/* Bordes que desplazan (peso y reps): aparecen según se acerca el dedo. */}
          {edge < 0 ? (
            <View style={[styles.edge, { left: CHEVRON_INSET, opacity: -edge }]}>
              <Chevron direction="left" size={CHEVRON_SIZE} color={th.colors.accent} />
            </View>
          ) : null}
          {edge > 0 ? (
            <View style={[styles.edge, { right: CHEVRON_INSET, opacity: edge }]}>
              <Chevron direction="right" size={CHEVRON_SIZE} color={th.colors.accent} />
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[styles.bubble, { width: bubbleW, left: bubbleLeft }, bubbleStyle]}
      >
        <View style={styles.bubbleLine1}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.bubbleText, styles.bubbleLeftText, { width: leftW }]}>
            {prefix + intStr}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.bubbleText, styles.bubbleRightText, { width: rightW }]}>
            {decStr + (unit ? ` ${unit}` : '')}
          </Text>
        </View>
        <View style={styles.bubbleLine2}>
          {cancel ? (
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.bubbleDiff, styles.bubbleCancel, { width: leftW + rightW }]}>
              {t('workout.scrubCancel')}
            </Text>
          ) : (
            <>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.bubbleDiff, styles.bubbleLeftText, { width: leftW }]}>
                {dInt}
              </Text>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.bubbleDiff, styles.bubbleRightText, { width: rightW }]}>
                {dInt ? dDec + diffUnit : ''}
              </Text>
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // Cubre la fila entera; sin `overflow` para que la burbuja asome por arriba.
  // zIndex por encima de las casillas hermanas (la fila sube el suyo sobre las
  // filas vecinas, ver SetRow).
  root: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10,
  },
  layer: {
    position:        'absolute',
    top: 0,
    height:          GRID.CELL_H,
    overflow:        'hidden',
    backgroundColor: th.colors.bg,
    borderWidth:     borders.thin,
    borderColor:     th.colors.accent,
    borderRadius:    GRID.RADIUS,
  },
  inner: {
    position: 'absolute',
    top:      -borders.thin,
    height:   GRID.CELL_H,
  },
  // Rayas largas y cortas del mismo color: la longitud ya las distingue.
  mark:    { position: 'absolute', backgroundColor: th.colors.mutedLight },
  markDot: { borderRadius: 1, backgroundColor: th.colors.muted },
  // Números todos iguales (labelStrong) y a la misma altura; en el peso alternan
  // blanco y gris para que cada 2 kg se lean sin amontonarse. El que ES el valor,
  // en lima («lo que toca ahora», §1.1).
  num: {
    ...textStyles.labelStrong,
    position:    'absolute',
    top:         6,
    width:       LABEL_W,
    lineHeight:  16,
    textAlign:   'center',
    color:       th.colors.muted,
    fontVariant: ['tabular-nums'],
  },
  numBright: { color: th.colors.text },
  numNear:   { color: th.colors.accent },
  flag:    { position: 'absolute', top: FLAG.top, height: FLAG.height, width: FLAG.width, borderRadius: 1 },
  flagOff: { opacity: FLAG_OFF_ALPHA },
  edge:    { position: 'absolute', top: 0, height: GRID.CELL_H, justifyContent: 'center' },
  marker: {
    position:        'absolute',
    top:             3,
    width:           2,
    height:          38,
    borderRadius:    1,
    backgroundColor: th.colors.accent,
  },

  bubble: {
    position:        'absolute',
    top:             -(BUBBLE_H + BUBBLE_GAP),
    height:          BUBBLE_H,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: th.colors.accent,
    borderRadius:    9,
    zIndex:          10,
  },
  bubbleLine1: { flexDirection: 'row', height: LINE1_H, alignItems: 'center' },
  bubbleLine2: { flexDirection: 'row', height: LINE2_H, alignItems: 'center', justifyContent: 'center' },
  bubbleText: {
    ...textStyles.itemTitle,
    lineHeight:  LINE1_H,
    color:       th.colors.onAccent,
    fontVariant: ['tabular-nums'],
  },
  bubbleDiff: {
    ...textStyles.labelStrong,
    lineHeight:  LINE2_H,
    color:       th.colors.onAccent,
    fontVariant: ['tabular-nums'],
  },
  bubbleCancel: { textAlign: 'center' },
  bubbleLeftText:  { textAlign: 'right' },
  bubbleRightText: { textAlign: 'left' },
});
