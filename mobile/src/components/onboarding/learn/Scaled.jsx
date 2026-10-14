/**
 * Scaled — dibuja `children` a un ancho de diseño (`designWidth`) y lo encoge al
 * ancho que haya. Es lo que permite una miniatura fiel de Inicio sin inventar
 * tamaños de letra: los textos llevan sus roles de `textStyles` de siempre y es
 * el contenedor el que los escala (O03 §16.6).
 *
 * El alto se mide sobre el contenido sin escalar y se multiplica, para que el
 * hueco que ocupa en el flujo sea el de lo que se ve.
 */
import { useState } from 'react';
import { View } from 'react-native';

export default function Scaled({ designWidth, children, style }) {
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);
  const k = w > 0 ? w / designWidth : 0;
  return (
    <View
      style={[{ height: h * k, opacity: k > 0 && h > 0 ? 1 : 0 }, style]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      <View
        style={{
          position: 'absolute', top: 0, left: 0, width: designWidth,
          transformOrigin: 'top left', transform: [{ scale: k || 1 }],
        }}
        onLayout={(e) => setH(e.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </View>
  );
}
