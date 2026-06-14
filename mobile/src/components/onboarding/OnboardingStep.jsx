/**
 * OnboardingStep — contenedor de cada paso del wizard.
 * Título grande (heavy) + subtítulo + contenido scrollable + botones Atrás/Siguiente.
 * Fiel al original web: mismo layout, mismas props.
 */
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, typography, borders } from '../../theme';
import { useThemedStyles } from '../../useTheme';

export default function OnboardingStep({
  title,
  subtitle,
  children,
  onNext,
  onBack,
  nextDisabled = false,
  showBack     = true,
  isLast       = false,
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.container}>
      {/* Cabecera */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {/* Opciones — scrollable para cuando hay muchas */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {/* Navegación */}
      <View style={styles.footer}>
        {showBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
            <Text style={styles.backBtnText}>{t('common.back', 'Atrás')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, nextDisabled && styles.nextBtnOff]}
          onPress={nextDisabled ? undefined : onNext}
          activeOpacity={nextDisabled ? 1 : 0.85}
        >
          <Text
            style={[styles.nextBtnText, nextDisabled && styles.nextBtnTextOff]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {isLast
              ? t('onboarding.generateProgram', 'GENERAR PROGRAMA')
              : `${t('common.next', 'Siguiente')} ›`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.lg,
  },
  title: {
    fontSize:      30,
    fontWeight:    typography.heavy,
    letterSpacing: 0.8,
    color:         th.colors.text,
    lineHeight:    34,
    marginBottom:  6,
  },
  subtitle: {
    fontSize:   typography.base,
    color:      th.colors.muted,
    lineHeight: typography.base * 1.6,
  },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },

  footer: {
    flexDirection:     'row',
    gap:               spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.lg,
    borderTopWidth:    borders.thin,
    borderTopColor:    th.colors.border,
  },
  backBtn: {
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.md,
    paddingVertical:  14,
    paddingHorizontal: spacing.xl,
    justifyContent:  'center',
  },
  backBtnText: {
    fontSize:   typography.base,
    color:      th.colors.text,
    fontWeight: typography.medium,
  },
  nextBtn: {
    flex:            1,
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    paddingVertical: 14,
    alignItems:      'center',
    justifyContent:  'center',
  },
  nextBtnOff: { backgroundColor: th.colors.surface2 },
  nextBtnText: {
    fontSize:      16,
    fontWeight:    typography.heavy,
    letterSpacing: 1,
    color:         th.colors.onAccent,
  },
  nextBtnTextOff: { color: th.colors.muted },
});
