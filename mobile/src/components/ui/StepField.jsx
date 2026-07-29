/**
 * StepField — contador ±, primitiva del rediseño FormaFit.
 *
 * Es el componente `Exercice editor elements` de Figma en sus dos
 * disposiciones: `Caja` (`142:1119`) y `Horizontal` (`160:1198`). Lo usan el
 * editor de ejercicio (grid de VOLUMEN y hojas) y la hoja de etapa del editor
 * de programa.
 */
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, textStyles } from '../../theme';
import { useThemedStyles } from '../../useTheme';

// ─── StepField (Exercice editor elements / Caja `142:1119` + Horizontal `160:1198`)
//
// Dos disposiciones del mismo componente, las dos de Figma:
//   · `Caja` (por defecto) — label centrado arriba y la fila ±/valor/± abajo.
//     Se usa en el grid 2×2 de VOLUMEN. Figma dibuja dos versiones dentro del
//     propio grid (alto 68 con los botones centrados / hug con los botones a
//     los bordes): es una inconsistencia del mock, aquí van todas iguales.
//   · `Horizontal` — label a la izquierda y los controles a la derecha. Es la
//     que usan las hojas, donde el alto vertical es caro.
// `dark` pinta la caja sobre `color/app` en vez de `surface`: dentro de una hoja
// el fondo YA es `surface` y las cajas se perdían contra él.
export const STEP_BTN = 34;   // caja del botón ± (Figma 30; subido en QA)
const STEP_GAP  = 26;   // separación entre controles en la variante Horizontal
const GLYPH_W   = 13;   // largo de la barra del − / +
const GLYPH_T   = 2;    // grosor
// Ancho FIJO de la zona del número: con y sin unidad tiene que medir lo mismo,
// o los botones ± bailan de una fila a otra (QA).
const VALUE_W   = 68;

export default function StepField({ label, value, onChange, min, max, step = 1, unit, horizontal, dark }) {
  const sf = useThemedStyles(makeSf);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const numVal   = Number(value);
  const decimals = step < 1;

  // Redondeo a 2 decimales: sumar 0.25 repetidamente arrastra error binario.
  const round  = (n) => Math.round(n * 100) / 100;
  const commit = (n) => onChange(round(Math.min(max, Math.max(min, n))));

  function handleChangeText(v) {
    setDraft(decimals ? v.replace(/[^0-9.]/g, '') : v.replace(/[^0-9]/g, ''));
  }
  function handleBlur() {
    const n = decimals ? parseFloat(draft) : parseInt(draft, 10);
    if (!isNaN(n)) { const c = round(Math.min(max, Math.max(min, n))); setDraft(String(c)); onChange(c); }
    else setDraft(String(value));
  }

  const controls = (
    <View style={horizontal ? sf.controlsHorizontal : sf.controls}>
      <TouchableOpacity style={sf.stepBtn} onPress={() => commit(numVal - step)} activeOpacity={0.6}>
        <View style={sf.glyphBar} />
      </TouchableOpacity>
      <View style={sf.valueWrap}>
        <TextInput
          style={sf.valueInput}
          keyboardType={decimals ? 'decimal-pad' : 'numeric'}
          value={draft}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          selectTextOnFocus
        />
        {!!unit && <Text style={sf.unit}>{unit}</Text>}
      </View>
      <TouchableOpacity style={sf.stepBtn} onPress={() => commit(numVal + step)} activeOpacity={0.6}>
        <View style={sf.glyphBar} />
        <View style={[sf.glyphBar, sf.glyphBarV]} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[horizontal ? sf.cardHorizontal : sf.card, dark && sf.cardDark]}>
      <Text style={horizontal ? sf.labelHorizontal : sf.label} numberOfLines={1}>{label}</Text>
      {controls}
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
  cardDark: { backgroundColor: th.colors.bg },

  label:           { ...textStyles.cardType, color: th.colors.text, textAlign: 'center' },
  labelHorizontal: { ...textStyles.cardType, color: th.colors.text, flexShrink: 1 },

  controls:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlsHorizontal: { flexDirection: 'row', alignItems: 'center', gap: STEP_GAP },

  stepBtn: {
    width:           STEP_BTN,
    height:          STEP_BTN,
    borderRadius:    th.radius.xs,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
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
    backgroundColor: th.tint.accent50,
  },
  glyphBarV: { transform: [{ rotate: '90deg' }] },

  valueWrap: {
    width:          VALUE_W,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.xs2,
  },
  valueInput: {
    width:              44,
    ...textStyles.cardTitle,
    color:              th.colors.text,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    backgroundColor:    'transparent',
    height:             STEP_BTN,
    paddingVertical:    0,
  },
  unit: { ...textStyles.subtitle, color: th.colors.mutedLight },
});
