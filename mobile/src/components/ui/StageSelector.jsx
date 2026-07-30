/**
 * StageSelector — variante "Etapas" del Segmented control de Figma (210:3344).
 *
 * No es una prop más de `SegmentedControl`: aquel es la variante "Group
 * together" (1 línea, radius/full, segmentos siempre a ancho igual) y lo usan 4
 * pantallas. Ésta es la de 2 líneas (nombre + nº de ciclos), contenedor
 * radius/md, y añade dos cosas que el otro no tiene ni necesita: scroll
 * horizontal a partir de 5 etapas y un "+" fijo a la derecha.
 *
 * Pulsar la etapa YA activa vuelve a emitir onChange — la pantalla usa esa
 * segunda pulsación para abrir el modal de edición de etapa.
 */
import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { LockIcon } from './EditorIcons';

// Hasta 4 etapas caben repartiéndose el ancho del control. A partir de la 5ª
// cada segmento ocupa el suyo y la fila pasa a scroll horizontal; el "+" queda
// fuera del scroll, siempre visible.
const SCROLL_FROM = 5;

// Al centrar una etapa se deja asomar este trozo de la vecina, para que se lea
// que hay más lista en esa dirección. Sin él, la penúltima etapa acaba pegada al
// borde y parece la última.
const PEEK = 24;

export default function StageSelector({ stages, value, onChange, onAdd }) {
  const styles     = useThemedStyles(makeStyles);
  const th         = useTheme();
  const scrollable = stages.length >= SCROLL_FROM;

  const scrollRef = useRef(null);
  const segRects  = useRef({});  // id → { x, w } dentro del contenido scrollable
  const viewW     = useRef(0);   // ancho visible del ScrollView
  const offsetX   = useRef(0);

  // Deja la etapa `idx` completamente a la vista, más un trozo de la vecina si
  // la hay en esa dirección. Sirve tanto al seleccionar una etapa medio tapada
  // como al añadir una nueva (que entra seleccionada y fuera de pantalla).
  function ensureVisible(idx) {
    const rect = segRects.current[stages[idx]?.id];
    if (!scrollable || !rect || viewW.current === 0) return;
    const peekL = idx > 0                 ? PEEK : 0;
    const peekR = idx < stages.length - 1 ? PEEK : 0;
    let next = offsetX.current;
    if (rect.x - peekL < next) next = rect.x - peekL;
    else if (rect.x + rect.w + peekR > next + viewW.current) {
      next = rect.x + rect.w + peekR - viewW.current;
    }
    if (next === offsetX.current) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, next), animated: true });
  }

  const activeIdx = stages.findIndex((s) => s.id === value);

  // Al cambiar de etapa seleccionada. Si la etapa acaba de crearse todavía no
  // se ha medido: entonces dispara su propio onLayout (ver abajo).
  useEffect(() => { ensureVisible(activeIdx); });

  const segments = stages.map((stage, idx) => {
    const active = stage.id === value;
    return (
      <TouchableOpacity
        key={stage.id}
        // Repartiendo el ancho hasta 4; desde 5, ancho natural (flexShrink:0 —
        // dentro del ScrollView la fila los comprimía igualmente).
        style={[
          styles.segment,
          scrollable ? { flexShrink: 0 } : { flex: 1 },
          active && styles.segmentActive,
        ]}
        onLayout={(e) => {
          const { x, width } = e.nativeEvent.layout;
          segRects.current[stage.id] = { x, w: width };
          if (active) ensureVisible(idx);
        }}
        onPress={() => onChange(stage.id)}
        activeOpacity={0.75}
      >
        <View style={styles.nameRow}>
          {stage.locked && <LockIcon size={11} color={active ? th.colors.onAccent : th.colors.muted} />}
          <Text
            style={[styles.name, active && styles.nameActive, stage.locked && !active && styles.nameLocked]}
            numberOfLines={1}
          >
            {stage.name}
          </Text>
        </View>
        <Text style={[styles.meta, active && styles.metaActive]} numberOfLines={1}>
          {stage.meta}
        </Text>
      </TouchableOpacity>
    );
  });

  return (
    <View style={styles.container}>
      {scrollable ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={{ flex: 1 }}
          scrollEventThrottle={16}
          onScroll={(e) => { offsetX.current = e.nativeEvent.contentOffset.x; }}
          onLayout={(e) => {
            viewW.current = e.nativeEvent.layout.width;
            ensureVisible(activeIdx);
          }}
        >
          {segments}
        </ScrollView>
      ) : (
        segments
      )}
      <TouchableOpacity style={styles.add} onPress={onAdd} activeOpacity={0.75} hitSlop={6}>
        <Text style={styles.addText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.md,   // md (10), no `full` — distinto del segmented de 1 línea
    padding:         spacing.xs2,    // space/xs2 = 4
    gap:             spacing.sm,     // 6 (Figma lo vincula a radius/sm, mismo número)
  },
  scrollContent: { gap: spacing.sm, alignItems: 'stretch' },
  segment: {
    alignItems:        'center',
    justifyContent:    'center',
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.sm2,
    minWidth:          0,
  },
  segmentActive: { backgroundColor: th.colors.accent },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 0 },
  name:       { ...textStyles.cardType, color: th.colors.text, flexShrink: 1 },
  nameActive: { color: th.colors.onAccent },
  nameLocked: { color: th.colors.muted },
  meta:       { ...textStyles.tag, color: th.colors.mutedLight },
  // Sobre el relleno lima, la 2ª línea va en surface2 (Figma) — no en onAccent.
  metaActive: { color: th.colors.surface2 },
  add: {
    width:          26,
    alignItems:     'center',
    justifyContent: 'center',
    alignSelf:      'stretch',
    marginRight:    spacing.xs2,
  },
  addText: {
    ...textStyles.hero,
    color:      th.colors.accent,
    lineHeight: 22,
  },
});
