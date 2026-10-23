/**
 * StepField — contador ±, primitiva del rediseño FormaFit.
 *
 * Es el componente `Exercice editor elements` de Figma en sus dos
 * disposiciones: `Caja` (`142:1119`) y `Horizontal` (`160:1198`). Lo usan el
 * editor de ejercicio (grid de VOLUMEN y hojas) y la hoja de etapa del editor
 * de programa.
 */
import { useState, useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, withSequence } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text, TextInput } from './Text';
import { spacing, textStyles, withOpacity } from '../../theme';
import { useThemedStyles } from '../../useTheme';
import { useSwipeLock } from '../../hooks/useSiblingSwipe';

// ─── StepField (Exercice editor elements / Caja `142:1119` + Horizontal `160:1198`)
//
// Dos disposiciones del mismo componente, las dos de Figma:
//   · `Caja` (por defecto) — label centrado arriba y la fila ±/valor/± abajo.
//     Se usa en el grid 2×2 de VOLUMEN. Figma dibuja dos versiones dentro del
//     propio grid (alto 68 con los botones centrados / hug con los botones a
//     los bordes): es una inconsistencia del mock, aquí van todas iguales.
//   · `Horizontal` — label a la izquierda y los controles a la derecha. Es la
//     que usan las hojas, donde el alto vertical es caro.
// ─── Tres reglas del stepper, cerradas en QA. No romperlas. ──────────────────
//
// 1. **El fondo lo lleva el NÚMERO, no el ±.** La zona del valor va en una celda
//    `bg` —la misma que las celdas del grid de series del entreno (`SetRow`)— y
//    eso es lo que dice "esto se escribe". Los ± van sin caja, sostenidos por el
//    acento pleno. Antes era al revés (± en `surface2`, valor transparente) y
//    con ocho ajustes seguidos en la hoja del planificador el resultado eran
//    veinticuatro rectángulos idénticos. (Excepción en prueba, 23-oct-2026: en
//    la Caja el − y el + son franjas de todo el alto, pegadas a los bordes.)
// 2. **La celda del valor SIEMPRE cae sobre `surface`**, o desaparece. De ahí
//    `flat`: sin él la caja del control es `surface` y la celda contrasta; con
//    él la caja no se pinta y el contenedor es quien pone el `surface` (una
//    tarjeta de peldaño, una fila de etapa). Usar `flat` SOLO dentro de algo ya
//    pintado en `surface`. El cuerpo de una hoja es `bg` desde que `DragSheet`
//    unificó los modales: ahí va SIN `flat`.
// 3. **La caja llega hasta el título.** El label va SIEMPRE por la prop `label`,
//    nunca pintado fuera por el llamante: el fondo tiene que cubrir el título y
//    los controles, no solo los ±. Con `flat` lo cubre la tarjeta de dentro.
export const STEP_BTN = 34;   // caja del botón ± (Figma 30; subido en QA)
// Separación entre los ± y la celda del número, en la variante Horizontal. El
// QA cerró 14 cuando los ± tenían caja propia y el valor no; con la celda del
// valor pintada la referencia se invierte y los ± tienen que quedar pegados a
// ella o parecen dos glifos sueltos en mitad de la fila.
const STEP_GAP  = spacing.xs2;
const GLYPH_W   = 13;   // largo de la barra del − / +
const GLYPH_T   = 2;    // grosor — sin caja detrás, súbelo si se queda flojo en pantalla
// Ancho FIJO de la zona del número: con y sin unidad tiene que medir lo mismo,
// o los botones ± bailan de una fila a otra (QA). Subido de 68 a 76 y el input
// de dentro de 44 a 52 porque un valor de 4 caracteres ("6.75") se cortaba por
// la izquierda: el `width` del TextInput recorta, no crece.
const VALUE_W   = 76;
const VALUE_INPUT_W = 52;
// Holgura sobre el ancho medido del número. Un `TextInput` necesita más caja que
// el `Text` que mide lo mismo —el cursor pide su sitio y Android redondea el
// layout de la línea—, y quedarse corto no ajusta: recorta el primer dígito. Es
// el botón de calibrado de este campo: si vuelve a cortarse en algún dispositivo,
// sube esto antes de tocar nada más.
const MEASURE_SLACK = 6;
// Radio de la celda del valor. La celda de `SetRow` es 44×r11; a 34 de alto la
// proporción sale en 8. No es `radius.sm` a propósito: la celda tiene que
// leerse como la del entreno, no como una caja más de la hoja.
const VALUE_R   = 8;
// El cambio de cifra con ±: la vieja sale (fundido + 6 dp hacia donde va el
// número) y la nueva entra desde el otro lado. Pulsar seguido acumula y solo
// se escribe la última.
const NUM_OUT_MS = 90;
const NUM_IN_MS  = 160;
const NUM_SHIFT  = 6;

