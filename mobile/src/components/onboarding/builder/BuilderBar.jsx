/**
 * BuilderBar — la barra de fichas del constructor guiado (O03 §10.1): arriba de
 * cada paso, cuatro fichas que se encienden según se construye el programa —
 * «✓ 4 sesiones · ✓ Press banca · ✓ 3×8-12 · ✓ Por reglas». Es la sensación de
 * construir algo.
 *
 * Las dos primeras salen del programa que se está montando. Volumen y progresión
 * las enciende O03-03 con `answers.volDone` / `answers.progDone` y el texto de la
 * ficha en `answers.volLabel` / `answers.progLabel`; hasta entonces se quedan
 * apagadas con su nombre.
 *
 *   sessions   las sesiones elegidas aún sin crear (el primer paso); si no, las del programa
 */
import { View, StyleSheet } from 'react-native';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import { Text, MAX_FONT_SCALE } from '../../ui/Text';
import { CheckIcon } from '../../ui/EditorIcons';
import { spacing, textStyles } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { useFill, useInk } from '../flow/useFill';
import { useBuilderProgram, useExerciseDef, exerciseName } from './useBuilderProgram';

const NONE = {};
const K = 'onboardingFlow.builder.bar';

/** Una ficha: se enciende (lima suave y ✓) al mismo paso que el relleno del recorrido. */
function Chip({ label, on }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const p      = useFill(on);
  const bg     = useInk(p, th.colors.surface2, th.tint.accent10, 'backgroundColor');
  const ink    = useInk(p, th.colors.muted, th.colors.accent);
  const tick   = useAnimatedStyle(() => ({ opacity: p.get() }));
  return (
    <Reanimated.View style={[styles.chip, bg]} accessible accessibilityLabel={label} accessibilityState={{ checked: on }}>
      {on && <Reanimated.View style={tick}><CheckIcon size={11} color={th.colors.accent} /></Reanimated.View>}
      <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={[styles.chipTxt, ink]}>{label}</Reanimated.Text>
    </Reanimated.View>
  );
}

export default function BuilderBar({ sessions }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const a        = useStore((s) => s.onboardingFlow?.answers ?? NONE);
  const language = useStore((s) => s.profile.language ?? 'es');
  const clientName = useStore((s) => (a.builderCtx === 'trainer' ? s.clients[a.clientId]?.name ?? '' : ''));
  const { count, exId } = useBuilderProgram();
  const def = useExerciseDef(exId);

  const n = sessions ?? count;
  const chips = [
    [n ? t(`${K}.sessionsN`, { count: n }) : t(`${K}.sessions`), n > 0],
    [def ? exerciseName(def, language) : t(`${K}.exercise`), !!def],
    [a.volDone ? a.volLabel ?? t(`${K}.volume`) : t(`${K}.volume`), !!a.volDone],
    [a.progDone ? a.progLabel ?? t(`${K}.progression`) : t(`${K}.progression`), !!a.progDone],
  ];

  return (
    <View style={styles.bar}>
      <Text style={styles.title}>
        {a.builderCtx === 'trainer' ? t(`${K}.programOf`, { name: clientName }) : t(`${K}.program`)}
      </Text>
      <View style={styles.chips}>
        {chips.map(([label, on], i) => <Chip key={i} label={label} on={on} />)}
      </View>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  bar: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    paddingVertical:   spacing.md + 2,
    paddingHorizontal: spacing.lg - 1,
    marginBottom:    spacing.xl - 2,
  },
  title: { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm2 },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs2,
    maxWidth:          '100%',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md - 1,
    borderRadius:      th.radius.sm,
  },
  chipTxt: { ...textStyles.labelStrong, flexShrink: 1 },
});
