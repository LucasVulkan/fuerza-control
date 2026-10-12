/**
 * StageCards — la fila de fichas de etapa del editor de programa
 * (docs/specs/P14-editor-etapas.md §3.3, maqueta `stages-editor-6.html`, C).
 *
 * Una ficha por etapa con su número grande en Barlow, «ETAPA» pequeño pegado
 * detrás y el tramo de semanas debajo; un «+» al final. Es la voz del onboarding
 * y del paywall: elegida, se rellena de lima desde donde la tocó el dedo, como
 * las pestañas de Inicio (U13-02). La fila se desplaza con el dedo y se elige
 * TOCANDO: desplazar solo mueve la fila. Si la etapa elegida cambia por otro
 * camino (deslizando la cabecera), la fila se mueve lo justo para enseñarla.
 *
 * Las etapas llegan ya resueltas por la pantalla:
 * `[{ id, number, range, done, deload, locked, now }]`. El nombre no va: la
 * tarjeta de la v5 era pequeña para tanto texto, y el nombre ya lo dice la
 * cabecera de debajo.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Pressable, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, interpolateColor,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text, MAX_FONT_SCALE } from './Text';
import { spacing, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { LockIcon } from './EditorIcons';

const CARD_W  = 88;
const CARD_H  = 66;
const GAP     = spacing.sm2;
const STEP    = CARD_W + GAP;   // `snapToInterval`: el imán cae al principio de cada ficha
const PAD     = spacing.lg;     // la fila sale a sangre: el relleno de página va dentro
// El círculo del relleno cubre la ficha desde cualquier punto: su radio es la diagonal.
const R       = Math.ceil(Math.hypot(CARD_W, CARD_H));
const FILL_MS = 450;            // como el relleno de Inicio por pestañas (U13-02)
const MIN_MS  = 120;

/** Color que pasa de `off` a `on` al paso del relleno. */
function useInk(p, off, on, prop = 'color') {
  return useAnimatedStyle(() => ({ [prop]: interpolateColor(p.get(), [0, 1], [off, on]) }));
}

/**
 * Una ficha. Cada una lleva su propio avance, así que ir y volver deprisa sigue
 * desde donde iba. El relleno sale del último punto donde se la tocó; si se
 * elige desde fuera (deslizando la cabecera), del centro.
 */
function StageCard({ stage, selected, onPress }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const C      = th.colors;
  const styles = useThemedStyles(makeStyles);
  const p      = useSharedValue(selected ? 1 : 0);
  const [origin, setOrigin] = useState({ x: CARD_W / 2, y: CARD_H / 2 });

  useEffect(() => {
    const to = selected ? 1 : 0;
    p.set(withTiming(to, {
      duration: Math.max(MIN_MS, FILL_MS * Math.abs(to - p.get())),
      easing:   Easing.out(Easing.cubic),
    }));
  }, [selected, p]);

  const fill = C[stage.deload ? 'blue' : 'accent'];
  const numOff = stage.deload ? C.blue : stage.done ? C.muted : C.text;
  const numInk  = useInk(p, numOff, C.onAccent);
  const smallInk = useInk(p, C.mutedLight, withOpacity(C.onAccent, 0.65));
  const dotBg   = useInk(p, C.accent, C.onAccent, 'backgroundColor');
  const circle  = useAnimatedStyle(() => ({ transform: [{ scale: p.get() }] }));

  return (
    <Pressable
      onPressIn={(e) => setOrigin({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY })}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${t('editor.stageWord')} ${stage.number}, ${stage.range}`}
    >
      <Reanimated.View
        pointerEvents="none"
        style={[styles.fill, { backgroundColor: fill, left: origin.x - R, top: origin.y - R }, circle]}
      />
      <View style={styles.top}>
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.num, numInk]}>
          {stage.number}
        </Reanimated.Text>
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.word, smallInk]}>
          {t('editor.stageWord').toUpperCase()}
        </Reanimated.Text>
      </View>
      <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.range, smallInk]} numberOfLines={1}>
        {stage.range}
      </Reanimated.Text>
      {stage.locked
        ? <View style={styles.mark}><LockIcon size={10} color={C.redText} solid /></View>
        : stage.now && <Reanimated.View style={[styles.mark, styles.dot, dotBg]} />}
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
  // no debe saltar.
  const idx = stages.findIndex((s) => s.id === value);
  useEffect(() => {
    if (idx < 0 || !viewW.current) return;
    const left  = PAD + idx * STEP;
    const right = left + CARD_W;
    if (left < offsetX.current) scrollRef.current?.scrollTo({ x: idx * STEP, animated: true });
    else if (right > offsetX.current + viewW.current) {
      scrollRef.current?.scrollTo({ x: right + PAD - viewW.current, animated: true });
    }
  }, [idx]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={STEP}
      snapToAlignment="start"
      decelerationRate="fast"
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
  content: { paddingHorizontal: PAD, gap: GAP },

  card: {
    width:             CARD_W,
    height:            CARD_H,
    borderRadius:      14,
    backgroundColor:   th.colors.surface,
    paddingTop:        9,
    paddingHorizontal: spacing.md,
    paddingBottom:     9,
    justifyContent:    'space-between',
    overflow:          'hidden',
  },
  cardPressed: { transform: [{ scale: 0.96 }] },
  fill: { position: 'absolute', width: R * 2, height: R * 2, borderRadius: R },

  // Número y «ETAPA» por la base: la palabra, más baja, deja libre la esquina
  // de arriba a la derecha para el punto o el candado.
  top:   { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs2 },
  num:   { ...textStyles.heroName, lineHeight: 28, includeFontPadding: false },
  word:  { ...textStyles.labelStrong },
  range: { ...textStyles.label },

  mark: { position: 'absolute', top: 9, right: 9 },
  dot:  { width: 7, height: 7, borderRadius: 4 },

  add: {
    width:          46,
    height:         CARD_H,
    borderRadius:   14,
    borderWidth:    1.5,
    borderStyle:    'dashed',
    borderColor:    th.colors.muted,
    alignItems:     'center',
    justifyContent: 'center',
  },
  addText: { ...textStyles.title, color: th.colors.accent },
});
