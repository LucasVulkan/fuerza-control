/**
 * StageCards — la fila de fichas de etapa del editor de programa
 * (docs/specs/P14-editor-etapas.md §3.3).
 *
 * Todas las fichas tienen el mismo formato: apilan, centrados, «ETAPA», el número
 * en Barlow y el tramo de semanas. La elegida se rellena de lima desde la esquina
 * de arriba a la derecha, como las pestañas de Inicio (U13-02). Al final, un «+».
 *
 * La fila se desplaza con el dedo y se elige TOCANDO: desplazar solo mueve la
 * fila. Al elegir una del borde, la fila avanza lo justo para que asome la de
 * al lado: así se ve que hay más.
 *
 * Qué ficha va rellena lo dice `sel`, un valor compartido que trae la pantalla
 * (la página del carrusel de cabeceras) y no el render: la nueva se llena y la
 * vieja se vacía en cuanto cambia, sin esperar a que la pantalla se repinte con
 * la etapa nueva (que llega con `value`).
 *
 * Las etapas llegan ya resueltas por la pantalla:
 * `[{ id, number, range, done, deload, locked, now }]`. El nombre no va: ya lo
 * dice la cabecera de debajo.
 */
import { Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler, scrollTo,
  withTiming, Easing, interpolate, interpolateColor,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { spacing, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { LockIcon } from './EditorIcons';

const CARD_W  = 72;             // cabe «sem 12-15»
const CARD_H  = 80;             // ETAPA / número / tramo, apilados
const GAP     = spacing.sm2;
const PAD     = spacing.lg;     // la fila sale a sangre: el relleno de página va dentro
// El círculo del relleno sale de la esquina de arriba a la derecha y cubre la ficha.
const R       = Math.ceil(Math.hypot(CARD_W, CARD_H));
const FILL_MS  = 450;           // como el relleno de Inicio por pestañas (U13-02)
const EMPTY_MS = 200;           // la que se deja se vacía deprisa: no compite con la nueva
// Lo que asoma la ficha vecina cuando la elegida queda en un borde.
const PEEK     = CARD_W / 2;

/**
 * Una ficha. `sel` es el índice de la elegida, en el hilo de UI: la ficha se
 * rellena o se vacía en cuanto cambia, desde donde iba.
 */
function StageCard({ stage, index, sel, selected, onPress }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const C      = th.colors;
  const styles = useThemedStyles(makeStyles);
  const p      = useSharedValue(selected ? 1 : 0);

  useAnimatedReaction(() => sel.get() === index, (on, was) => {
    if (was == null || on === was) return;
    p.set(withTiming(on ? 1 : 0, { duration: on ? FILL_MS : EMPTY_MS, easing: Easing.out(Easing.cubic) }));
  });

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: p.get() }] }));
  // El texto en `onAccent` llega cuando el lima ya cubre casi toda la ficha.
  const off    = useAnimatedStyle(() => ({ opacity: interpolate(p.get(), [0, 0.6], [1, 0], 'clamp') }));
  const on     = useAnimatedStyle(() => ({ opacity: interpolate(p.get(), [0.4, 1], [0, 1], 'clamp') }));
  const dotBg  = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.get(), [0, 1], [C.accent, C.onAccent]) }));

  const numColor = stage.deload ? C.blue : stage.done ? C.muted : C.text;
  const face = (num, small, style) => (
    <Reanimated.View style={[styles.face, style]}>
      <Text style={[styles.word, { color: small }]}>{t('editor.stageWord').toUpperCase()}</Text>
      <Text style={[styles.num, { color: num }]}>{stage.number}</Text>
      <Text style={[styles.range, { color: small }]} numberOfLines={1}>{stage.range}</Text>
    </Reanimated.View>
  );

  return (
    // Con retraso: al desplazar la fila con el dedo encima, la ficha no encoge.
    <Pressable
      onPress={onPress}
      unstable_pressDelay={100}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${t('editor.stageWord')} ${stage.number}, ${stage.range}`}
    >
      {({ pressed }) => (
        <Reanimated.View pointerEvents="none" style={[styles.card, pressed && styles.cardPressed]}>
          <Reanimated.View
            style={[styles.fill, { backgroundColor: C[stage.deload ? 'blue' : 'accent'] }, circle]}
          />
          {face(numColor, C.mutedLight, off)}
          {face(C.onAccent, withOpacity(C.onAccent, 0.65), on)}
          {stage.locked
            ? <Reanimated.View style={styles.mark}><LockIcon size={10} color={C.redText} solid /></Reanimated.View>
            : stage.now && <Reanimated.View style={[styles.mark, styles.dot, dotBg]} />}
        </Reanimated.View>
      )}
    </Pressable>
  );
}

export default function StageCards({ stages, value, sel, onChange, onAdd }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const scrollRef = useAnimatedRef();
  const offsetX   = useSharedValue(0);
  const viewW     = useSharedValue(0);
  const idx       = stages.findIndex((s) => s.id === value);
  const onScroll  = useAnimatedScrollHandler((e) => { offsetX.set(e.contentOffset.x); });

  // En el hilo de UI y en cuanto cambia la elegida (toque o carrusel): la fila
  // se mueve a la vez que la ficha se rellena. Solo si la ficha (y lo que asoma
  // de su vecina) no se ve: al tocar una ya visible la fila no debe saltar.
  // Todas miden lo mismo, así que su sitio sale sin medir; el `ScrollView`
  // recorta lo que pase del final.
  useAnimatedReaction(() => sel.get(), (i, was) => {
    if (was == null || i === was || i < 0 || !viewW.get()) return;
    const left  = PAD + i * (CARD_W + GAP) - GAP - PEEK;
    const right = PAD + i * (CARD_W + GAP) + CARD_W + GAP + PEEK;
    if (left < offsetX.get()) scrollTo(scrollRef, Math.max(0, left), 0, true);
    else if (right > offsetX.get() + viewW.get()) scrollTo(scrollRef, right - viewW.get(), 0, true);
  });

  function press(i) {
    if (i !== idx) onChange(stages[i].id);
  }

  return (
    <Reanimated.ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.content}
      onLayout={(e) => viewW.set(e.nativeEvent.layout.width)}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {stages.map((s, i) => (
        <StageCard key={s.id} stage={s} index={i} sel={sel} selected={i === idx} onPress={() => press(i)} />
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
    </Reanimated.ScrollView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  row:     { marginHorizontal: -PAD, flexGrow: 0 },
  content: { paddingHorizontal: PAD, gap: GAP },

  card: {
    width:           CARD_W,
    height:          CARD_H,
    borderRadius:    14,
    backgroundColor: th.colors.surface,
    overflow:        'hidden',
  },
  cardPressed: { transform: [{ scale: 0.96 }] },
  fill: { position: 'absolute', width: R * 2, height: R * 2, borderRadius: R, left: CARD_W - R, top: -R },

  // Las dos caras (sin elegir y sobre el lima) en el mismo sitio: se funden.
  face: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  // 34 = 1.2 em, lo que pide la Barlow para no cortarse (ver `todayName` en
  // SessionList); y 2 de aire a la derecha para la inclinación de la cursiva.
  // La caja de 34 trae aire arriba y abajo: se recoge para que los tres pisos
  // se lean como una pieza.
  num:   {
    ...textStyles.heroName, lineHeight: 34, includeFontPadding: false, paddingRight: 2,
    marginVertical: -spacing.xs2,
  },
  word:  { ...textStyles.caps },
  range: { ...textStyles.label },

  // A media altura junto al número: arriba está «ETAPA».
  mark: { position: 'absolute', top: CARD_H / 2 - 5, right: 7 },
  dot:  { width: 7, height: 7, borderRadius: 4 },

  add: {
    width:          CARD_W,
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
