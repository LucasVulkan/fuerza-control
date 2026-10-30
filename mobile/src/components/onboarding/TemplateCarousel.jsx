/**
 * TemplateCarousel — las plantillas propuestas en un carrusel horizontal con snap
 * (O04-04, spec §5, maqueta docs/mockups/onboarding-m05.html). La elegida es la
 * centrada y los puntos de debajo dicen cuál es; quien confirma («Empezar con
 * esta») es el pie de la pantalla, que recibe el índice por `onIndex`.
 *
 * Toda la tarjeta se pulsa para pasar de la portada a los ejercicios y de vuelta;
 * el selector de sesión y la lista de ejercicios capturan su toque. Debajo del
 * carrusel, `TemplateList` ofrece el resto de plantillas como filas.
 *
 * Cada tarjeta tiene dos caras: la portada (zona de color con la etiqueta de
 * encaje, el número de sesiones como marca de agua, el nombre y la semana
 * sugerida; debajo el resumen, tres cifras y las series por semana por grupo) y
 * los ejercicios (selector de sesión + lista). Todo se calcula del programa ya
 * ajustado a las respuestas (`templateCards.js`).
 */
import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import Reanimated, { FadeIn, useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useStore, normalizeOnboardingAnswers } from '../../../store/useStore';
import { adaptArchetype } from '../../utils/archetypeAdapter';
import { resolveColor } from '../../themes';
import { spacing, textStyles, lh, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { Text } from '../ui/Text';
import { FlowOption } from './flow';
import { cardModel } from './templateCards';
import { exerciseName } from './proposalData';

const CARD_MAX_W = 300;
const CARD_MAX_H = 520;
const CARD_MIN_H = 460;
const CHROME_H   = 340;   // lo que ocupan cabecera, título, puntos y pie: el resto es de la tarjeta
const GAP        = spacing.md;
const HEAD_H     = 152;
const GUTTER     = spacing.lg + 1;   // el de `FlowBody`: el carrusel sale de él a sangre
// Una por posición: la primera (la que mejor encaja) en el color de la marca.
const COLORS = ['var(--day1)', 'var(--day2)', 'var(--day4)', 'var(--day3)'];

function Dot({ on }) {
  const th = useTheme();
  const w = useSharedValue(on ? 18 : 6);
  useEffect(() => { w.set(withTiming(on ? 18 : 6, { duration: 250, easing: Easing.out(Easing.cubic) })); }, [on, w]);
  const anim = useAnimatedStyle(() => ({ width: w.get() }));
  return <Reanimated.View style={[{ height: 6, borderRadius: 3, backgroundColor: on ? th.colors.accent : th.colors.surface3 }, anim]} />;
}

function Card({ card, index, width, height, allEx, language }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [ex, setEx]   = useState(false);
  const [ses, setSes] = useState(0);

  const { entry, sessions, minutes, weeks, groups, week } = card;
  const color  = resolveColor(th, COLORS[index % COLORS.length]);
  const ink    = th.colors.onAccent;
  const days   = t('onboardingFlow.self.cards.weekDays');
  const max    = Math.max(1, ...groups.map((g) => g[1]));
  const session = sessions[Math.min(ses, sessions.length - 1)];
  const lettersOnly = sessions.length > 3;   // con más de tres no cabe la palabra «Sesión»

  return (
    <Pressable onPress={() => setEx((v) => !v)} accessibilityRole="button" style={[styles.card, { width, height }]}>
      <View style={[styles.head, { backgroundColor: color }]}>
        <View style={[styles.fit, { backgroundColor: ink }]}>
          <Text style={[styles.fitTxt, { color }]}>{t(`onboardingFlow.self.cards.${index === 0 ? 'fitBest' : 'fitAlso'}`)}</Text>
        </View>
        {/* La marca de agua: la Barlow del titular ampliada, sin cuerpo propio fuera de la escala. */}
        <Text style={[styles.mark, { color: ink }]} accessible={false}>{sessions.length}</Text>
        <Text style={[styles.name, { color: ink }]} numberOfLines={2}>{entry.archetype.name}</Text>
        <View style={styles.week} accessible accessibilityLabel={t('onboardingFlow.self.cards.week')}>
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} style={[styles.day, { backgroundColor: withOpacity(ink, week.includes(i) ? 0.24 : 0.08) }]}>
              <Text style={[styles.dayTxt, { color: withOpacity(ink, week.includes(i) ? 0.8 : 0.4) }]}>{days[i]}</Text>
            </View>
          ))}
        </View>
      </View>

      {!ex ? (
        <Reanimated.View key="cover" entering={FadeIn.duration(250)} style={styles.face}>
          <Text style={styles.summary} numberOfLines={3}>{entry.archetype.summary}</Text>
          <View style={styles.stats}>
            {[[sessions.length, t('onboardingFlow.self.cards.sessions')], [`~${minutes}`, t('onboardingFlow.self.cards.min')], [weeks || '—', t('onboardingFlow.self.cards.weeks')]].map(([n, label]) => (
              <View key={label} style={styles.stat}>
                <Text style={styles.statNum}>{n}</Text>
                <Text style={styles.statLbl} numberOfLines={1}>{label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.lbl}>{t('onboardingFlow.self.cards.weekSets')}</Text>
          <View style={styles.split}>
            {groups.map(([g, n]) => (
              <View key={g} style={styles.sr}>
                <Text style={styles.srName} numberOfLines={1}>{t(`exerciseSelector.groups.${g}`, g)}</Text>
                <View style={styles.track}><View style={[styles.fill, { width: `${(n / max) * 100}%`, backgroundColor: color }]} /></View>
                <Text style={styles.srNum}>{n}</Text>
              </View>
            ))}
          </View>
          {/* Solo una pista: el toque lo recoge toda la tarjeta. */}
          <View style={styles.link}>
            <Text style={styles.linkTxt}>{t('onboardingFlow.self.cards.seeExercises')}</Text>
          </View>
        </Reanimated.View>
      ) : (
        <Reanimated.View key="ex" entering={FadeIn.duration(250)} style={styles.face}>
          <View style={styles.sesSel} accessibilityRole="tablist">
            {sessions.map((s, j) => (
              <Pressable
                key={s.id}
                onPress={() => setSes(j)}
                accessibilityRole="tab"
                accessibilityState={{ selected: j === ses }}
                style={[styles.sesBtn, j === ses && styles.sesBtnOn]}
              >
                <View style={[styles.sesLetter, { backgroundColor: resolveColor(th, s.color ?? COLORS[0]) }]}>
                  <Text style={[styles.sesLetterTxt, { color: ink }]}>{s.label}</Text>
                </View>
                {!lettersOnly && <Text style={[styles.sesTxt, j === ses && styles.sesTxtOn]}>{t('onboardingFlow.self.cards.session')}</Text>}
              </Pressable>
            ))}
          </View>
          <Text style={styles.sesName} numberOfLines={1}>{session.name}</Text>
          <ScrollView style={styles.exList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {(session.exercises ?? []).map((e, n) => (
              <View key={n} style={styles.exRow}>
                <Text style={styles.exName}>{exerciseName(allEx, e.exerciseId, language)}</Text>
                <Text style={styles.exSets}>
                  {e.minReps ? `${e.sets} × ${e.minReps === e.maxReps ? e.minReps : `${e.minReps}–${e.maxReps}`}` : t('onboarding.preview.setCount', { sets: e.sets })}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.link}>
            <Text style={styles.linkTxt}>{`‹ ${t('onboardingFlow.self.cards.backToCover')}`}</Text>
          </View>
        </Reanimated.View>
      )}
    </Pressable>
  );
}

/** Las tarjetas de `entries`, ya ajustadas a las respuestas. */
function useCards(entries, answers, days, minutes) {
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const allEx  = useMemo(() => ({ ...exerciseLibrary, ...customExercises }), [exerciseLibrary, customExercises]);
  const submit = useMemo(() => normalizeOnboardingAnswers(answers), [answers]);
  const cards  = useMemo(() => entries.map((entry) => ({
    entry, ...cardModel(adaptArchetype(entry.archetype, submit), { allEx, days, minutes }),
  })), [entries, submit, allEx, days, minutes]);
  return { cards, allEx };
}

/**
 * El resto de plantillas como filas con la selección de la app. `pickedId`: la marcada
 * (o `null` si manda la del carrusel); `onPick(id)` la elige.
 */
export function TemplateList({ entries, answers, days, minutes, pickedId, onPick }) {
  const { t } = useTranslation();
  const { cards } = useCards(entries, answers, days, minutes);
  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
      {cards.map((c, i) => (
        <FlowOption
          key={c.entry.archetype.id}
          index={i}
          title={c.entry.archetype.name}
          desc={[
            t('onboardingFlow.self.props.sessionsCount', { count: c.sessions.length }),
            `~${t('onboardingFlow.self.props.minutes', { count: c.minutes })}`,
            c.weeks ? t('onboardingFlow.self.cards.weeksCount', { count: c.weeks }) : null,
          ].filter(Boolean).join(' · ')}
          selected={pickedId === c.entry.archetype.id}
          onPress={() => onPick(c.entry.archetype.id)}
        />
      ))}
    </View>
  );
}

/** `entries`: las plantillas de `rankArchetypes` que se enseñan. `answers`: las del motor (con los ajustes). */
export default function TemplateCarousel({ entries, answers, days, minutes, onIndex }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const styles   = useThemedStyles(makeStyles);
  const language = useStore((s) => s.profile?.language ?? 'es');
  const [idx, setIdx] = useState(0);
  const { cards, allEx } = useCards(entries, answers, days, minutes);

  const cardH = Math.min(CARD_MAX_H, Math.max(CARD_MIN_H, screenH - CHROME_H));
  const cardW = Math.min(CARD_MAX_W, screenW - 2 * spacing.xxl);
  const step  = cardW + GAP;

  function settle(e) {
    const i = Math.min(cards.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step)));
    if (i !== idx) { setIdx(i); onIndex(i); }
  }

  return (
    <>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        onMomentumScrollEnd={settle}
        style={styles.car}
        contentContainerStyle={{ paddingHorizontal: (screenW - cardW) / 2, gap: GAP }}
      >
        {cards.map((c, i) => <Card key={c.entry.archetype.id} card={c} index={i} width={cardW} height={cardH} allEx={allEx} language={language} />)}
      </ScrollView>
      <View style={styles.dots}>{cards.map((c, i) => <Dot key={c.entry.archetype.id} on={i === idx} />)}</View>
    </>
  );
}

const makeStyles = (th) => StyleSheet.create({
  car:  { marginHorizontal: -GUTTER, marginTop: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },

  card: { borderRadius: th.radius.lg, overflow: 'hidden', backgroundColor: th.colors.surface },
  head: {
    height:            HEAD_H,
    paddingTop:        spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.md,
    justifyContent:    'flex-end',
    overflow:          'hidden',
  },
  fit:    { position: 'absolute', left: spacing.lg, top: spacing.md, borderRadius: th.radius.full, paddingHorizontal: spacing.sm2 + 1, paddingVertical: spacing.xs2 - 1 },
  fitTxt: { ...textStyles.caps, textTransform: 'uppercase' },
  mark: {
    ...textStyles.heroGlyph,
    position:        'absolute',
    right:           spacing.xxl + spacing.md,
    top:             spacing.xl,
    opacity:         0.14,
    lineHeight:      40,
    paddingRight:    2,
    includeFontPadding: false,
    transform:       [{ scale: 3.4 }],
  },
  name: {
    ...textStyles.heroName,
    textTransform:      'uppercase',
    lineHeight:         30,
    paddingRight:       2,
    includeFontPadding: false,
    maxWidth:           '80%',
  },
  week:   { flexDirection: 'row', gap: 3, marginTop: spacing.md },
  day:    { flex: 1, alignItems: 'center', borderRadius: th.radius.sm - 1, paddingVertical: 3 },
  dayTxt: { ...textStyles.labelStrong },

  face:    { flex: 1, paddingTop: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  summary: { ...textStyles.body, color: th.colors.mutedLight, lineHeight: lh(14) },
  stats:   { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stat:    { flex: 1, borderRadius: th.radius.md, backgroundColor: th.colors.surface2, paddingVertical: spacing.sm2, paddingHorizontal: spacing.md },
  statNum: { ...textStyles.indexGlyphSm, color: th.colors.text },
  statLbl: { ...textStyles.label, color: th.colors.mutedLight },
  lbl:     { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase', marginTop: spacing.lg },
  split:   { marginTop: spacing.sm2, gap: spacing.xs2 + 1 },
  sr:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
  srName:  { ...textStyles.label, width: 72, color: th.colors.mutedLight },
  track:   { flex: 1, height: 6, borderRadius: 3, backgroundColor: th.colors.surface3, overflow: 'hidden' },
  fill:    { height: '100%', borderRadius: 3 },
  srNum:   { ...textStyles.labelStrong, width: 22, textAlign: 'right', color: th.colors.text },
  link:    { marginTop: 'auto', alignSelf: 'center', paddingTop: spacing.md, paddingHorizontal: spacing.md },
  linkTxt: { ...textStyles.button, color: th.colors.accent },

  sesSel:       { flexDirection: 'row', gap: spacing.sm },
  sesBtn:       { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: th.radius.md, paddingVertical: spacing.sm2, backgroundColor: th.colors.surface2 },
  sesBtnOn:     { backgroundColor: th.colors.surface3 },
  sesLetter:    { width: 18, height: 18, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  sesLetterTxt: { ...textStyles.labelStrong },
  sesTxt:       { ...textStyles.bodyStrong, color: th.colors.mutedLight },
  sesTxtOn:     { color: th.colors.text },
  sesName:      { ...textStyles.bodyStrong, color: th.colors.text, marginTop: spacing.md },
  exList:       { flex: 1, marginTop: spacing.sm },
  exRow:        { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm2, borderTopWidth: 1, borderTopColor: th.colors.surface2 },
  exName:       { ...textStyles.body, flex: 1, color: th.colors.text, lineHeight: lh(14) - 4 },
  exSets:       { ...textStyles.labelStrong, color: th.colors.mutedLight },
});