// Ancho de las franjas ± de la Caja: el área táctil de siempre y un poco más.
const STRIP_W = 40;

/**
 * Un ± que se nota al pulsar: un círculo lima tenue aparece de golpe bajo el
 * glifo y se apaga al soltar, y el glifo se encoge un poco. Sin caja en reposo
 * (regla 1). Con `side` es una FRANJA de todo el alto de la Caja, pegada a su
 * borde (`left` / `right`), y al pulsar se ilumina la franja entera.
 */
function StepButton({ onPress, plus, sf, side }) {
  const p = useSharedValue(0);
  const ring  = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ scale: 0.7 + 0.3 * p.get() }] }));
  const glyph = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.18 * p.get() }] }));
  const fill  = useAnimatedStyle(() => ({ opacity: p.get() }));
  return (
    <Pressable
      style={side ? [sf.strip, side === 'left' ? sf.stripLeft : sf.stripRight] : sf.stepBtn}
      onPress={onPress}
      onPressIn={() => p.set(1)}
      onPressOut={() => p.set(withTiming(0, { duration: 260 }))}
      hitSlop={side ? 0 : 4}
      accessibilityRole="button"
    >
      <Reanimated.View style={[side ? sf.stripPress : sf.stepRing, side ? fill : ring]} />
      <Reanimated.View style={[sf.glyphBox, glyph]}>
        <View style={sf.glyphBar} />
        {plus && <View style={[sf.glyphBar, sf.glyphBarV]} />}
      </Reanimated.View>
    </Pressable>
  );
}

