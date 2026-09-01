/**
 * AdaptationPanel — el detalle de los ajustes, por secciones (spec
 * onboarding-simple.md §8). Reemplaza a `AdaptationNotice`: en vez de un
 * párrafo, tres listas con color — sustituidos (lima), quitados (naranja),
 * sin cubrir (rojo) — cada fila con la etiqueta del motivo a la derecha.
 *
 * La parte pura vive en `utils/adaptationDiff.js` (`computeAdjustments`):
 * junta `substitutions` (ya
 * deduplicadas por quien llama), `unresolved`, `levelCuts` (§5.1) y
 * `timeCuts` (`diffAdaptations`, §5.2) en las tres listas ya listas para
 * pintar + el contador total, que usa también la fila colapsada del preview.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { ArrowIcon } from '../ui/EditorIcons';

/** Agrupa las filas por motivo, en orden de aparición: el motivo se dice UNA
 *  vez, como cabecera ligera, en vez de repetirse en cada fila. */
function groupByTag(rows) {
  const out = [];
  for (const row of rows) {
    const last = out[out.length - 1];
    if (last && last.tag === row.tag) last.rows.push(row);
    else out.push({ tag: row.tag, rows: [row] });
  }
  return out;
}

function Section({ titleKey, color, rows, renderRow }) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  if (!rows.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color }]}>{t(titleKey)}</Text>
        <Text style={[styles.sectionCount, { backgroundColor: color }]}>{rows.length}</Text>
      </View>
      {groupByTag(rows).map((group) => (
        <View key={group.tag ?? '—'} style={styles.group}>
          {group.tag ? <Text style={styles.groupHead}>{group.tag}</Text> : null}
          {group.rows.map(renderRow)}
        </View>
      ))}
    </View>
  );
}

export default function AdaptationPanel({ adjustments }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { substituted, removed, gaps } = adjustments;

  return (
    <View style={styles.wrap}>
      <Section
        titleKey="onboarding.adaptationPanel.substitutedTitle"
        color={th.colors.accent}
        rows={substituted}
        renderRow={(s) => (
          <View key={s.key} style={styles.item}>
            <Text style={styles.from} numberOfLines={1}>{s.from}</Text>
            <ArrowIcon size={8} color={th.colors.mutedLight} />
            <Text style={styles.to} numberOfLines={1}>{s.to}</Text>
          </View>
        )}
      />

      <Section
        titleKey="onboarding.adaptationPanel.removedTitle"
        color={th.colors.orange}
        rows={removed}
        renderRow={(r) => (
          <View key={r.key} style={styles.item}>
            <Text style={[styles.dayLetter, { color: r.color }]}>{r.label}</Text>
            <Text style={[styles.to, r.added && { color: th.colors.accent }]} numberOfLines={1}>{r.name}</Text>
          </View>
        )}
      />

      <Section
        titleKey="onboarding.adaptationPanel.gapsTitle"
        color={th.colors.red}
        rows={gaps}
        renderRow={(g) => (
          <View key={g.key} style={styles.item}>
            <Text style={styles.to} numberOfLines={2}>{g.text}</Text>
          </View>
        )}
      />
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // Un solo fondo para todo el panel: antes cada fila era su propia tarjeta y
  // el bloque se leía como una lista de avisos sueltos.
  wrap: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    gap:             spacing.lg,
  },
  section: { gap: spacing.sm },
  group:   { gap: spacing.xs2 },
  groupHead: {
    ...textStyles.tag,
    fontWeight:    '800',
    letterSpacing: 1.12,
    color:         th.colors.mutedLight,
    marginTop:     spacing.xs2,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  sectionTitle: { ...textStyles.spacingTag, textTransform: 'uppercase' },
  sectionCount: {
    ...textStyles.spacingTag,
    color:             th.colors.onAccent,
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.xs2 + 1,
    letterSpacing:     0,
    overflow:          'hidden',
  },
  item: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    paddingVertical: spacing.xs,
  },
  from: { ...textStyles.tag, color: th.colors.mutedLight, textDecorationLine: 'line-through', flexShrink: 1 },
  to:   { ...textStyles.tag, color: th.colors.text, fontWeight: '600', flexShrink: 1 },
  dayLetter: { ...textStyles.cardType, width: 14 },
});
