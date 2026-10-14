/**
 * TabBarMini — la barra de pestañas de la app en miniatura, para la tarjeta
 * «Tu entreno de hoy» de Aprende (O03 §11.4): dice dónde vive lo que se acaba de
 * enseñar. Mismos iconos, colores y rol de texto que `MainTabs` de
 * `RootNavigator`, con Entreno resaltado. Las de entrenador solo si se ven
 * (`proTabsHidden`). Solo se mira: no navega.
 */
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import { Text } from '../../ui/Text';
import { spacing, textStyles, borders } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';

const ICON = 20;

export default function TabBarMini() {
  const { t }  = useTranslation();
  const C      = useTheme().colors;
  const styles = useThemedStyles(makeStyles);
  const pro    = !useStore((s) => s.profile?.proTabsHidden ?? false);

  const tabs = [
    ['session', 'barbell'],
    ['program', 'layers'],
    ['progress', 'stats-chart'],
    ...(pro ? [['clients', 'people'], ['templates', 'copy']] : []),
  ];

  return (
    <View style={styles.bar} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {tabs.map(([key, icon], i) => {
        const on = i === 0;
        const color = on ? C.accent : C.muted;
        return (
          <View key={key} style={styles.tab}>
            <Ionicons name={on ? icon : `${icon}-outline`} size={ICON} color={color} />
            <Text style={[styles.label, { color }]} numberOfLines={1}>{t(`tabs.${key}`)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  bar: {
    flexDirection:  'row',
    backgroundColor: th.colors.bg,
    borderTopColor: th.colors.border,
    borderTopWidth: borders.thin,
    paddingTop:     spacing.sm,
    paddingBottom:  spacing.xs2,
    marginTop:      spacing.md,
  },
  tab:   { flex: 1, alignItems: 'center', gap: 2 },
  label: { ...textStyles.micro },
});
