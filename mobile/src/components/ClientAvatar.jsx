/**
 * Avatar de cliente (C08-clientes-dashboard.md §3): iniciales sobre su color de
 * identidad y una insignia en la esquina inferior derecha según su vínculo:
 * móvil si entrena con la app, reloj (en gris) si le diste el código y aún no
 * lo ha canjeado. El color es lo que lo reconoce de un vistazo, no la letra.
 */
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Text } from './ui/Text';
import { textStyles, withOpacity, IDENTITY_COLORS } from '../theme';
import { useTheme } from '../useTheme';
import { identityColorOf, initialsOf } from '../utils/identityColor';

const SIZE  = 36;
const BADGE = 19;

export default function ClientAvatar({ client, link = 'none', badgeLabel }) {
  const th    = useTheme();
  const color = IDENTITY_COLORS[th.scheme === 'light' ? 'light' : 'dark'][identityColorOf(client)];
  return (
    <View style={[styles.av, { backgroundColor: withOpacity(color, 0.18) }]}>
      <Text style={[styles.ini, { color }]} numberOfLines={1}>{initialsOf(client.name)}</Text>
      {link !== 'none' && (
        // Fondo de la tarjeta: parece recortada en el avatar.
        <View style={[styles.badge, { backgroundColor: th.colors.surface }]} accessible accessibilityLabel={badgeLabel}>
          <Svg viewBox="0 0 24 24" width={12} height={12} fill="none"
            stroke={link === 'linked' ? th.colors.text : th.colors.mutedLight}
            strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            {link === 'linked'
              ? <Path d="M8.5 2.5h7a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 19V5a2.5 2.5 0 0 1 2.5-2.5zM11 18h2" />
              : <><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3 2" /></>}
          </Svg>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  av: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  ini: { ...textStyles.labelStrong, includeFontPadding: false },
  badge: {
    position: 'absolute', right: -5, bottom: -5,
    width: BADGE, height: BADGE, borderRadius: BADGE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
});
