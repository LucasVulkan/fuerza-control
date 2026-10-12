/**
 * StageCards — la fila de fichas de etapa del editor de programa
 * (docs/specs/P14-editor-etapas.md §3.3).
 *
 * Sin elegir, cada ficha es un cuadrado con su número en Barlow y nada más. La
 * elegida se ensancha y crece hasta decir «ETAPA 2» con el tramo de semanas
 * debajo, y se rellena de lima desde donde la tocó el dedo, como las pestañas
 * de Inicio (U13-02). Al final, un «+».
 *
 * La fila se desplaza con el dedo y se elige TOCANDO: desplazar solo mueve la
 * fila. Si la etapa elegida cambia por otro camino (deslizando la cabecera), la
 * fila se mueve lo justo para enseñarla.
 *
 * Las etapas llegan ya resueltas por la pantalla:
 * `[{ id, number, range, done, deload, locked, now }]`. El nombre no va: ya lo
 * dice la cabecera de debajo.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Pressable, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, interpolate, interpolateColor,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { spacing, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { LockIcon } from './EditorIcons';

const SMALL   = 52;             // la ficha sin elegir: un cuadrado
const OPEN_W  = 92;             // la elegida: cabe «ETAPA 11» y «sem 12-15»
const OPEN_H  = 66;
const GAP     = spacing.sm2;
const PAD     = spacing.lg;     // la fila sale a sangre: el relleno de página va dentro
// El círculo del relleno cubre la ficha abierta desde cualquier punto.
const R       = Math.ceil(Math.hypot(OPEN_W, OPEN_H));
const FILL_MS = 450;            // como el relleno de Inicio por pestañas (U13-02)
const MIN_MS  = 120;

/**
 * Una ficha. Cada una lleva su propio avance, así que ir y volver deprisa sigue
 * desde donde iba. Crece hacia la derecha con el borde izquierdo quieto, así que
 * el punto del dedo sigue valiendo como origen del relleno; si se elige desde
 * fuera (deslizando la cabecera), el relleno sale del centro.
 */
