/**
 * SetupScreen — pantalla de configuración inicial (primera apertura).
 * Selector de idioma + unidad de peso, antes de llegar al onboarding.
 * No aparece en aperturas posteriores (profile.setupComplete = true).
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store/useStore';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useThemedStyles } from '../useTheme';

// ── Botón de selección ─────────────────────────────────────────────────────────

function PickerBtn({ label, sublabel, selected, onPress }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.pickerBtn, selected && styles.pickerBtnOn]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.pickerLabel, selected && styles.pickerLabelOn]}>{label}</Text>
      {sublabel ? (
        <Text style={[styles.pickerSub, selected && styles.pickerSubOn]}>{sublabel}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function SetupScreen() {
  const styles = useThemedStyles(makeStyles);
  const insets        = useSafeAreaInsets();
  const navigation    = useNavigation();
  const setProfile    = useStore((s) => s.setProfile);
  const setLanguage   = useStore((s) => s.setLanguage);
  const profile       = useStore((s) => s.profile);

  const [lang, setLang] = useState(profile.language  ?? 'es');
  const [unit, setUnit] = useState(profile.weightUnit ?? 'kg');

  function handleContinue() {
    setLanguage(lang);
    setProfile({ weightUnit: unit, setupComplete: true });
    navigation.replace('Onboarding');
  }

  // Textos bilingües inline — i18n aún no está cargado con el idioma elegido
  const T = lang === 'en'
    ? { lang: 'LANGUAGE', unit: 'WEIGHT UNIT', kg: 'Kilograms', lb: 'Pounds', cta: 'CONTINUE →' }
    : { lang: 'IDIOMA',   unit: 'UNIDAD DE PESO', kg: 'Kilogramos', lb: 'Libras', cta: 'CONTINUAR →' };

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
    ]}>
      {/* Brand */}
      <View style={styles.brandRow}>
        <Text style={styles.brandForma}>Forma</Text>
        <Text style={styles.brandFit}> Fit</Text>
      </View>
      <Text style={styles.tagline}>
        {lang === 'en' ? 'Your workout tracker' : 'Tu app de entrenamiento'}
      </Text>

      <View style={styles.spacer} />

      {/* Idioma */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{T.lang}</Text>
        <View style={styles.optRow}>
          <PickerBtn label="🇪🇸  Español" selected={lang === 'es'} onPress={() => setLang('es')} />
          <PickerBtn label="🇺🇸  English" selected={lang === 'en'} onPress={() => setLang('en')} />
        </View>
      </View>

      {/* Unidad de peso */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{T.unit}</Text>
        <View style={styles.optRow}>
          <PickerBtn label="kg" sublabel={T.kg} selected={unit === 'kg'} onPress={() => setUnit('kg')} />
          <PickerBtn label="lb" sublabel={T.lb} selected={unit === 'lb'} onPress={() => setUnit('lb')} />
        </View>
      </View>

      <View style={styles.spacer} />

      {/* CTA */}
      <TouchableOpacity style={styles.cta} onPress={handleContinue} activeOpacity={0.85}>
        <Text style={styles.ctaText}>{T.cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  container: {
    flex:              1,
    backgroundColor:   th.colors.bg,
    paddingHorizontal: spacing.xxl,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
  },
  brandForma: {
    fontSize:      52,
    fontWeight:    typography.heavy,
    color:         th.colors.text,
    letterSpacing: 1,
  },
  brandFit: {
    fontSize:      52,
    fontWeight:    typography.heavy,
    color:         th.colors.accent,
    letterSpacing: 1,
  },
  tagline: {
    fontSize:  typography.lg,
    color:     th.colors.muted,
    marginTop: spacing.sm,
  },

  spacer: { flex: 1 },

  section:      { marginBottom: spacing.xxl },
  sectionLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.muted,
    letterSpacing: 1.5,
    marginBottom:  spacing.sm,
  },
  optRow: { flexDirection: 'row', gap: spacing.sm },

  pickerBtn: {
    flex:              1,
    backgroundColor:   th.colors.surface,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    borderRadius:      th.radius.md,
    paddingVertical:   spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems:        'center',
    gap:               3,
  },
  pickerBtnOn: {
    backgroundColor: withOpacity(th.colors.accent, 0.08),
    borderColor:     th.colors.accent,
  },
  pickerLabel:   { fontSize: typography.md, fontWeight: typography.semibold, color: th.colors.text },
  pickerLabelOn: { color: th.colors.accent },
  pickerSub:     { fontSize: typography.xs, color: th.colors.muted },
  pickerSubOn:   { color: th.colors.accent, opacity: 0.8 },

  cta: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    paddingVertical: 16,
    alignItems:      'center',
  },
  ctaText: {
    fontSize:      22,
    fontWeight:    typography.heavy,
    letterSpacing: 2,
    color:         th.colors.onAccent,
  },
});
