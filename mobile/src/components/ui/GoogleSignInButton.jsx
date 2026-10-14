/**
 * GoogleSignInButton — «Continuar con Google», a juego con el botón oficial de
 * Apple (`AppleSignInButton`): mismo blanco, alto y radio, para que los dos
 * juntos se lean como una pareja y no como dos piezas de sitios distintos.
 * Es además lo que pide la guía de marca de Google: fondo claro, la «G» a color
 * y el texto en oscuro.
 */
import { TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './Text';
import { GoogleIcon } from './AccountIcons';
import { spacing, textStyles } from '../../theme';
import { useThemedStyles } from '../../useTheme';

// El blanco y el casi negro del botón de Apple (`WHITE`): no son del tema, son de la marca.
const BRAND_BG  = '#ffffff';
const BRAND_INK = '#1f1f1f';

export default function GoogleSignInButton({ onPress, disabled = false, busy = false, style }) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  return (
    <TouchableOpacity
      style={[styles.btn, (disabled || busy) && styles.off, style]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      {busy
        ? <ActivityIndicator color={BRAND_INK} />
        : (
          <>
            <GoogleIcon size={17} />
            <Text style={styles.label}>{t('sync.rowGoogle')}</Text>
          </>
        )}
    </TouchableOpacity>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // 44 de alto y `radius.sm`, los mismos que `AppleSignInButton`.
  btn: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: BRAND_BG,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
  },
  off:   { opacity: 0.5 },
  label: { ...textStyles.itemTitleQuiet, color: BRAND_INK },
});
