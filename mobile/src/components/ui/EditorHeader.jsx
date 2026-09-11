/**
 * EditorHeader — cabecera de los editores de ejercicio y de bloque (Figma
 * `123:1633` / `190:1662`): barra accent con el nombre y un desplegable para
 * saltar a otro elemento de la misma sesión, más el botón "Aceptar".
 *
 * Vivía duplicada en los dos modales de `SessionEditorScreen`; al pasar cada
 * editor a pantalla del stack se extrajo aquí tal cual. El desplegable se ancla
 * inline al borde inferior de la barra, igual que el de Progreso.
 */
import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useTranslation } from 'react-i18next';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { ArrowIcon } from './EditorIcons';

export default function EditorHeader({ title, items, currentId, onSelect, onAccept }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);

  const hasPicker = items.length > 1;

  return (
    <View style={styles.header}>
      <View style={styles.anchor}>
        <TouchableOpacity
          style={[styles.bar, open && styles.barOpen]}
          onPress={() => { if (hasPicker) setOpen((o) => !o); }}
          activeOpacity={0.85}
        >
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {hasPicker && (
            <View style={[styles.chevron, open && styles.chevronOpen]}>
              <ArrowIcon size={7.69} color={th.colors.onAccent} />
            </View>
          )}
        </TouchableOpacity>

        {open && (
          <View style={styles.pickerList}>
            {items.map((item) => {
              const isCurrent = item.id === currentId;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.pickerItem, isCurrent && styles.pickerItemSel]}
                  onPress={() => { setOpen(false); onSelect(item.id); }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[styles.pickerText, isCurrent && styles.pickerTextSel]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.accept} onPress={onAccept} activeOpacity={0.8}>
        <Text style={styles.acceptTxt}>{t('common.accept')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // `zIndex` para que el desplegable pinte por encima del ScrollView de abajo,
  // que es su hermano posterior.
  header: {
    flexDirection:     'row',
    alignItems:        'stretch',
    gap:               spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.md,
    zIndex:            100,
  },
  anchor: { flex: 1, minWidth: 0, zIndex: 100 },
  bar: {
    flex:              1,
    minWidth:          0,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               spacing.md,
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
  },
  // Con el menú abierto la barra pierde las esquinas de abajo para fusionarse
  // con él (mismo tratamiento que el desplegable de Progreso).
  barOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  title:   { ...textStyles.caps, color: th.colors.onAccent, flexShrink: 1, textTransform: 'uppercase' },
  chevron:     { transform: [{ rotate: '90deg'  }] },
  chevronOpen: { transform: [{ rotate: '270deg' }] },

  pickerList: {
    position:                'absolute',
    top:                     '100%',
    left:                    0,
    right:                   0,
    zIndex:                  100,
    backgroundColor:         th.colors.surface2,
    borderBottomLeftRadius:  th.radius.sm,
    borderBottomRightRadius: th.radius.sm,
    overflow:                'hidden',
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius:  10,
    elevation:     12,
  },
  pickerItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
  },
  pickerItemSel: { backgroundColor: th.tint.accent10 },
  pickerText:    { ...textStyles.body, color: th.colors.mutedLight },
  pickerTextSel: { color: th.colors.text },
  // Figma pinta este botón en `color/muted`; en QA se cambió al relleno
  // Secondary (`color/surface-2`), el mismo de los demás botones secundarios.
  accept: {
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  acceptTxt: { ...textStyles.labelStrong, color: th.colors.text },
});
