/**
 * HomeViewPreview — Inicio en miniatura (O03 §11.2, §22). Las dos vistas de
 * `profile.homeView`: la lista de sesiones (`SessionList`, U04) y la tarjeta con
 * pestañas (`SessionTabsCard`, U13), dibujadas con sus mismos tokens, glifos y
 * medidas a 358 de ancho y escaladas al hueco (`Scaled`), no con tamaños propios.
 *
 *   view      'cards' | 'tabs'
 *   sessions  [{ marker, name, exercises, minutes }] — la primera es la que toca
 *   spot      null | 'start' (EMPEZAR late y se toca) | 'free' (el botón de sesión libre)
 *   touchable las pestañas se tocan (la lista nunca: solo se mira)
 *   onTab     (i) al tocar una pestaña
 *
 * Las pestañas repiten la geometría de `SessionTabsCard` (`tabPath`, medida sobre
 * la maqueta del usuario): ese fichero no la exporta. Sin el relleno que crece
 * desde la pestaña: aquí el color de la tarjeta solo se funde.
 */
import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, interpolateColor,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Text, MAX_FONT_SCALE } from '../../ui/Text';
import { spacing, textStyles, withOpacity } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { StartButton, HeroChevron, SectionHeader } from '../../SessionList';
import Scaled from './Scaled';
import Spot from './Spot';

const W = 358;   // el ancho de una tarjeta de Inicio en un móvil de 390

// ── Geometría de las pestañas (SessionTabsCard §3.2) ─────────────────────────
const TAB_H  = 43;
const PITCH  = 54;
const SLANT  = 6;
const GAP    = 1.5;
const CORNER = 6;
const LEFT   = -10;
const CHEV_W = 44;

