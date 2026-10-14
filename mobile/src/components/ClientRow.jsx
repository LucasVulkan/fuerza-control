/**
 * ClientRow — la fila de la lista de Clientes (C08-clientes-dashboard.md §3-4),
 * solo el dibujo: avatar con su color e insignia, nombre, 2.ª línea, cuadraditos
 * de la semana, última vez, muesca de «sin revisar» y el botón de la derecha.
 *
 * Salió de `ClientListCard` (`ClientsScreen`) sin cambiar un píxel para que la
 * pinten también el recorrido de entrada (O03 §22.1) con datos fijos. Quien la
 * usa calcula lo que enseña —`ClientListCard` lo saca del programa y del
 * historial reales— y aquí solo se pinta.
 *
 *   client      { name, color… } — el avatar saca de aquí iniciales y color
 *   link        'linked' (móvil) | 'invited' (reloj) | 'none'
 *   meta        la 2.ª línea: { text, color?, tail?, tailStrong?, more? }
 *                 `color`: es un aviso (negrita de ese color) · `tail`: lo que va
 *                 tras « · » (la semana de la etapa) · `more`: «+N» avisos más
 *   week        null | { total, done, extra, last: { text, today } } — los
 *                 cuadraditos y la última vez; solo si la fila no lleva botón
 *   cta         null | { label, icon, color, onPress } — el botón (`CtaIcon`)
 *   unread      sesiones sin revisar: globo delante del botón o muesca en la esquina
 *   lens        null | 'adh' | 'imp' con su `lensValue` (§5.2): la cifra a la derecha
 *   radii       las esquinas que pone la lista (bloque agrupado)
 *   glowStyle   estilo animado del destello de «Pendientes» (§5.2)
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Reanimated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Text } from './ui/Text';
import ClientAvatar from './ClientAvatar';
import { useTheme, useThemedStyles } from '../useTheme';
import { makeRowStyles } from './clientRowStyles';

// Iconos de 15 px de los botones de la fila (C08-clientes-dashboard.md §4.3),
// sólidos. El color va en el icono, el del aviso al que responde: el fondo del
// botón es neutro. Cada trazo es `fill` (relleno, con un borde fino del mismo
// color y uniones redondas: puntas apenas redondeadas), `line` (trazo) o `cut`
// (trazo del color del botón, que «recorta» el relleno).
const CTA_ICON = {
  play:   [{ fill: 'M8 5.5v13l10.5-6.5z' }],
  add:    [{ fill: 'M10.5 4.5h3v6h6v3h-6v6h-3v-6h-6v-3h6z' }],
  send:   [{ fill: 'M12 3l6.5 7H14v5.5h-4V10H5.5z' }, { fill: 'M5 18.5h14V21H5z' }],
  unlock: [{ line: 'M8 11V7.5a4 4 0 0 1 7.6-1.7' }, { fill: 'M5 11h14v10H5z' }],
  plan:   [{ line: 'M8 3v4M16 3v4' }, { fill: 'M4 6h16v14H4z' }, { cut: 'M12 10.5v6M9 13.5h6' }],
};

export function CtaIcon({ name, color, bg }) {
  return (
    <Svg viewBox="0 0 24 24" width={15} height={15} strokeLinecap="round" strokeLinejoin="round">
      {CTA_ICON[name].map((p, i) => (
        p.fill ? <Path key={i} d={p.fill} fill={color} stroke={color} strokeWidth={1.5} />
        : p.line ? <Path key={i} d={p.line} fill="none" stroke={color} strokeWidth={2.4} />
        : <Path key={i} d={p.cut} fill="none" stroke={bg} strokeWidth={2.2} />
      ))}
    </Svg>
  );
}

export default function ClientRow({
  client, link = 'none', badgeLabel, radii, frozen = false, dimmed = false,
  meta, week = null, cta = null, unread = 0, lens = null, lensValue = null,
  glowStyle, onPress, onLongPress, onViewUnreviewed,
}) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeRowStyles);
  const C      = th.colors;
  const showNotch = !!week && unread > 0;

  return (
    <TouchableOpacity
      style={[styles.cCard, radii, frozen && styles.cCardFrozen]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.75}
    >
      {glowStyle && <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, radii, styles.cGlow, glowStyle]} />}
      {/* Insignia del avatar (C08 §3.4): móvil con app, reloj si aún no ha
          canjeado el código. Sin app, nada: es el caso normal del presencial. */}
      <ClientAvatar client={client} link={link} badgeLabel={badgeLabel} />

      <View style={styles.cContent}>
        {/* Línea 1: nombre ··· cuadraditos de la semana. Van aquí y no abajo
            para que con 6-7 sesiones no se peguen a la línea del programa. */}
        <View style={styles.cLine}>
          <Text style={[styles.cName, (dimmed || frozen) && styles.cNameDim]} numberOfLines={1}>{client.name}</Text>
          {week && (
            <View style={styles.cSegs}>
              {Array.from({ length: week.total }, (_, i) => (
                <View key={i} style={[styles.cSeg, i < week.done && styles.cSegOn]} />
              ))}
              {week.extra > 0 && <Text style={styles.cExtra}>+{week.extra}</Text>}
            </View>
          )}
        </View>

        {/* Línea 2: el aviso, o programa · etapa · semana ··· la última vez. */}
        <View style={styles.cLine}>
          <Text style={[styles.cMeta, meta.color && [styles.cAviso, { color: meta.color }]]} numberOfLines={1}>
            {meta.text}
            {meta.tail ? <>{' · '}{meta.tailStrong ? <Text style={styles.cMetaStrong}>{meta.tail}</Text> : meta.tail}</> : null}
            {meta.more > 0 && <Text style={styles.cMore}>{`  +${meta.more}`}</Text>}
          </Text>
          {week && !showNotch && (
            <Text style={[styles.cLast, week.last.today && styles.cMetaStrong]}>{week.last.text}</Text>
          )}
        </View>
      </View>

      {cta && (
        <View style={styles.cRight}>
          {/* Sin revisar en una fila con botón: el globo va delante (§4.5). */}
          {unread > 0 && (
            <TouchableOpacity onPress={onViewUnreviewed} hitSlop={8} style={styles.cGlobe}>
              <Text style={styles.cGlobeText}>{unread}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cCta} onPress={cta.onPress} activeOpacity={0.85}>
            <CtaIcon name={cta.icon} color={cta.color} bg={C.surface3 ?? C.surface2} />
            <Text style={styles.cCtaText}>{cta.label}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lente (§5.2): la cifra de este cliente en lo que se está comparando. */}
      {lens && (() => {
        const v = lensValue;
        if (v == null) return <View style={styles.cLens}><Text style={[styles.cLensNum, { color: C.muted }]}>—</Text></View>;
        const tone = lens === 'adh'
          ? (v < 60 ? C.redText ?? C.red : v < 75 ? C.orange : null)
          : (v > 0 ? C.accent : C.mutedLight);
        return (
          <View style={styles.cLens}>
            <View style={styles.cLensRow}>
              <Text style={[styles.cLensNum, { color: tone ?? C.text }]}>{lens === 'imp' && v > 0 ? '+' : ''}{v}</Text>
              <Text style={styles.cLensUnit}>%</Text>
            </View>
            {lens === 'adh' && (
              <View style={styles.cLensBar}>
                <View style={[styles.cLensFill, { width: `${Math.min(100, v)}%`, backgroundColor: tone ?? C.accent }]} />
              </View>
            )}
          </View>
        );
      })()}

      {/* Sin revisar: muesca metida en la esquina, con su radio (§4.5). Tapa la
          última vez, que es por fuerza la de esos entrenos. */}
      {showNotch && (
        <TouchableOpacity
          style={[styles.cNotch, { borderBottomRightRadius: radii?.borderBottomRightRadius ?? th.radius.md }]}
          onPress={onViewUnreviewed}
          hitSlop={8}
          accessibilityLabel={t('clients.unreviewedSessions', { count: unread })}
        >
          <Text style={styles.cNotchText}>{unread}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
