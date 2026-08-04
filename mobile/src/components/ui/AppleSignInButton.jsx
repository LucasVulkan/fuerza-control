/**
 * AppleSignInButton — el botón oficial de "Continuar con Apple".
 *
 * Apple prohíbe dibujar uno propio: la guía de revisión exige este componente
 * nativo para arrancar el flujo, y `backgroundColor`/`borderRadius` por `style`
 * no funcionan a propósito. Lo único ajustable es `buttonStyle` (blanco, porque
 * el tema es oscuro) y `cornerRadius`, que se iguala al radio de los botones de
 * la app para que no cante al lado del primario.
 *
 * Fuera de iOS no pinta nada.
 */

import * as AppleAuthentication from 'expo-apple-authentication';

import { APPLE_AUTH_AVAILABLE } from '../../services/appleAuth';
import { useTheme } from '../../useTheme';

export default function AppleSignInButton({ onPress, disabled = false, style }) {
  const th = useTheme();
  if (!APPLE_AUTH_AVAILABLE) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={th.radius.sm}
      // Sin alto y ancho explícitos el botón nativo no se ve. 44 es el mismo
      // alto que `primaryBtn` en todas las hojas donde aparece.
      style={[{ width: '100%', height: 44 }, disabled && { opacity: 0.5 }, style]}
      onPress={disabled ? () => {} : onPress}
    />
  );
}