const along = ([x1, y1], [x2, y2], d) => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  return [x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len];
};
const pt = ([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`;

/** El paralelogramo de la pestaña `i`: arriba recto, abajo con las esquinas redondas. */
function tabPath(i, pitch) {
  const bl = [LEFT + i * pitch, TAB_H];
  const br = [LEFT + (i + 1) * pitch - GAP, TAB_H];
  const tr = [br[0] + SLANT, 0];
  const tl = [bl[0] + SLANT, 0];
  return `M${pt(tl)} L${pt(tr)} L${pt(along(br, tr, CORNER))} Q${pt(br)} ${pt(along(br, bl, CORNER))}`
    + ` L${pt(along(bl, br, CORNER))} Q${pt(bl)} ${pt(along(bl, tl, CORNER))} Z`;
}

/** Centro visible de la pestaña `i` a media altura (la primera la corta el borde). */
function tabCenter(i, pitch) {
  const left  = Math.max(0, LEFT + i * pitch + SLANT / 2);
  const right = LEFT + (i + 1) * pitch - GAP + SLANT / 2;
  return (left + right) / 2;
}

// ── Lista (U04 §5) ───────────────────────────────────────────────────────────

function ListView({ sessions, spot }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [hero, ...rest] = sessions;
  return (
    <View>
      <SectionHeader label={t('home.sessions').toUpperCase()} />
      <View style={styles.group}>
        {hero && (
          <View style={styles.today}>
            <View style={styles.todayHead}>
              <Text style={styles.todayFlag} numberOfLines={1}>{t('home.sessionNext')}</Text>
              <View style={styles.todayHeadRow}>
                <Text style={styles.todayGlyph}>{hero.marker}</Text>
                <Text style={styles.todayName} numberOfLines={2}>{hero.name}</Text>
              </View>
              <View style={styles.todayRule} />
              <Text style={styles.todayMeta} numberOfLines={1}>
                {t('home.sessionMeta', { count: hero.exercises, minutes: hero.minutes })} · {t('home.firstTime').toLowerCase()}
              </Text>
            </View>
            <View style={styles.todayFoot}>
              <StartBtn hero spot={spot === 'start'} label={t('home.btnStartSession', { label: hero.marker })} ring={th.colors.text} />
            </View>
          </View>
        )}
        {rest.map((s) => (
          <View key={s.marker + s.name} style={styles.sesCard}>
            <View style={styles.sesHead}>
              <Text style={styles.sesGlyph}>{s.marker}</Text>
              <Text style={styles.sesName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.sesMeta} numberOfLines={1}>{t('home.rowMinutes', { minutes: s.minutes })}</Text>
            </View>
          </View>
        ))}
      </View>
      {spot === 'free' && <FreeBtn />}
    </View>
  );
}

/** «+ Sesión libre», el botón de debajo de la lista, resaltado. */
function FreeBtn() {
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Spot radius={th.radius.md} finger={{ right: 28, bottom: -10 }} style={styles.freeWrap}>
      <View style={styles.freeBtn}><Text style={styles.freeBtnText}>{t('freeSession.btn')}</Text></View>
    </Spot>
  );
}

/** EMPEZAR, resaltado o no. El aro lleva `ring` si la tarjeta es lima (el lima no se vería). */
function StartBtn({ hero, spot, label, ring }) {
  const th = useTheme();
  const btn = <StartButton hero={hero} label={label} onPress={() => {}} />;
  if (!spot) return btn;
  return (
    <Spot radius={th.radius.md} color={hero ? ring : undefined} finger={{ right: 18, bottom: -8 }} style={fixed.spotRow}>
      {btn}
    </Spot>
  );
}

// ── Pestañas (U13) ───────────────────────────────────────────────────────────

function TabsView({ sessions, spot, touchable, onTab }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const C      = th.colors;
  const styles = useThemedStyles(makeStyles);
  const [sel, setSel] = useState(0);
  const lime = useSharedValue(1);   // 1 = la que toca está abierta (tarjeta lima)

  const n     = sessions.length;
  const pitch = Math.min(PITCH, (W - CHEV_W - LEFT - SLANT) / Math.max(n, 1));
  const heroSel = sel === 0;
  const s = sessions[sel] ?? sessions[0];

  const card    = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(lime.get(), [0, 1], [C.surface, C.accent]) }));
  const ink     = useAnimatedStyle(() => ({ color: interpolateColor(lime.get(), [0, 1], [C.text, C.onAccent]) }));
  // Fuera del worklet: `withOpacity` es JS normal y en el hilo de UI no existe.
  const metaOn  = withOpacity(C.onAccent, 0.55);
  const metaInk = useAnimatedStyle(() => ({ color: interpolateColor(lime.get(), [0, 1], [C.mutedLight, metaOn]) }));

  function pick(i) {
    setSel(i);
    lime.set(withTiming(i === 0 ? 1 : 0, { duration: 350, easing: Easing.out(Easing.cubic) }));
    onTab?.(i);
  }

  if (!s) return null;
  return (
    <View>
      <SectionHeader label={t('home.sessions').toUpperCase()} />
      <Reanimated.View style={[styles.tcard, card]}>
        <View style={styles.strip}>
          <Svg width={W} height={TAB_H} style={StyleSheet.absoluteFill} pointerEvents="none">
            {sessions.map((x, i) => (i === sel ? null : (
              <Path key={x.marker + i} d={tabPath(i, pitch)} fill={i === 0 ? C.accent : (C.surface3 ?? C.border)} />
            )))}
          </Svg>
          {sessions.map((x, i) => {
            const color = i === 0 ? C.onAccent : i === sel ? C.accent : C.text;
            return (
              <Pressable
                key={x.marker + i}
                disabled={!touchable}
                onPress={() => pick(i)}
                accessibilityRole="tab"
                accessibilityState={{ selected: i === sel }}
                style={[styles.glyphBox, { left: tabCenter(i, pitch) - pitch / 2, width: pitch }]}
              >
                <Text style={[styles.glyph, { color }]}>{x.marker}</Text>
              </Pressable>
            );
          })}
          <View pointerEvents="none" style={styles.chevron}>
            <HeroChevron size={14} color={heroSel ? C.onAccent : C.mutedLight} />
          </View>
        </View>
        <View style={styles.tbody}>
          <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.ttitle, ink]} numberOfLines={2}>{s.name}</Reanimated.Text>
          <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.tmeta, metaInk]} numberOfLines={1}>
            {t('home.sessionMeta', { count: s.exercises, minutes: s.minutes }).toUpperCase()}
          </Reanimated.Text>
          <View style={styles.btnRow}>
            <StartBtn hero={heroSel} spot={spot === 'start'} label={t('home.btnStartSession', { label: s.marker })} ring={C.text} />
          </View>
        </View>
      </Reanimated.View>
      {spot === 'free' && <FreeBtn />}
    </View>
  );
}

export default function HomeViewPreview({ view, sessions, spot = null, touchable = false, onTab }) {
  return (
    <Scaled designWidth={W}>
      {view === 'tabs'
        ? <TabsView sessions={sessions} spot={spot} touchable={touchable} onTab={onTab} />
        // La lista solo se mira: sin toques.
        : <View pointerEvents="none"><ListView sessions={sessions} spot={spot} /></View>}
    </Scaled>
  );
}

// Los números salen de `SessionList` (`makeStyles`: sesCard, today…) y de
// `SessionTabsCard` (body, title, meta); si cambian allí, aquí también.
const fixed = StyleSheet.create({
  spotRow: { flex: 1, flexDirection: 'row' },
});

const makeStyles = (th) => StyleSheet.create({
  group: { gap: spacing.xs2 },

  // La que toca hoy
  today: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
    marginVertical:  spacing.xs2,
  },
  todayHead:    { paddingTop: 14, paddingHorizontal: spacing.lg, paddingBottom: 11 },
  todayHeadRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: spacing.sm },
  todayGlyph: {
    ...textStyles.heroGlyph,
    lineHeight:         39,
    includeFontPadding: false,
    width:              27,
    color:              th.colors.onAccent,
  },
  todayFlag: {
    ...textStyles.caps,
    textTransform: 'uppercase',
    color:         withOpacity(th.colors.onAccent, 0.55),
  },
  todayName: {
    ...textStyles.heroName,
    lineHeight:         34,
    includeFontPadding: false,
    color:              th.colors.onAccent,
    flex:               1,
  },
  todayRule: {
    height:          2,
    borderRadius:    2,
    backgroundColor: withOpacity(th.colors.onAccent, 0.85),
    marginTop:       11,
  },
  todayMeta: {
    ...textStyles.caps,
    marginTop:     spacing.sm,
    textTransform: 'uppercase',
    color:         withOpacity(th.colors.onAccent, 0.55),
  },
  todayFoot: {
    flexDirection:     'row',
    gap:               spacing.sm,
    paddingTop:        11,
    paddingHorizontal: 14,
    paddingBottom:     14,
  },

  // Las demás
  sesCard: { backgroundColor: th.colors.surface, borderRadius: th.radius.md, overflow: 'hidden' },
  sesHead: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 60, paddingHorizontal: 14 },
  sesGlyph: {
    ...textStyles.title,
    lineHeight:         22,
    includeFontPadding: false,
    minWidth:           24,
    fontVariant:        ['tabular-nums'],
    color:              th.colors.accent,
  },
  sesName: { ...textStyles.itemTitle, flex: 1, color: th.colors.text },
  sesMeta: { ...textStyles.label, color: th.colors.muted },

  // «+ Sesión libre»
  freeWrap:    { marginTop: spacing.md },
  freeBtn: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius:      th.radius.md,
    borderWidth:       0.5,
    borderColor:       th.tint.accent50,
    alignItems:        'center',
  },
  freeBtnText: { ...textStyles.button, color: th.colors.accent },

  // La tarjeta con pestañas
  tcard:  { borderRadius: th.radius.md, overflow: 'hidden' },
  strip:  { height: TAB_H },
  glyphBox: { position: 'absolute', top: 0, height: TAB_H, alignItems: 'center', justifyContent: 'center' },
  glyph: {
    ...textStyles.heroName,
    textTransform:      'uppercase',
    lineHeight:         34,
    includeFontPadding: false,
  },
  chevron: { position: 'absolute', right: 0, top: 0, width: CHEV_W, height: TAB_H, alignItems: 'center', justifyContent: 'center' },
  tbody:  { paddingHorizontal: 11, paddingTop: spacing.md, paddingBottom: spacing.lg },
  ttitle: { ...textStyles.heroName, lineHeight: 34, includeFontPadding: false },
  tmeta:  { ...textStyles.caps, marginTop: spacing.xs },
  btnRow: { flexDirection: 'row', marginTop: 12 },
});