function StageCard({ stage, selected, onPress }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const C      = th.colors;
  const styles = useThemedStyles(makeStyles);
  const p      = useSharedValue(selected ? 1 : 0);
  const [origin, setOrigin] = useState({ x: SMALL / 2, y: SMALL / 2 });

  useEffect(() => {
    const to = selected ? 1 : 0;
    p.set(withTiming(to, {
      duration: Math.max(MIN_MS, FILL_MS * Math.abs(to - p.get())),
      easing:   Easing.out(Easing.cubic),
    }));
  }, [selected, p]);

  const box = useAnimatedStyle(() => ({
    width:  SMALL + (OPEN_W - SMALL) * p.get(),
    height: SMALL + (OPEN_H - SMALL) * p.get(),
  }));
  const circle  = useAnimatedStyle(() => ({ transform: [{ scale: p.get() }] }));
  // El número solo se va antes de que la ficha crezca; «ETAPA N» y el tramo
  // llegan cuando ya hay sitio para ellos.
  const closed  = useAnimatedStyle(() => ({ opacity: interpolate(p.get(), [0, 0.4], [1, 0], 'clamp') }));
  const open    = useAnimatedStyle(() => ({ opacity: interpolate(p.get(), [0.5, 1], [0, 1], 'clamp') }));
  const dotBg   = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.get(), [0, 1], [C.accent, C.onAccent]) }));

  const numColor = stage.deload ? C.blue : stage.done ? C.muted : C.text;

  return (
    <Pressable
      onPressIn={(e) => setOrigin({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY })}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${t('editor.stageWord')} ${stage.number}, ${stage.range}`}
    >
      {({ pressed }) => (
        // Sin toques dentro: así el punto del dedo se mide contra la ficha y no
        // contra el número que hubiera debajo.
        <Reanimated.View pointerEvents="none" style={[styles.card, pressed && styles.cardPressed, box]}>
          <Reanimated.View
            pointerEvents="none"
            style={[
              styles.fill,
              { backgroundColor: C[stage.deload ? 'blue' : 'accent'], left: origin.x - R, top: origin.y - R },
              circle,
            ]}
          />
          <Reanimated.View style={[styles.closed, closed]}>
            <Text style={[styles.num, { color: numColor }]}>{stage.number}</Text>
          </Reanimated.View>
          <Reanimated.View style={[styles.open, open]}>
            <View style={styles.openTop}>
              <Text style={styles.word}>{t('editor.stageWord').toUpperCase()}</Text>
              <Text style={[styles.num, { color: C.onAccent }]}>{stage.number}</Text>
            </View>
            <Text style={styles.range} numberOfLines={1}>{stage.range}</Text>
          </Reanimated.View>
          {stage.locked
            ? <View style={styles.mark}><LockIcon size={10} color={C.redText} solid /></View>
            : stage.now && <Reanimated.View style={[styles.mark, styles.dot, dotBg]} />}
        </Reanimated.View>
      )}
    </Pressable>
  );
}

export default function StageCards({ stages, value, onChange, onAdd }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const scrollRef = useRef(null);
  const offsetX   = useRef(0);
  const viewW     = useRef(0);

  // Solo si la elegida no se ve entera: al tocar una ficha ya visible la fila
  // no debe saltar. Todas las de delante están cerradas, así que su sitio sale
  // sin medir.
  const idx = stages.findIndex((s) => s.id === value);
  useEffect(() => {
    if (idx < 0 || !viewW.current) return;
    const left  = PAD + idx * (SMALL + GAP);
    const right = left + OPEN_W;
    if (left < offsetX.current) scrollRef.current?.scrollTo({ x: left - PAD, animated: true });
    else if (right > offsetX.current + viewW.current) {
      scrollRef.current?.scrollTo({ x: right + PAD - viewW.current, animated: true });
    }
  }, [idx]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.content}
      onLayout={(e) => { viewW.current = e.nativeEvent.layout.width; }}
      onScroll={(e) => { offsetX.current = e.nativeEvent.contentOffset.x; }}
      scrollEventThrottle={16}
    >
      {stages.map((s) => (
        <StageCard key={s.id} stage={s} selected={s.id === value} onPress={() => onChange(s.id)} />
      ))}

      <TouchableOpacity
        style={styles.add}
        onPress={onAdd}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('editor.newStageA11y')}
      >
        <Text style={styles.addText}>+</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  row:     { marginHorizontal: -PAD, flexGrow: 0 },
  // La fila mide lo que la ficha abierta; las cerradas van centradas en ella.
  content: { paddingHorizontal: PAD, gap: GAP, alignItems: 'center', minHeight: OPEN_H },

  card: {
    borderRadius:    14,
    backgroundColor: th.colors.surface,
    overflow:        'hidden',
  },
  cardPressed: { transform: [{ scale: 0.96 }] },
  fill: { position: 'absolute', width: R * 2, height: R * 2, borderRadius: R },

  closed: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  // A ancho fijo de ficha abierta: el texto no se recoloca mientras crece, se
  // destapa.
  open: {
    position:          'absolute',
    left:              0,
    top:               0,
    width:             OPEN_W,
    height:            OPEN_H,
    paddingTop:        9,
    paddingHorizontal: spacing.md,
    paddingBottom:     9,
    justifyContent:    'space-between',
  },
  openTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs2 },
  num:     { ...textStyles.heroName, lineHeight: 28, includeFontPadding: false },
  word:    { ...textStyles.labelStrong, color: withOpacity(th.colors.onAccent, 0.65) },
  range:   { ...textStyles.label, color: withOpacity(th.colors.onAccent, 0.65) },

  mark: { position: 'absolute', top: 7, right: 7 },
  dot:  { width: 7, height: 7, borderRadius: 4 },

  add: {
    width:          SMALL,
    height:         SMALL,
    borderRadius:   14,
    borderWidth:    1.5,
    borderStyle:    'dashed',
    borderColor:    th.colors.muted,
    alignItems:     'center',
    justifyContent: 'center',
  },
  addText: { ...textStyles.title, color: th.colors.accent },
});
