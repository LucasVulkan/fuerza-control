/**
 * Filas y controles compartidos por los editores de ejercicio (config en
 * sesión y alta en librería): extraídos de `ExerciseEditorInline.jsx` para que
 * el alta de un ejercicio nuevo (`CustomExerciseScreen`) use exactamente los
 * mismos elementos de UI en vez de reimplementarlos.
 */
import { useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, interpolateColor, Easing,
} from 'react-native-reanimated';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { ArrowIcon } from './EditorIcons';

// Chevron de fila navegable: la caja de Figma mide 14 pero el glifo real son
// 6.46×10.77 (regla 4 de UI-MIGRATION: caja de icono ≠ icono visible).
const ROW_CHEVRON = 10.77;
// Gris suelto del chevron de "Tempo" en Figma — el mismo literal que ya usa el
// chevron de sesión futura en HomeView.
export const CHEVRON_GREY = '#d9d9d9';

// ─── Switch (Icons / Switch, `176:1907`) ──────────────────────────────────────
// Figma da 26×14.18 / pulgar 11.82; en QA se pidió más grande, así que se
// escala el conjunto ×1.3 manteniendo las proporciones del mock. Figma solo
// dibuja el estado ON (carril accent, pulgar negro); el OFF es decisión
// nuestra: surface2 + pulgar mutedLight, para que se lea apagado sin
// introducir un color nuevo.
const SW_SCALE = 1.3;
const TRACK_W  = 26 * SW_SCALE;
const TRACK_H  = 14.182 * SW_SCALE;
const THUMB    = 11.818 * SW_SCALE;
const SW_INSET = 1.18 * SW_SCALE;
const THUMB_X  = [SW_INSET, TRACK_W - THUMB - SW_INSET];
// Alto mínimo de las filas de opciones: el mismo para todas, lo marca la caja
// del switch (QA: la fila de Tempo se veía más fina que las demás).
export const OPT_ROW_H = TRACK_W + spacing.sm * 2;

export function Switch({ value }) {
  const th = useTheme();
  const p  = useSharedValue(value ? 1 : 0);

  // Los worklets solo pueden capturar valores serializables — `th` lleva
  // funciones dentro, así que se extraen los colores a strings sueltos.
  const trackColors = [th.colors.surface2,   th.colors.accent];
  const thumbColors = [th.colors.mutedLight, th.colors.onAccent];

  useEffect(() => {
    p.value = withTiming(value ? 1 : 0, { duration: 180, easing: Easing.inOut(Easing.ease) });
  }, [value, p]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], trackColors),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], thumbColors),
    transform:       [{ translateX: interpolate(p.value, [0, 1], THUMB_X) }],
  }));

  return (
    <View style={swStyles.box}>
      <Animated.View style={[swStyles.track, trackStyle]}>
        <Animated.View style={[swStyles.thumb, thumbStyle]} />
      </Animated.View>
    </View>
  );
}

const swStyles = StyleSheet.create({
  box:   { width: TRACK_W, height: TRACK_W, alignItems: 'center', justifyContent: 'center' },
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, justifyContent: 'center' },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, position: 'absolute' },
});

// ─── Filas de la lista agrupada (Option blocks / Opciones basicas) ────────────

export function OptionRow({ label, hint, onPress, right }) {
  const styles = useThemedStyles(makeStyles);
  const Wrap   = onPress ? TouchableOpacity : View;
  const press  = onPress ? { onPress, activeOpacity: 0.7 } : null;
  return (
    <Wrap style={styles.optRow} {...press}>
      <View style={styles.optRowMeta}>
        <Text style={styles.optRowLabel}>{label}</Text>
        {!!hint && <Text style={styles.optRowHint}>{hint}</Text>}
      </View>
      {right}
    </Wrap>
  );
}

export function ToggleRow({ label, hint, value, onChange }) {
  return (
    <OptionRow
      label={label}
      hint={value ? hint : undefined}
      onPress={() => onChange(!value)}
      right={<Switch value={value} />}
    />
  );
}

// Fila navegable "Progresion" (`163:1212`): icono opcional, título, subtítulo y
// chevron. Se reutiliza para Progresión y Calentamiento (editor) y Tags/
// Progresión (alta de ejercicio).
export function NavRow({ icon, title, subtitle, onPress }) {
  const styles = useThemedStyles(makeStyles);
  const th     = useTheme();
  return (
    <TouchableOpacity style={styles.navRow} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <View style={styles.navRowMeta}>
        <Text style={styles.navRowTitle}>{title}</Text>
        <Text style={styles.navRowSub}>{subtitle}</Text>
      </View>
      <ArrowIcon size={ROW_CHEVRON} color={th.colors.accent} />
    </TouchableOpacity>
  );
}

// Última fila de un grupo de opciones: label + textarea. Usada por la nota del
// entrenador (editor) y las notas de ejecución (alta de ejercicio).
export function NoteRow({ label, value, onChangeText, placeholder, hint, maxLength = 280 }) {
  const styles = useThemedStyles(makeStyles);
  const th     = useTheme();
  return (
    <View style={styles.noteRow}>
      <Text style={styles.optRowLabel}>{label}</Text>
      <TextInput
        style={styles.noteInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={th.colors.mutedLight}
        multiline
        maxLength={maxLength}
      />
      {!!hint && <Text style={styles.optRowHint}>{hint}</Text>}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // ── Fila navegable (Progresion, 163:1212) ─────────────────────────────────
  navRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  navRowMeta:  { flex: 1, minWidth: 0, gap: spacing.xs },
  navRowTitle: { ...textStyles.cardType, color: th.colors.text },
  navRowSub:   { ...textStyles.tag,      color: th.colors.mutedLight },

  // ── Lista agrupada de opciones (176:1902) ─────────────────────────────────
  optRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               spacing.md,
    minHeight:         OPT_ROW_H,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.xxs ?? 2,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
  },
  optRowMeta:  { flex: 1, minWidth: 0, gap: spacing.xs },
  optRowLabel: { ...textStyles.cardType, color: th.colors.text },
  optRowHint:  { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 14 },

  // Última fila del grupo: la nota, con su textarea sobre `color/workout-card`.
  noteRow: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.xxs ?? 2,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    gap:               spacing.xs,
  },
  noteInput: {
    height:            42,
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.sm,
    ...textStyles.tag,
    color:             th.colors.text,
    textAlignVertical: 'top',
  },
});
