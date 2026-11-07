/**
 * RichText — el texto de un paso con botones, iconos y estados dentro de la línea
 * (U17-01 §3.2; las marcas, en `richText.js`).
 *
 * Los botones y los iconos son `View` de tamaño fijo dentro del `Text`, que RN
 * deja pintar en línea en iOS y Android. Van pegados a la línea de base, así que
 * se bajan `NUDGE` px para quedar centrados con el cuerpo de la letra. Los
 * iconos son los de la app, no copias: cada nombre de `ICONS` apunta al
 * componente que usa la pantalla de donde sale.
 */
import { View, StyleSheet } from 'react-native';

import { Text } from '../ui/Text';
import { DragIcon, GearIcon, PasteWorkoutIcon, CloudIcon, SortIcon } from '../ui/EditorIcons';
import { ShareIcon } from '../SessionList';
import { makeRowStyles } from '../clientRowStyles';
import { WeekTicks } from '../ProgramStages';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { parseRich } from './richText';

const SIZE  = 18;   // alto de los botones e iconos en línea
const NUDGE = 3;    // lo que se bajan para centrarlos con la letra

/** El icono real de cada nombre, a su color de la pantalla de origen. */
function inlineIcon(name, th) {
  const C = th.colors;
  switch (name) {
    case 'handle':  return <DragIcon size={SIZE} color={C.mutedLight} />;               // asa de reordenar (SwipeRow)
    case 'gear':    return <GearIcon size={SIZE - 2} color={C.mutedLight} />;           // ajustes de la etapa
    case 'paste':   return <PasteWorkoutIcon size={SIZE} color={C.text} />;             // cabecera de Clientes
    case 'account': return <CloudIcon size={SIZE} color={C.text} />;
    case 'sort':    return <SortIcon size={SIZE - 2} color={C.mutedLight} />;           // botón de orden
    case 'send':    return <ShareIcon size={SIZE - 2} color={C.text} />;                // compartir la sesión
    default:        return null;
  }
}

export default function RichText({ text, style }) {
  const th        = useTheme();
  const C         = th.colors;
  const styles    = useThemedStyles(makeStyles);
  const rowStyles = useThemedStyles(makeRowStyles);

  const inline = (tok, i) => {
    switch (tok.kind) {
      case 'main':
      case 'btn':
        return (
          <View key={i} style={[styles.pill, tok.kind === 'main' && styles.pillMain]}>
            <Text style={[styles.pillText, tok.kind === 'main' && styles.pillMainText]}>{tok.value}</Text>
          </View>
        );
      case 'red':
      case 'blue':
        return <Text key={i} style={[textStyles.bodyStrong, { color: tok.kind === 'red' ? (C.redText ?? C.red) : C.blue }]}>{tok.value}</Text>;
      case 'b':
        return <Text key={i} style={[textStyles.bodyStrong, { color: C.text }]}>{tok.value}</Text>;
      case 'icon':
        // Dibujos de la tarjeta del programa, en pequeño: la barra (un tramo por
        // etapa: hecha, en curso a medias, por hacer) y los tramos de semana.
        if (tok.name === 'bar') return (
          <View key={i} style={[styles.draw, styles.inline]}>
            <View style={styles.bar}>
              <View style={[styles.seg, styles.segDone, { flex: 3 }]} />
              <View style={[styles.seg, { flex: 4 }]}><View style={styles.segFill} /></View>
              <View style={[styles.seg, { flex: 2 }]} />
            </View>
          </View>
        );
        if (tok.name === 'ticks') return (
          <View key={i} style={[styles.draw, styles.inline]}><WeekTicks total={4} on={2} color={C.accent} /></View>
        );
        // La marca de sesiones sin revisar es el globo de la fila de Clientes, con un número de ejemplo.
        return tok.name === 'mark'
          ? <View key={i} style={[rowStyles.cGlobe, styles.inline]}><Text style={rowStyles.cGlobeText}>2</Text></View>
          : <View key={i} style={[styles.icon, styles.inline]}>{inlineIcon(tok.name, th)}</View>;
      default:
        return tok.value;
    }
  };

  return (
    <View>
      {text.split('\n').map((p, i) => (
        <Text key={i} style={[style, i > 0 && styles.next]}>{parseRich(p).map(inline)}</Text>
      ))}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  next:   { marginTop: spacing.sm2 },
  inline: { transform: [{ translateY: NUDGE }] },
  icon:   { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  draw:   { height: SIZE, justifyContent: 'center' },
  // Como la barra de `HomeProgramCard`, en 64 dp.
  bar:     { width: 64, flexDirection: 'row', gap: spacing.xs },
  seg:     { height: spacing.sm, borderRadius: 1, backgroundColor: th.colors.muted, overflow: 'hidden', transform: [{ skewX: '-12deg' }] },
  segDone: { backgroundColor: th.tint.accent50 },
  segFill: { width: '50%', height: '100%', backgroundColor: th.colors.accent },
  pill: {
    height:            SIZE,
    paddingHorizontal: spacing.sm,
    borderRadius:      th.radius.sm,
    backgroundColor:   th.colors.surface,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       th.colors.mutedLight,
    alignItems:        'center',
    justifyContent:    'center',
    transform:         [{ translateY: NUDGE }],
  },
  pillMain:     { backgroundColor: th.colors.accent, borderColor: th.colors.accent },
  pillText:     { ...textStyles.labelStrong, color: th.colors.text, includeFontPadding: false },
  pillMainText: { color: th.colors.onAccent },
});
