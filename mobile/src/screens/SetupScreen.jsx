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
import { colors, spacing, typography, radius, borders, withOpacity } from '../theme';

// ── Botón de selección ─────────────────────────────────────────────────────────

function PickerBtn({ label, sublabel, selected, onPress }) {
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
      <Text style={styles.brand}>FUERZA{'\n'}& CONTROL</Text>
      <Text style={styles.tagline}>
        {lang === 'en' ? 'Your strength training app' : 'Tu app de entrenamiento de fuerza'}
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

const styles = StyleSheet.create({
  container: {
    flex:              1,
    backgroundColor:   colors.bg,
    paddingHorizontal: spacing.xxl,
  },

  brand: {
    fontSize:      52,
    fontWeight:    typography.heavy,
    color:         colors.accent,
    lineHeight:    56,
    letterSpacing: 2,
  },
  tagline: {
    fontSize:  typography.lg,
    color:     colors.muted,
    marginTop: spacing.sm,
  },

  spacer: { flex: 1 },

  section:      { marginBottom: spacing.xxl },
  sectionLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.muted,
    letterSpacing: 1.5,
    marginBottom:  spacing.sm,
  },
  optRow: { flexDirection: 'row', gap: spacing.sm },

  pickerBtn: {
    flex:              1,
    backgroundColor:   colors.surface,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.md,
    paddingVertical:   spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems:        'center',
    gap:               3,
  },
  pickerBtnOn: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderColor:     colors.accent,
  },
  pickerLabel:   { fontSize: typography.md, fontWeight: typography.semibold, color: colors.text },
  pickerLabelOn: { color: colors.accent },
  pickerSub:     { fontSize: typography.xs, color: colors.muted },
  pickerSubOn:   { color: colors.accent, opacity: 0.8 },

  cta: {
    backgroundColor: colors.accent,
    borderRadius:    radius.md,
    paddingVertical: 16,
    alignItems:      'center',
  },
  ctaText: {
    fontSize:      22,
    fontWeight:    typography.heavy,
    letterSpacing: 2,
    color:         colors.onAccent,
  },
});
