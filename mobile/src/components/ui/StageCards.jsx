/**
 * StageCards — la fila de tarjetas de etapa del editor de programa
 * (docs/specs/P14-editor-etapas.md §3.3, maqueta `stages-editor-5.html`).
 *
 * Una tarjeta por etapa («Etapa 2», nombre, tramo de semanas y, la en curso,
 * su barrita), y un «+» al final. La fila se desplaza con el dedo y se elige
 * TOCANDO: desplazar solo mueve la fila. Si la etapa elegida cambia por otro
 * camino (deslizando la cabecera), la fila se mueve lo justo para enseñarla.
 *
 * Las etapas llegan ya resueltas por la pantalla:
 * `[{ id, number, name, range, done, deload, locked, progress }]`, con
 * `progress` 0-1 solo en la en curso con límite de semanas (null si no).
 */
import { useEffect, useRef } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { spacing, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { LockIcon } from './EditorIcons';

const CARD_W = 100;
const GAP    = spacing.sm2;
const STEP   = CARD_W + GAP;   // `snapToInterval`: el imán cae al principio de cada tarjeta
const PAD    = spacing.lg;     // la fila sale a sangre: el relleno de página va dentro

export default function StageCards({ stages, value, onChange, onAdd }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const scrollRef = useRef(null);
  const offsetX   = useRef(0);
  const viewW     = useRef(0);

  // Solo si la elegida no se ve entera: al tocar una tarjeta ya visible la fila
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
      {stages.map((s) => {
        const sel  = s.id === value;
        const tone = s.deload ? th.colors.blue : sel ? th.colors.accent : th.colors.mutedLight;
        return (
          <TouchableOpacity
            key={s.id}
            activeOpacity={0.7}
            onPress={() => onChange(s.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            style={[
              styles.card,
              sel && styles.cardSel,
              sel && s.deload && { borderColor: th.colors.blue },
              s.done && !sel && styles.cardDone,
            ]}
          >
            <View style={styles.numRow}>
              <Text style={[styles.num, { color: tone }]} numberOfLines={1}>
                {`${s.done ? '✓ ' : ''}${t('editor.stageNumber', { n: s.number })}`}
              </Text>
              {s.locked && <LockIcon size={10} color={th.colors.redText} solid />}
            </View>
            <Text style={[styles.name, sel && styles.nameSel]} numberOfLines={1}>{s.name}</Text>
            <Text style={[styles.range, sel && styles.rangeSel]} numberOfLines={1}>{s.range}</Text>
            {s.progress != null && (
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.round(s.progress * 100)}%` }]} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}

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
    width:           CARD_W,
    height:          72,
    borderRadius:    12,
    backgroundColor: th.colors.surface,
    paddingTop:      9,
    paddingHorizontal: spacing.sm2,
    paddingBottom:   spacing.sm2,
    borderWidth:     1.5,
    borderColor:     'transparent',
  },
  cardSel:  { borderColor: th.colors.accent, backgroundColor: th.colors.surface2 },
  cardDone: { opacity: 0.55 },

  numRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs2 },
  num:    { ...textStyles.micro, lineHeight: 13, flexShrink: 1 },
  name:   { ...textStyles.labelStrong, lineHeight: 15, color: th.colors.mutedLight, marginTop: spacing.sm },
  nameSel: { color: th.colors.text },
  range:  { ...textStyles.micro, lineHeight: 13, color: th.colors.muted, marginTop: spacing.xs },
  rangeSel: { color: th.colors.mutedLight },

  bar: {
    marginTop:       'auto',
    height:          3,
    borderRadius:    2,
    backgroundColor: withOpacity(th.colors.accent, 0.18),
    overflow:        'hidden',
  },
  barFill: { height: '100%', backgroundColor: th.colors.accent },

  add: {
    width:          46,
    height:         72,
    borderRadius:   12,
    borderWidth:    1.5,
    borderStyle:    'dashed',
    borderColor:    th.colors.border,
    alignItems:     'center',
    justifyContent: 'center',
  },
  addText: { ...textStyles.title, color: th.colors.accent },
});
