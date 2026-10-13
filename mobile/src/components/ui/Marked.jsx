/**
 * Titular con una palabra marcada: lo que va entre asteriscos sale con
 * `accentStyle` (el lima). «Todos tus clientes *sincronizados*».
 * Lo usan el paywall y la hoja de cambio de etapa (U14 §5.4).
 */
import { Text } from './Text';

export default function Marked({ text, style, accentStyle }) {
  return (
    <Text style={style}>
      {/* El estilo del padre también: nuestro `Text` le pone Inter a un estilo
          sin familia, y el lima saldría en otra fuente que el resto. */}
      {text.split('*').map((part, i) => (i % 2 ? <Text key={i} style={[style, accentStyle]}>{part}</Text> : part))}
    </Text>
  );
}
