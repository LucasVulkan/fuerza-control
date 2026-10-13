/**
 * ProgramActions — Editar · Ver · `⋯` debajo de la tarjeta del programa, en el
 * tab Programa y en la ficha de cliente.
 *
 * Aquí vivía también `ProgramCard`, la tarjeta del programa de antes. Desde U14
 * (docs/specs/U14-pantalla-programa.md) las dos pantallas pintan la de Inicio
 * (`HomeProgramCard`) con `ProgramCardDetail` debajo, y la vieja se borró.
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './Text';
import { MenuIcon } from './EditorIcons';
import ProBadge from './ProBadge';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

/**
 * Editar · Ver · `⋯`, sueltos bajo la tarjeta: botones `Secondary` (relleno
 * `surface2`, sin borde, `radius/md`, texto `labelStrong`), la variante ya
 * cerrada de la app — la misma que el «Sustituir» del editor de sesión. Los
 * comparten el tab Programa y la ficha de cliente. Sin `onEdit`, Ver ocupa el
 * hueco. El `⋯` no ejecuta nunca: abre una lista.
 */
/** `editLocked`: el plan gratis no deja editar (M01 §4.11) — PRO junto a EDITAR. */
export function ProgramActions({ onEdit, onView, onMore, editLocked = false }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.actions}>
      {!!onEdit && (
        <TouchableOpacity style={[styles.actionBtn, editLocked && { flexDirection: 'row', gap: spacing.sm }]} onPress={onEdit} activeOpacity={0.75} accessibilityRole="button">
          <Text style={styles.actionBtnText} numberOfLines={1}>{t('programCard.edit')}</Text>
          {editLocked && <ProBadge />}
        </TouchableOpacity>
      )}
      {!!onView && (
        <TouchableOpacity style={styles.actionBtn} onPress={onView} activeOpacity={0.75} accessibilityRole="button">
          <Text style={styles.actionBtnText} numberOfLines={1}>{t('programCard.view')}</Text>
        </TouchableOpacity>
      )}
      {!!onMore && (
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnIcon]}
          onPress={onMore}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t('home.moreOptions')}
        >
          <MenuIcon horizontal color={th.colors.mutedLight} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // ── Acciones (ProgramActions) ───────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap:           spacing.xs2,
    // La misma separación con la tarjeta que entre botones, y la de las
    // tarjetas de sesión entre sí (U13 §11).
    marginTop:     spacing.xs2,
  },
  actionBtn: {
    flex:            1,
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  actionBtnIcon: { flex: 0, width: 52 },
  actionBtnText: { ...textStyles.labelStrong, color: th.colors.text, textAlign: 'center' },
});
