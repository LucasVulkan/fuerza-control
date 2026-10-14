/**
 * HomeViewWireframe — las dos vistas de Inicio en esquema, para elegir en
 * «¿Cómo quieres ver tus sesiones?» (O03 §11.2). Solo contornos y barras grises;
 * lo único real son las letras de las sesiones. Así se lee como un dibujo de cómo
 * será Inicio y no como algo que se pueda pulsar (14-oct, decisión del usuario).
 * La miniatura fiel (`HomeViewPreview`) se queda para las tarjetas de Aprende.
 *
 *   view     'cards' | 'tabs'
 *   letters  ['A', 'B', 'C', …] — la primera es la que toca
 */
import { View, StyleSheet } from 'react-native';

import { Text } from '../../ui/Text';
import { spacing, textStyles } from '../../../theme';
import { useThemedStyles } from '../../../useTheme';

const MAX = 4;   // más sesiones no aportan nada al esquema

function Bar({ w, thick = false }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.bar, thick && styles.barThick, { width: w }]} />;
}

function ListWire({ letters }) {
  const styles = useThemedStyles(makeStyles);
  const [first, ...rest] = letters;
  return (
    <View style={styles.stack}>
      <View style={[styles.box, styles.boxOn]}>
        <View style={styles.row}>
          <Text style={styles.letter}>{first}</Text>
          <Bar w="55%" thick />
        </View>
        <Bar w="35%" />
        <View style={styles.btn} />
      </View>
      {rest.map((l, i) => (
        <View key={l} style={[styles.box, styles.row]}>
          <Text style={styles.letter}>{l}</Text>
          <Bar w={['45%', '55%', '40%'][i % 3]} thick />
        </View>
      ))}
    </View>
  );
}

function TabsWire({ letters }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View>
      <View style={styles.tabs}>
        {letters.map((l, i) => (
          <View key={l} style={[styles.tab, i === 0 && styles.tabOn]}>
            <Text style={styles.letter}>{l}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.box, styles.boxOn, styles.tabCard]}>
        <Bar w="55%" thick />
        <Bar w="35%" />
        <View style={styles.btn} />
      </View>
    </View>
  );
}

export default function HomeViewWireframe({ view, letters }) {
  const shown = letters.slice(0, MAX);
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      {view === 'tabs' ? <TabsWire letters={shown} /> : <ListWire letters={shown} />}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  stack: { gap: spacing.xs },
  box: {
    borderWidth:  1.5,
    borderColor:  th.colors.muted,
    borderRadius: th.radius.sm,
    padding:      spacing.sm,
    gap:          spacing.xs + 2,
  },
  // La que toca: el contorno en el color de la app, como el lima de Inicio.
  boxOn: { borderColor: th.colors.accent },
  row:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  letter: { ...textStyles.title, color: th.colors.accent, lineHeight: 22, includeFontPadding: false, minWidth: 16 },
  bar:      { height: 6, borderRadius: 3, backgroundColor: th.colors.surface2 },
  barThick: { height: 9, borderRadius: 4.5 },
  btn: {
    height:       22,
    borderRadius: th.radius.sm,
    borderWidth:  1.5,
    borderColor:  th.colors.muted,
    marginTop:    2,
  },
  tabs: { flexDirection: 'row', gap: spacing.xs },
  tab: {
    width:                36,
    height:               28,
    alignItems:           'center',
    justifyContent:       'center',
    borderWidth:          1.5,
    borderBottomWidth:    0,
    borderColor:          th.colors.muted,
    borderTopLeftRadius:  th.radius.sm,
    borderTopRightRadius: th.radius.sm,
  },
  tabOn:   { borderColor: th.colors.accent },
  tabCard: { borderTopLeftRadius: 0 },
});
