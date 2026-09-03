/**
 * SetupScreen — pantalla de configuración inicial (primera apertura).
 * Selector de idioma + unidad de peso, antes de llegar al onboarding.
 * No aparece en aperturas posteriores (profile.setupComplete = true).
 *
 * Migrada a FormaFit sin nodo de Figma: cada pieza sale de una pantalla ya
 * cerrada (ver `docs/UI-MIGRATION.md` §1, fila de Onboarding).
 *   · marca        → el lockup de `AppHeader` (Forma + `FitLogo`), a escala ×2
 *   · secciones    → `stepTitle` de la hoja de Progresión: `spacingTag` en
 *                    `mutedLight` con el número en `accent`
 *   · selectores   → `SegmentedControl`, el control de la app para 2-4 opciones
 *   · hints        → `textStyles.subtitle` / `mutedLight`, y dicen el EFECTO
 *   · CTA          → `startBtn` del pie del preview de onboarding
 *
 * Es la única pantalla que puede saltarse `t()`: i18n todavía no tiene idioma,
 * porque elegirlo es justamente lo que se hace aquí.
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store/useStore';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import SegmentedControl from '../components/ui/SegmentedControl';
import { ArrowIcon } from '../components/ui/EditorIcons';
import FitLogo from '../components/ui/FitLogo';

// Textos bilingües inline — i18n aún no está cargado con el idioma elegido.
const T = {
  es: {
    tagline: 'Tu app de entrenamiento',
    lang: 'IDIOMA',       langHint: 'Puedes cambiarlo después, en Ajustes.',
    unit: 'UNIDAD DE PESO', unitHint: 'Se aplica a todo lo que registres, y también a lo que ya tengas.',
    kg: 'KILOGRAMOS', lb: 'LIBRAS',
    cta: 'CONTINUAR',
  },
  en: {
    tagline: 'Your workout tracker',
    lang: 'LANGUAGE',      langHint: 'You can change it later, in Settings.',
    unit: 'WEIGHT UNIT',   unitHint: 'Applies to everything you log, and to what you already have.',
    kg: 'KILOGRAMS', lb: 'POUNDS',
    cta: 'CONTINUE',
  },
};

// ── Sección numerada (hoja de Progresión, `ExerciseEditorInline.jsx:706`) ─────

function Step({ n, label, hint, children }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}><Text style={styles.stepNum}>{n}</Text> · {label}</Text>
      {children}
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function SetupScreen() {
  const styles     = useThemedStyles(makeStyles);
  const th         = useTheme();
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const setProfile  = useStore((s) => s.setProfile);
  const setLanguage = useStore((s) => s.setLanguage);
  const profile     = useStore((s) => s.profile);

  const [lang, setLang] = useState(profile.language   ?? 'es');
  const [unit, setUnit] = useState(profile.weightUnit ?? 'kg');

  function handleContinue() {
    setLanguage(lang);
    setProfile({ weightUnit: unit, setupComplete: true });
    navigation.replace('Onboarding');
  }

  const tx = T[lang] ?? T.es;

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
    ]}>
      <View>
        <View style={styles.brandRow}>
          <Text style={styles.brandForma}>Forma</Text>
          <View style={{ marginTop: spacing.sm2 }}><FitLogo height={28} /></View>
        </View>
        <Text style={styles.tagline}>{tx.tagline}</Text>
      </View>

      <View style={styles.spacer} />

      <Step n="1" label={tx.lang} hint={tx.langHint}>
        <SegmentedControl
          options={[{ id: 'es', label: 'ESPAÑOL' }, { id: 'en', label: 'ENGLISH' }]}
          value={lang}
          onChange={setLang}
        />
      </Step>

      <Step n="2" label={tx.unit} hint={tx.unitHint}>
        <SegmentedControl
          options={[{ id: 'kg', label: tx.kg }, { id: 'lb', label: tx.lb }]}
          value={unit}
          onChange={setUnit}
        />
      </Step>

      <View style={styles.spacer} />

      <TouchableOpacity style={styles.cta} onPress={handleContinue} activeOpacity={0.85}>
        <Text style={styles.ctaText}>{tx.cta}</Text>
        <ArrowIcon size={14} color={th.colors.onAccent} />
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  container: {
    flex:              1,
    backgroundColor:   th.colors.bg,
    paddingHorizontal: spacing.xl,
    gap:               spacing.xxl,
  },

  // Mismo lockup que la cabecera de la app (`appNameForma` + `FitLogo`), a
  // escala ×2: es la primera pantalla y aquí la marca sí es el contenido.
  brandRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.xs2 },
  brandForma: {
    fontFamily:    'Inter_900Black_Italic',
    fontSize:      38,
    color:         th.colors.text,
    letterSpacing: -2.28,
  },
  tagline: { ...textStyles.subtitle, color: th.colors.mutedLight, marginTop: spacing.sm },

  spacer: { flex: 1 },

  step:      { gap: spacing.sm },
  stepTitle: { ...textStyles.spacingTag, color: th.colors.mutedLight, textTransform: 'uppercase' },
  stepNum:   { color: th.colors.accent },
  hint:      { ...textStyles.subtitle, color: th.colors.mutedLight, lineHeight: 18 },

  cta: {
    flexDirection:   'row',
    gap:             spacing.sm,
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  ctaText: { ...textStyles.btnAction, fontSize: 14, color: th.colors.onAccent },
});
