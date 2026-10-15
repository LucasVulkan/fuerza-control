/**
 * FlowHeader — la cabecera fija del recorrido de entrada (O03 §3.1.2): atrás ·
 * nombre del tramo en lima con «· 2 de 4» · Saltar, y debajo la barra de cuatro
 * tramos. Siempre igual; la barra avanza con animación desde donde estaba.
 *
 * Vive fuera de la pantalla que cambia (la transición no la mueve) y NO se
 * desmonta en la bienvenida, donde se esconde: si se montara al pasar a Unidades,
 * la barra nacería ya llena y no se vería crecer.
 *
 *   hidden    la bienvenida: sin cabecera, pero montada
 *   name      el tramo («Ajustes»); `suffix`: «· 1 de 4»
 *   fills     los cuatro tramos, de 0 a 1; `showBar: false` la deja sin pintar
 *   canBack / onBack · canSkip / onSkip
 */
import { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

import { Text } from '../../ui/Text';
import { ArrowIcon } from '../../ui/EditorIcons';
import { spacing, textStyles } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';

const BAR_MS = 500;   // lo que tarda la barra en llegar a su sitio

function Segment({ value }) {
  const styles = useThemedStyles(makeStyles);
  const w = useSharedValue(value);
  useEffect(() => {
    w.set(withTiming(value, { duration: BAR_MS, easing: Easing.out(Easing.cubic) }));
  }, [value, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.get() * 100}%` }));
  return (
    <View style={styles.seg}>
      <Reanimated.View style={[styles.segFill, fill]} />
    </View>
  );
}

export default function FlowHeader({
  hidden = false, name, suffix, fills, showBar = true,
  canBack, onBack, backLabel, canSkip, onSkip, skipLabel,
}) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.top, hidden && styles.hidden]} pointerEvents={hidden ? 'none' : 'auto'}>
      <View style={styles.row}>
        <View style={styles.side}>
          {canBack && (
            <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel={backLabel} hitSlop={6}>
              <ArrowIcon back size={16} color={th.colors.text} />
            </Pressable>
          )}
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {name}
          {!!suffix && <Text style={styles.suffix}>{`  ${suffix}`}</Text>}
        </Text>
        <View style={[styles.side, styles.skipSide]}>
          {canSkip && (
            <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.skip}>{skipLabel}</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={[styles.bar, !showBar && styles.barOff]}>
        {fills.map((v, i) => <Segment key={i} value={v} />)}
      </View>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  top:    { paddingHorizontal: spacing.lg + 1, paddingTop: spacing.xs2, paddingBottom: spacing.sm },
  hidden: { height: 0, overflow: 'hidden', paddingTop: 0, paddingBottom: 0, opacity: 0 },
  row:    { flexDirection: 'row', alignItems: 'center', gap: spacing.lg - 3, height: 36 },
  side:   { width: 64, alignItems: 'flex-start' },
  skipSide: { alignItems: 'flex-end' },
  back: {
    width:           36,
    height:          36,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  name:   { ...textStyles.caps, flex: 1, textAlign: 'center', color: th.colors.accent, textTransform: 'uppercase' },
  suffix: { ...textStyles.caps, color: th.colors.mutedLight },
  skip:   { ...textStyles.bodyStrong, color: th.colors.mutedLight },
  bar:    { flexDirection: 'row', gap: spacing.xs2, marginTop: spacing.md },
  barOff: { opacity: 0 },
  seg:    { flex: 1, height: 6, borderRadius: 3, backgroundColor: th.colors.surface2, overflow: 'hidden' },
  segFill: { height: '100%', borderRadius: 3, backgroundColor: th.colors.accent },
});