export default function StepField({ label, value, onChange, min, max, step = 1, unit, horizontal, flat }) {
  const sf = useThemedStyles(makeSf);
  const swipeLock = useSwipeLock();   // un deslizamiento que empieza aquí no cambia de ejercicio (P16-04)
  const [draft, setDraft] = useState(String(value));
  // Ancho real del número, medido con un clon invisible: el TextInput no crece
  // con su contenido, así que con `width` fijo el número se centraba en SU caja
  // y la unidad quedaba colgando a la derecha, con el conjunto descentrado
  // dentro de la celda. Midiendo, el input se ajusta al número, la unidad queda
  // pegada y es el par "30 s" el que va centrado. Solo se mide si hay unidad.
  const [numW, setNumW] = useState(0);
  // Con el input ajustado al número, tocarlo es tocar dos dígitos: la celda
  // entera se vuelve el área táctil y enfoca.
  const inputRef = useRef(null);
  useEffect(() => { setDraft(String(value)); }, [value]);
  const numVal   = Number(value);
  const decimals = step < 1;

  // Redondeo a 2 decimales: sumar 0.25 repetidamente arrastra error binario.
  const round  = (n) => Math.round(n * 100) / 100;

  const numOp = useSharedValue(1);
  const numY  = useSharedValue(0);
  const numStyle = useAnimatedStyle(() => ({ opacity: numOp.get(), transform: [{ translateY: numY.get() }] }));
  const pendingRef = useRef(null);   // la cifra que se va a escribir mientras sale la vieja
  const stepTimer  = useRef(null);
  useEffect(() => () => clearTimeout(stepTimer.current), []);

  function stepBy(dir) {
    const from = pendingRef.current ?? numVal;
    const to   = round(Math.min(max, Math.max(min, from + dir * step)));
    if (to === from) return;   // en el tope no pasa nada: ni vibra ni se mueve
    Haptics.selectionAsync().catch(() => {});
    pendingRef.current = to;
    numOp.set(withTiming(0, { duration: NUM_OUT_MS }));
    numY.set(withTiming(-dir * NUM_SHIFT, { duration: NUM_OUT_MS }));
    clearTimeout(stepTimer.current);
    stepTimer.current = setTimeout(() => {
      pendingRef.current = null;
      setDraft(String(to));
      onChange(to);
      numOp.set(withTiming(1, { duration: NUM_IN_MS }));
      numY.set(withSequence(withTiming(dir * NUM_SHIFT, { duration: 0 }), withTiming(0, { duration: NUM_IN_MS })));
    }, NUM_OUT_MS);
  }

  // Los campos con mínimo negativo (los deltas del planificador: −3 reps,
  // −1 serie) admiten el signo, y solo al principio. Sin esto el teclado dejaba
  // escribir "3" en un campo cuyo máximo es 0 y el valor se clampaba a 0.
  const signed = min < 0;
  function handleChangeText(v) {
    const body = (decimals ? v.replace(/[^0-9.]/g, '') : v.replace(/[^0-9]/g, ''));
    setDraft(signed && v.trim().startsWith('-') ? `-${body}` : body);
  }
  function handleBlur() {
    const n = decimals ? parseFloat(draft) : parseInt(draft, 10);
    if (!isNaN(n)) { const c = round(Math.min(max, Math.max(min, n))); setDraft(String(c)); onChange(c); }
    else setDraft(String(value));
  }

  const valueCell = (
      <Pressable style={sf.valueWrap} onPress={() => inputRef.current?.focus()}>
        <Reanimated.View style={[sf.valueRow, numStyle]}>
        {!!unit && (
          <Text
            style={[sf.valueText, sf.valueMirror]}
            numberOfLines={1}
            onLayout={(e) => setNumW(e.nativeEvent.layout.width)}
          >
            {draft || '0'}
          </Text>
        )}
        <TextInput
          ref={inputRef}
          style={[sf.valueText, sf.valueInput,
            !!unit && numW > 0 && { width: Math.min(numW + MEASURE_SLACK, VALUE_INPUT_W) }]}
          keyboardType={decimals ? 'decimal-pad' : (signed ? 'numbers-and-punctuation' : 'numeric')}
          value={draft}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          selectTextOnFocus
        />
        {!!unit && <Text style={sf.unit}>{unit}</Text>}
        </Reanimated.View>
      </Pressable>
  );

  if (horizontal) {
    return (
      <View {...swipeLock} style={[sf.cardHorizontal, flat && sf.flatHorizontal]}>
        <Text style={sf.labelHorizontal} numberOfLines={1}>{label}</Text>
        <View style={sf.controlsHorizontal}>
          <StepButton sf={sf} onPress={() => stepBy(-1)} />
          {valueCell}
          <StepButton sf={sf} plus onPress={() => stepBy(1)} />
        </View>
      </View>
    );
  }

  // Caja: rótulo y cifra en el centro; el − y el + son franjas de todo el alto
  // pegadas a los bordes (prueba del 23-oct-2026).
  return (
    <View {...swipeLock} style={[sf.card, flat && sf.flat]}>
      <StepButton sf={sf} side="left" onPress={() => stepBy(-1)} />
      {/* ponytail: con las franjas el centro mide ~80 dp en un móvil de 360; un
          rótulo largo («Tiempo de inicio») encoge hasta un 75 %. Si no basta,
          franjas más estrechas o el rótulo en dos líneas con la caja más alta. */}
      <Text style={[sf.label, sf.labelBox]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</Text>
      {valueCell}
      <StepButton sf={sf} side="right" plus onPress={() => stepBy(1)} />
    </View>
  );
}

const makeSf = (th) => StyleSheet.create({
  card: {
    flex:            1,
    height:          82,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
    // Las franjas ± van fuera del flujo: el centro deja su ancho a cada lado.
    paddingHorizontal: STRIP_W,
    alignItems:      'center',
    justifyContent:  'space-between',
    overflow:        'hidden',
  },
  // Horizontal (160:1198): px `space/md`, py `space/sm`.
  cardHorizontal: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               spacing.md,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  // `flat`: la caja no se pinta y el contenedor pone el `surface` que la celda
  // del valor necesita debajo. Sin inset horizontal, para que la fila ocupe todo
  // el ancho de la tarjeta que la contiene.
  flat:           { backgroundColor: 'transparent' },
  flatHorizontal: {
    backgroundColor:   'transparent',
    paddingHorizontal: 0,
    paddingVertical:   spacing.xs2,
  },

  // Las dos variantes al mismo cuerpo. Iban a 12 y se leían como metadato; se
  // probó la caja del grid a 16 —el título de tarjeta de `NavRow`— y el usuario
  // prefirió las dos a 14: un ± con su rótulo es una fila de opción con botones,
  // no una tarjeta, y a 16 el rótulo pesaba más que el número que hay debajo.
  label:           { ...textStyles.bodyStrong, color: th.colors.text, textAlign: 'center' },
  labelHorizontal: { ...textStyles.bodyStrong, color: th.colors.text, flexShrink: 1 },
  // En la Caja el rótulo puede asomar un poco sobre las franjas.
  labelBox:        { alignSelf: 'stretch', marginHorizontal: -spacing.sm },

  controlsHorizontal: { flexDirection: 'row', alignItems: 'center', gap: STEP_GAP },

  // Sin fondo (regla 1) pero conservando los 34×34 de área táctil.
  stepBtn: {
    width:          STEP_BTN,
    height:         STEP_BTN,
    alignItems:     'center',
    justifyContent: 'center',
  },
  // El − y el + van dibujados con Views y con las coordenadas puestas a mano
  // (no con glifos ni con centrado automático): así quedan clavados en el
  // centro de la caja sin depender de las métricas de la fuente. El + son dos
  // barras iguales, una girada 90° sobre su propio centro.
  glyphBar: {
    position:        'absolute',
    width:           GLYPH_W,
    height:          GLYPH_T,
    left:            (STEP_BTN - GLYPH_W) / 2,
    top:             (STEP_BTN - GLYPH_T) / 2,
    borderRadius:    GLYPH_T / 2,
    backgroundColor: th.colors.accent,
  },
  glyphBarV: { transform: [{ rotate: '90deg' }] },
  // Franjas ± de la Caja: todo el alto, pegadas al borde; la tarjeta (con
  // `overflow: hidden`) les redondea las esquinas de fuera.
  strip: {
    position:        'absolute',
    top:             0,
    bottom:          0,
    width:           STRIP_W,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stripLeft:  { left: 0 },
  stripRight: { right: 0 },
  // La franja entera se ilumina al pulsar.
  stripPress: { ...StyleSheet.absoluteFillObject, backgroundColor: withOpacity(th.colors.accent, 0.14) },
  // La caja de 34 donde van dibujados el − y el + (sus barras se colocan a mano
  // dentro de ella).
  glyphBox: { width: STEP_BTN, height: STEP_BTN },
  // El círculo de la pulsación: solo existe mientras se pulsa.
  stepRing: {
    position:        'absolute',
    width:           STEP_BTN,
    height:          STEP_BTN,
    borderRadius:    STEP_BTN / 2,
    backgroundColor: withOpacity(th.colors.accent, 0.18),
  },

  valueWrap: {
    width:           VALUE_W,
    height:          STEP_BTN,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: th.colors.bg,
    borderRadius:    VALUE_R,
  },
  // Número + unidad, lo que se mueve al cambiar de cifra (la celda se queda).
  // La separación que se VE entre el número y la unidad es este gap más medio
  // `MEASURE_SLACK`: la holgura del input va centrada, así que se reparte a los
  // dos lados. A 4 quedaba suelta; con 2 sale en los ~5 del diseño.
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  // La tipografía va aparte porque la comparten el input y el clon que lo mide:
  // si divergen, el ancho medido no es el que se pinta.
  valueText: {
    ...textStyles.itemTitle,
    color:              th.colors.text,
    textAlign:          'center',
    includeFontPadding: false,
  },
  valueInput: {
    width:              VALUE_INPUT_W,
    textAlignVertical:  'center',
    backgroundColor:    'transparent',
    height:             STEP_BTN,
    paddingVertical:    0,
    // En Android el EditText trae padding horizontal propio, que `backgroundColor:
    // transparent` no quita: con la caja ajustada al número se lo comía por los
    // lados. Va a 0 explícitamente.
    paddingHorizontal:  0,
  },
  // Fuera del flujo y transparente: solo está para que `onLayout` dé el ancho.
  valueMirror: { position: 'absolute', opacity: 0 },
  unit: { ...textStyles.label, color: th.colors.mutedLight },
});
