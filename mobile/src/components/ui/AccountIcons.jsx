/**
 * Los iconos de las formas de entrar a la cuenta del entrenador (maqueta
 * docs/mockups/account.html): los usan la hoja de entrada (`TrainerSyncModal`)
 * y la página «Mi cuenta». Google lleva los colores de su marca; Apple y la
 * llave, el del texto salvo que se pida otro (`color`).
 */
import Svg, { Path, Circle } from 'react-native-svg';

import { useTheme } from '../../useTheme';
import { TwoToneIcon } from './TwoTone';

export const ICON_SIZE = 20;

export function GoogleIcon({ size = ICON_SIZE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5z" />
      <Path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10 10 0 0 0 12 22z" />
      <Path fill="#FBBC05" d="M6.2 13.6a6 6 0 0 1 0-3.8V7.1H2.7a10 10 0 0 0 0 9z" />
      <Path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.5l3-3A10 10 0 0 0 2.7 7.1l3.5 2.7C7 7.8 9.3 6 12 6z" />
    </Svg>
  );
}

export function AppleIcon({ size = ICON_SIZE, color }) {
  const th = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color ?? th.colors.text}>
      <Path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9a5 5 0 0 0-4.2 2.6c-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5a11 11 0 0 0 1.4-2.9 4.5 4.5 0 0 1-2.7-4.1zM13.9 4.9A4.4 4.4 0 0 0 15 1.7a4.6 4.6 0 0 0-3 1.5 4.2 4.2 0 0 0-1 3.1c1.1.1 2.2-.6 2.9-1.4z" />
    </Svg>
  );
}

export function KeyIcon({ size = ICON_SIZE, color }) {
  const th = useTheme();
  return (
    <TwoToneIcon
      size={size} color={color ?? th.colors.text}
      g={<Path d="M11 12l9-9M17 6l3 3M14 9l2 2" />}
      a={<Circle cx="8" cy="15" r="4" />}
    />
  );
}

/** El icono de una forma de entrar: 'google' | 'apple' | 'code'. */
export function ModeIcon({ mode, size, color }) {
  if (mode === 'google') return <GoogleIcon size={size} />;
  if (mode === 'apple')  return <AppleIcon size={size} color={color} />;
  return <KeyIcon size={size} color={color} />;
}
