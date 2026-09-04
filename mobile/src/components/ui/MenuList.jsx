/**
 * Lista agrupada de filas de consulta/configuración — §9 de docs/UI-MIGRATION.md.
 *
 * Extraído del menú principal (`AppHeader.jsx`) para que las pantallas de
 * Entrenador y Copia en Drive usen EXACTAMENTE las mismas filas, no una
 * reimplementación (mismo motivo por el que `EditorRows.jsx` salió de
 * `ExerciseEditorInline`).
 *
 * Estructura: etiqueta de sección (`spacingTag`/`mutedLight`) + filas con gap
 * `space/xs` y radios asimétricos por posición (`getCardRadii`). Los iconos van
 * en gris: son decoración funcional, el lima queda para lo que informa.
 */
import { Children, cloneElement } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg from 'react-native-svg';

import { spacing, textStyles, getCardRadii } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { ArrowIcon } from './EditorIcons';

// Chevron de fila navegable: la caja de Figma mide 14 pero el glifo real son
// 6.46×10.77 (regla 4 de UI-MIGRATION: caja de icono ≠ icono visible).
export const ROW_CHEVRON = 10.77;

export function RowIcon({ children, color }) {
  const th = useTheme();
  return (
    <Svg
      width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={color ?? th.colors.mutedLight} strokeWidth={2.4}
      strokeLinecap="round" strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

/** La etiqueta de sección suelta, para bloques que no son una lista de filas. */
export function SectionLabel({ children, style }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

/**
 * Sección de la lista. Sin `title` pinta solo el grupo de filas (lo que
 * necesitan las hojas, que ya llevan su propio título).
 * `Children.toArray` descarta los `false`/`null` de las filas condicionales,
 * así que la primera y la última se calculan solas.
 */
export function Section({ title, children }) {
  const styles = useThemedStyles(makeStyles);
  const rows   = Children.toArray(children);
  return (
    <View style={styles.section}>
      {title != null && <Text style={styles.sectionLabel}>{title}</Text>}
      <View style={styles.group}>
        {rows.map((row, i) =>
          cloneElement(row, { isFirst: i === 0, isLast: i === rows.length - 1 }),
        )}
      </View>
    </View>
  );
}

/** Punto + texto de estado. `tone`: 'on' | 'warn' | 'off'. */
export function Status({ tone, label }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const dot    = tone === 'on' ? th.colors.accent     : tone === 'warn' ? th.colors.orange : th.colors.muted;
  const text   = tone === 'on' ? th.colors.mutedLight : tone === 'warn' ? th.colors.orange : th.colors.accent;
  return (
    <View style={styles.status}>
      <View style={[styles.statusDot, { backgroundColor: dot }]} />
      <Text style={[styles.statusText, { color: text }]}>{label}</Text>
    </View>
  );
}

/**
 * Fila: icono + etiqueta, y a la derecha lo que toque (valor, badge, estado con
 * punto o un control). El chevron solo aparece cuando la fila navega y no lleva
 * ya estado o control a la derecha.
 *
 * `subLines` limita el subtítulo a una línea por defecto; 0 = sin límite, para
 * los subtítulos que explican en vez de resumir.
 *
 * `valueBelow` baja el valor a su propia línea, debajo de la etiqueta y a todo
 * el ancho. En la columna de la derecha el valor se corta a una línea y al 45%
 * (un nombre de programa o una fecha larga no cabían), así que las filas que
 * solo informan lo apilan y así se lee entero.
 */
export function MenuRow({
  icon, label, labelColor, sub, subLines = 1, value, valueBelow, badge, badgeMuted, status, control,
  onPress, disabled, minHeight, isFirst, isLast,
}) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const Wrap   = onPress ? TouchableOpacity : View;
  const press  = onPress ? { onPress, activeOpacity: 0.7, disabled } : null;
  return (
    <Wrap
      style={[
        styles.row,
        getCardRadii(th, isFirst, isLast),
        minHeight ? { minHeight } : null,
        disabled && styles.rowDisabled,
      ]}
      {...press}
    >
      {icon != null && <View style={styles.rowIcon}>{icon}</View>}
      <View style={styles.rowMeta}>
        <Text
          style={[styles.rowLabel, labelColor ? { color: labelColor } : null]}
          numberOfLines={valueBelow ? undefined : 2}
        >
          {label}
        </Text>
        {!!value && valueBelow && <Text style={styles.rowValueBelow}>{value}</Text>}
        {!!sub && (
          <Text style={styles.rowSub} numberOfLines={subLines || undefined}>{sub}</Text>
        )}
      </View>
      {control}
      {!!value && !valueBelow && <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>}
      {!!badge && (
        // El lima informa: PRO va en lima, FREE en gris (no es un logro).
        <View style={[styles.badge, badgeMuted && styles.badgeOff]}>
          <Text style={[styles.badgeText, badgeMuted && styles.badgeTextOff]}>{badge}</Text>
        </View>
      )}
      {status}
      {onPress && !status && !control && (
        <ArrowIcon size={ROW_CHEVRON} color={th.colors.muted} />
      )}
    </Wrap>
  );
}

const makeStyles = (th) => StyleSheet.create({
  section:      { marginBottom: spacing.xl },
  sectionLabel: {
    ...textStyles.spacingTag,
    color:             th.colors.mutedLight,
    textTransform:     'uppercase',
    paddingHorizontal: spacing.xs2,
    marginBottom:      spacing.sm2,
  },
  group: { gap: spacing.xs },

  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.lg,
    minHeight:         52,
    backgroundColor:   th.colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
  },
  rowDisabled: { opacity: 0.45 },
  rowIcon:     { width: 20, alignItems: 'center', flexShrink: 0 },
  rowMeta:     { flex: 1, minWidth: 0 },
  // 14px ExtraBold sin tracking: no hay token de Figma para este tamaño
  // (`cardType` es 12/1.2).
  rowLabel: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize:   14,
    color:      th.colors.text,
  },
  rowSub: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   11,
    color:      th.colors.mutedLight,
    marginTop:  spacing.xs,
    lineHeight: 15,
  },
  rowValue: {
    fontFamily:  'Inter_700Bold',
    fontSize:    12,
    color:       th.colors.muted,
    fontVariant: ['tabular-nums'],
    flexShrink:  0,
    maxWidth:    '45%',
  },
  // Apilado: sin `maxWidth` ni `numberOfLines`, y en lima porque al bajar de la
  // columna derecha pierde el contraste de posición que lo hacía destacar.
  rowValueBelow: {
    fontFamily:  'Inter_700Bold',
    fontSize:    13,
    color:       th.colors.accent,
    fontVariant: ['tabular-nums'],
    marginTop:   spacing.xs,
  },

  // Estado de conexión: punto + texto. Lo que informa va en lima; cuando está
  // apagado, el texto pasa a lima porque ahí SÍ hay una acción que ofrecer.
  status:     { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 0 },
  statusDot:  { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 12 },

  badge: {
    paddingHorizontal: spacing.sm2,
    paddingVertical:   3,
    borderRadius:      th.radius.xs,
    backgroundColor:   th.tint.accent10,
    flexShrink:        0,
  },
  badgeText:    { ...textStyles.spacingTag, color: th.colors.accent },
  badgeOff:     { backgroundColor: th.colors.surface2 },
  badgeTextOff: { color: th.colors.mutedLight },
});
