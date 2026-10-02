/**
 * ActiveSessionBanner — la sesión a medias, arriba de Inicio (pulido-ui.md
 * §16, U52). Sale siempre que haya una, sea cual sea: la del programa deja de
 * apropiarse del hero, y una libre o la sobre la marcha no tenían dónde verse.
 *
 * A prueba (1-oct-2026): en lima, con la tinta y el botón del hero. Si queda
 * demasiado llamativo, vuelve a `surface` con solo el botón en lima. De un
 * cliente, en azul (el azul es del entrenador).
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { Text } from './ui/Text';
import { useElapsedText } from './ui/useElapsedText';
import { useStore } from '../../store/useStore';
import { activeSessionSummary } from '../utils/activeSession';
import { spacing, textStyles, lh, LINE } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

// El reloj en su propio componente: el tic de 1 s repinta solo la ceja.
function Eyebrow({ parts, startedAt, style }) {
  const elapsed = useElapsedText(startedAt);
  return (
    <Text style={style} numberOfLines={1}>
      {[...parts, elapsed].filter(Boolean).join(' · ').toUpperCase()}
    </Text>
  );
}

export default function ActiveSessionBanner() {
  const { t }      = useTranslation();
  const navigation = useNavigation();
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);
  const activeSession    = useStore((s) => s.activeSession);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const clients          = useStore((s) => s.clients);

  const summary = activeSessionSummary({ activeSession, sessionTemplates, clients }, t);
  if (!summary) return null;

  const tone = summary.client != null ? th.colors.blue : th.colors.accent;
  const open = () => navigation.navigate('Workout');

  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: tone }]}
      onPress={open}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${t('home.running')}, ${summary.name}`}
    >
      <View style={styles.body}>
        <View style={styles.eyebrowRow}>
          <View style={styles.dot} />
          <Eyebrow
            parts={[t('home.running'), summary.client]}
            // Modo registro: sin reloj, que no mediría nada (como el Workout).
            startedAt={activeSession.logOnly ? null : activeSession.startedAt}
            style={styles.eyebrow}
          />
        </View>
        <Text style={styles.name} numberOfLines={1}>{summary.name}</Text>
      </View>
      <View style={styles.btn}>
        <Text style={[styles.btnText, { color: tone }]}>{t('home.btnContinue')}</Text>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (th) => StyleSheet.create({
  banner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    // Se probó colgando del header y asomando por la derecha (QA 1-oct): se
    // queda como tarjeta normal.
    borderRadius:      th.radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom:      spacing.sm,
  },
  // Compacto (QA 1-oct): interlineados ajustados y sin relleno de fuente. Sin
  // la cuenta de ejercicios: no hacía falta (QA 1-oct); la lleva el diálogo.
  body:       { flex: 1 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs2 },
  // La tinta del hero: `onAccent`, también la ceja y el reloj (QA 1-oct).
  dot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: th.colors.onAccent },
  eyebrow: {
    ...textStyles.caps,
    lineHeight: lh(textStyles.caps.fontSize, LINE.row),
    includeFontPadding: false,
    flexShrink: 1,
    color:      th.colors.onAccent,
  },
  name: {
    ...textStyles.itemTitle,
    lineHeight: lh(textStyles.itemTitle.fontSize, LINE.row),
    includeFontPadding: false,
    color:      th.colors.onAccent,
  },
  // El botón del hero (`todayBtn`): `onAccent` de fondo y el texto en el tono.
  btn: {
    paddingVertical:   11,
    paddingHorizontal: spacing.lg,
    borderRadius:      th.radius.md,
    backgroundColor:   th.colors.onAccent,
  },
  btnText: { ...textStyles.caps, fontFamily: 'Inter_900Black' },
});
