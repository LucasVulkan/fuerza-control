import { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Text } from '../components/ui/Text';
import Svg, { Path } from 'react-native-svg';
// Reanimated lleva las dos mitades del plegado: el `layout` de la tarjeta
// anima su propio alto y el contenido entra y sale con opacidad. Es el patrón
// del acordeón de `SessionCard`; ningún `Animated.Value` persiguiendo alturas
// desde JS.
import Reanimated, { LinearTransition, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useStore, selectActiveProgram } from '../../store/useStore';
import { stageDaysAt, athleteProgress, stageStatus, stageBannerDue, localDay, addDays } from '../utils/stageProgress';
import AppHeader from '../components/AppHeader';
import ProgramUpdateModal from '../components/ProgramUpdateModal';
import DragSheet from '../components/DragSheet';
import { MenuRow } from '../components/ui/MenuList';
import NoProgram from '../components/ui/NoProgram';
import { spacing, textStyles, borders, withOpacity, lh } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { formatDate } from '../utils/formatters';
import { isStageLocked } from '../utils/stageLocks';
import { collapseOut, FOLD_MS } from '../components/ui/collapseOut';
import { getWeekStatuses } from '../utils/weekProgress';
import { sessionPlan } from '../utils/sessionPlan';
import { sessionStats } from '../utils/sessionStats';
import { targetLabel, exerciseName } from '../utils/prescription';
import { isExerciseDone } from '../utils/exerciseStatus';

// Tint base "lima" (#b8ff00) — distinto del accent sólido (#aae216), sin
// token propio (mismo caso que el #81a71e del banner, ver theme.js).
const LIMA = '#b8ff00';

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / 86400000);
}

function relativeTime(ts, t) {
  const days = daysSince(ts);
  if (days === null) return null;
  if (days === 0)  return t('dayCard.today');
  if (days === 1)  return t('dayCard.yesterday');
  if (days < 7)   return t('dayCard.daysAgo', { count: days });
  if (days < 14)  return t('dayCard.oneWeekAgo');
  if (days < 30)  return t('dayCard.weeksAgo', { count: Math.floor(days / 7) });
  return formatDate(ts);
}

/** "42 min" / "2 h" — cuánto lleva abierta la sesión en curso. */
function elapsedShort(startedAt) {
  if (!startedAt) return null;
  const mins = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h`;
}

// ── Weekly selector (L M X J V S D + 7 dots) ────────────────────────────────────
//
// Va arriba del todo y DESNUDA: sin caja, sin rótulo y sin contador. Se probó
// con caja rotulada "ESTA SEMANA" y un contador de entrenos, y el usuario lo
// rechazó — si algún día se quiere recuperar ese contador hay que dárselo de
// otra forma, porque con la caja se fue.
//
// Los puntos reflejan días REALMENTE entrenados (workoutLog), no una plantilla.
// Solo dos estados: entrenado = lima, cualquier otro = gris apagado. El día de
// hoy NO se marca en el punto — lo identifica su letra en lima, y basta.

function WeekDot({ status, styles }) {
  const trained = status === 'trained' || status === 'todayTrained';
  return <View style={[styles.weekDot, trained ? styles.weekDotTrained : styles.weekDotIdle]} />;
}

function WeekSelector({ workoutLog }) {
  const { t, i18n } = useTranslation();
  const styles  = useThemedStyles(makeStyles);
  const letters = t('home.weekDayLetters', { returnObjects: true });
  const days    = getWeekStatuses(workoutLog);

  const summary = days
    .map(({ date, status }) => {
      const name  = new Date(date).toLocaleDateString(i18n.language, { weekday: 'long' });
      const extra = status === 'trained' || status === 'todayTrained'
        ? t('home.dayTrained')
        : (status === 'today' ? t('dayCard.today') : null);
      return extra ? `${name}: ${extra}` : name;
    })
    .join(', ');

  return (
    <View style={styles.week} accessible accessibilityLabel={summary}>
      <View style={styles.weekLetters}>
        {letters.map((letter, i) => (
          <Text
            key={i}
            style={[styles.weekLetter, (days[i].status === 'today' || days[i].status === 'todayTrained') && styles.weekLetterToday]}
          >
            {letter}
          </Text>
        ))}
      </View>
      <View style={styles.weekDots}>
        {days.map(({ status }, i) => <WeekDot key={i} status={status} styles={styles} />)}
      </View>
    </View>
  );
}

// ── Sesiones ──────────────────────────────────────────────────────────────
//
// Una sola lista en el orden del programa. Cada sesión es una fila plegable y la que
// toca hoy es esa misma fila a otra escala: en lima, con la letra grande y su
// botón puesto. Toda la cabecera abre; SOLO el botón entra a entrenar
// (docs/specs/home-sesiones-plegables.md §5).
//
// El hero suelto que había antes ya no existe: se sacaba de la lista, obligaba a
// elegir entre enseñar los ejercicios o caber en pantalla, y no había manera de
// mirar una sesión sin empezarla.

function HeroChevron({ size = 13, color = LIMA }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path d="M4 2l4.5 4L4 10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Los ejercicios de la sesión, tal cual se los va a encontrar dentro.
 *
 * Deliberadamente sosa —Inter en caja baja, sin filetes y sin lima— para que la
 * cabecera siga siendo lo que canta (§5.4). Los bloques de acondicionamiento van
 * detrás de los ejercicios, con su formato donde las series y sin la pastilla de
 * color del editor, que aquí sería un cuarto acento.
 */
function ExerciseLines({ template, allExercises }) {
  const { t, i18n } = useTranslation();
  const styles    = useThemedStyles(makeStyles);
  const exercises = template.exercises ?? [];
  const blocks    = template.blocks ?? [];

  const line = (key, idx, name, right) => (
    <View key={key} style={styles.exRow}>
      <Text style={styles.exIdx}>{idx}</Text>
      <Text style={styles.exName} numberOfLines={1}>{name}</Text>
      <Text style={styles.exTarget}>{right}</Text>
    </View>
  );

  return (
    <>
      {exercises.map((ex, i) => {
        const def = allExercises[ex.exerciseId];
        return line(
          `${ex.exerciseId}-${i}`,
          i + 1,
          exerciseName(def, i18n.language, ex.exerciseId),
          targetLabel(def, ex, t, { compact: true }),
        );
      })}
      {blocks.map((block, i) => line(
        `block-${i}`,
        exercises.length + i + 1,
        block.name ?? t(`blocks.formats.${block.format}`),
        t(`blocks.formats.${block.format}`).toUpperCase(),
      ))}
    </>
  );
}

/**
 * Una sesión cualquiera: 60 px cerrada, y al abrirse los ejercicios y SU botón
 * —en contorno, no en relleno—. Que el botón solo exista abierta es lo que dice
 * «puedes, pero no es lo que toca» sin un diálogo de confirmación.
 */
function SessionRow({
  marker, name, meta, done, adapted, open,
  cta, onToggle, onStart, onEdit, a11yLabel, children,
}) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.sesCard}>
      <TouchableOpacity
        style={styles.sesHead}
        onPress={onToggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ expanded: open }}
        accessibilityHint={t(open ? 'home.collapse' : 'home.expand')}
      >
        <Text style={[styles.sesGlyph, done && styles.sesGlyphDone]}>{marker}</Text>
        <Text style={[styles.sesName, done && styles.sesNameDone]} numberOfLines={1}>{name}</Text>
        {!!adapted && <Text style={styles.rowAdapted}>{t('home.adapted')}</Text>}
        <Text style={styles.sesMeta} numberOfLines={1}>{meta}</Text>
        {done && <CheckIcon size={14} color={LIMA} />}
      </TouchableOpacity>

      {open && (
        <Reanimated.View
          entering={FadeIn.duration(180)}
          exiting={collapseOut}
          style={styles.sesBody}
        >
          <View style={styles.sesBodyRule} />
          {children}
          {/* Botones sólidos a todo el ancho (QA 26-sep): primario en acento;
              una sesión ya hecha esta semana repite con el secundario, que la
              que toca es otra. Con `onEdit` (sesiones libres, free-sessions.md
              §6.1) EDITAR va al lado, también secundario. */}
          <View style={styles.sesBtnRow}>
            <TouchableOpacity
              style={[styles.sesBtn, done && styles.sesBtnSecondary]}
              onPress={onStart}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={cta}
            >
              <Text style={[styles.sesBtnText, done && styles.sesBtnTextSecondary]}>{cta}</Text>
              <HeroChevron color={done ? th.colors.text : th.colors.onAccent} />
            </TouchableOpacity>
            {onEdit && (
              <TouchableOpacity
                style={[styles.sesBtn, styles.sesBtnSecondary, styles.sesBtnEdit]}
                onPress={onEdit}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Text style={[styles.sesBtnText, styles.sesBtnTextSecondary]}>{t('home.edit').toUpperCase()}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

/**
 * La que toca hoy: la misma fila en lima y a otra escala. Es la ÚNICA pieza en
 * color de la pantalla, así que dentro el acento pasa a ser el negro —letra,
 * raya y series— y el botón se invierte (§1.1).
 *
 * El botón vive en el pie y no dentro del desplegable: abrir la tarjeta crece
 * por dentro y no lo mueve de sitio.
 */
function TodayCard({
  marker, flag, name, meta, open, cta, onToggle, onStart, a11yLabel, children,
}) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return (
    <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.today}>
      <TouchableOpacity
        style={styles.todayHead}
        onPress={onToggle}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ expanded: open }}
        accessibilityHint={t(open ? 'home.collapse' : 'home.expand')}
      >
        {/* La letra se empareja con el NOMBRE, no con el bloque entero: son la
            misma cosa dicha de dos maneras. Por eso el rótulo sale fuera y se
            queda a ancho completo —alineado con la raya, la meta y el botón— y
            la letra y el nombre forman su propia línea, apoyados en el mismo
            suelo. Sin un solo margen a ojo: se recoloca solo si el nombre rompe
            a dos líneas. Ver §5.2.1. */}
        <Text style={styles.todayFlag} numberOfLines={1}>{flag}</Text>
        <View style={styles.todayHeadRow}>
          {!!marker && <Text style={styles.todayGlyph}>{marker}</Text>}
          <Text style={styles.todayName} numberOfLines={2}>{name}</Text>
        </View>
        <View style={styles.todayRule} />
        <Text style={styles.todayMeta} numberOfLines={1}>{meta}</Text>
      </TouchableOpacity>

      {open && (
        <Reanimated.View
          entering={FadeIn.duration(180)}
          exiting={collapseOut}
          style={styles.todayBox}
        >
          {children}
        </Reanimated.View>
      )}

      {/* Con `layout` propio: el pie es el único hermano que se mueve al
          plegar, y sin él Reanimated le quita el hueco de golpe — el botón
          saltaba a su sitio mientras la tarjeta seguía encogiendo. */}
      <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.todayFoot}>
        <TouchableOpacity
          style={styles.todayBtn}
          onPress={onStart}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={cta}
        >
          <Text style={styles.todayBtnText}>{cta}</Text>
          <HeroChevron />
        </TouchableOpacity>
      </Reanimated.View>
    </Reanimated.View>
  );
}

/**
 * El texto del botón dice A DÓNDE LLEVA, con el nombre de la sesión dentro.
 * Sin letra (una plantilla sin `label`) cae a la forma corta: la interfaz no
 * promete lo que no tiene.
 */
function startCta(t, label, { active, done }) {
  if (active) return label ? t('home.btnContinueSession', { label }) : t('home.btnContinue');
  if (done)   return label ? t('home.btnRepeatSession',   { label }) : t('home.btnRepeat');
  return label ? t('home.btnStartSession', { label }) : t('home.btnStart');
}

// ── Iconos ────────────────────────────────────────────────────────────────────

function CheckIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Section header ──────────────────────────────────────────────────────────────
// SESIONES lleva a la derecha el contador de la semana, que sale entero de
// `sessionPlan`: la pantalla no compone la frase, solo decide si hay hueco para
// ella (sin sesiones que contar, el subtítulo viene a null y no se pinta nada).

function SectionHeader({ label, count }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.secHeader}>
      <Text style={styles.secHeaderLabel}>{label}</Text>
      {!!count && <Text style={styles.secHeaderCount}>{count}</Text>}
    </View>
  );
}

// ── HomeScreen ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t }      = useTranslation();
  const styles     = useThemedStyles(makeStyles);

  const [freeSheet,   setFreeSheet]   = useState(false);
  const [freeList,    setFreeList]    = useState(false);
  // Acordeón puro: como mucho una sesión abierta. Ni se persiste ni se
  // recuerda al volver — es una preferencia de un segundo, no un ajuste.
  const [openId,      setOpenId]      = useState(null);

  const activeProgram        = useStore(selectActiveProgram);
  const activeSession        = useStore((s) => s.activeSession);
  const workoutLog           = useStore((s) => s.workoutLog);
  // Las del programa se leen con `getEffectiveTemplate`; la suscripción es la
  // que repinta al editarlas, y de aquí salen las sesiones libres.
  const sessionTemplates     = useStore((s) => s.sessionTemplates);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const getLastSession       = useStore((s) => s.getLastSession);
  const startSession         = useStore((s) => s.startSession);
  const startFreeSession     = useStore((s) => s.startFreeSession);
  const createFreeTemplate   = useStore((s) => s.createFreeTemplate);
  const clientSync           = useStore((s) => s.clientSync);
  const advanceStage         = useStore((s) => s.advanceStage);
  const extendStage          = useStore((s) => s.extendStage);
  const snoozeStageBanner    = useStore((s) => s.snoozeStageBanner);
  const stageBannerSnooze    = useStore((s) => s.stageBannerSnooze);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);

  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  // Empezar cualquier cosa con una sesión a medias la descartaba en silencio.
  const confirmDiscardActive = (onConfirm) => {
    Alert.alert(
      t('workout.discardConfirm'),
      undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('workout.discardSession'), style: 'destructive', onPress: onConfirm },
      ],
    );
  };

  // Empezar una sesión que no toca ya no lleva diálogo: hay que abrir su
  // tarjeta y pulsar un botón que además va en contorno, o sea dos toques
  // deliberados. El aviso solo añadía fricción (spec §5.6). Descartar una
  // sesión a medias, en cambio, se sigue confirmando: ahí sí se pierde algo.
  const requestStart = (templateId) => {
    if (activeSession.templateId === templateId) { navigation.navigate('Workout'); return; }
    if (activeSession.templateId) { confirmDiscardActive(() => startSession(templateId)); return; }
    startSession(templateId);
  };

  const startFree = () => {
    if (activeSession.templateId) { confirmDiscardActive(() => startFreeSession()); return; }
    startFreeSession();
  };

  // ── Sesiones libres (free-sessions.md §6) ──
  // Solo las MÍAS (§4.1.1): las de un cliente o un grupo no salen en mi Inicio.
  // `Object.values` conserva el orden de alta, que es el de la lista.
  const myFree   = Object.values(sessionTemplates).filter((tpl) => !tpl.programId && (tpl.owner ?? 'me') === 'me');
  const homeFree = myFree.filter((tpl) => tpl.onHome !== false);
  const freeName = (tpl) => tpl.name || t('freeSession.templateUnnamed');
  const editFree = (templateId) => navigation.navigate('SessionEditor', { templateId });

  // La hoja se abre siempre: además de empezar en blanco se puede crear una en
  // el editor. Solo la sobre la marcha a medias va directa a seguir con ella.
  const handleFreePress = () => {
    if (activeSession.templateId === '__free__') { navigation.navigate('Workout'); return; }
    setFreeSheet(true);
  };

  const freeMeta = (tpl) => [
    t('freeSession.templateExercises', { count: tpl.exercises?.length ?? 0 }),
    (tpl.blocks?.length ?? 0) > 0
      ? t('freeSession.templateBlocks', { count: tpl.blocks.length })
      : null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />
      <ProgramUpdateModal />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <WeekSelector workoutLog={workoutLog} />

        {activeProgram ? (() => {
          // Dónde va de la etapa: la misma cuenta que ve su entrenador
          // (weeks-model.md §3.7). El día se lee al pintar.
          const today       = localDay();
          const progress    = athleteProgress(activeProgram);
          const status      = stageStatus(activeProgram, progress, today);
          const stageIdx    = status.stageIdx;
          const currentStage = status.stage;
          const nextStage    = activeProgram.stages?.[stageIdx + 1] ?? null;
          const nextStageLocked = isStageLocked(activeProgram, stageIdx + 1, clientSync);

          // Las sesiones de la etapa, en el orden del programa.
          const currentDays = stageDaysAt(activeProgram, stageIdx);
          const days = currentDays
            .map(({ sessionTemplateId }) => ({
              templateId:  sessionTemplateId,
              template:    getEffectiveTemplate(sessionTemplateId),
              lastSession: getLastSession(sessionTemplateId),
            }))
            .filter((d) => d.template);
          const byId = new Map(days.map((d) => [d.templateId, d]));

          // ¿Cuál toca y por qué? — rótulo, marcadores y contador, en un sitio.
          const plan = sessionPlan({
            days: days.map((d) => ({ templateId: d.templateId, label: d.template.label })),
            log:              workoutLog,
            activeTemplateId: activeSession.templateId,
            t,
          });

          // ── Aviso de fin de etapa (weeks-model.md §6.1) ──
          // Cuatro casos y un solo sitio que decide si sale (`stageBannerDue`,
          // el mismo que enciende el punto del tab). Cada uno dice qué ha pasado
          // y ofrece una acción principal y otra discreta.
          const pid     = activeProgram.id;
          const names   = { current: currentStage?.name ?? t('home.currentStageDefault'), next: nextStage?.name ?? '' };
          const advance = {
            label:   t('home.advanceTo', { name: names.next.toUpperCase() }),
            onPress: () => advanceStage(pid),
          };
          const banner = !nextStage || !stageBannerDue(activeProgram, progress, stageBannerSnooze?.[pid], today)
            ? null
            : nextStageLocked
              // No puede avanzar: sigue en la etapa (stage-locks §0.1). Se le
              // recuerda cada semana mientras su entrenador no la abra.
              ? {
                title: t('home.stageLockedTitle'),
                text:  t('home.stageLockedText', names),
                hint:  t('home.stageLockedHint'),
                quiet: { label: t('home.understood'), onPress: () => snoozeStageBanner(pid, addDays(today, 7)) },
              }
              : status.ended && status.missingWeeks > 0
                // Terminó por fecha sin entrenar lo que tocaba: se propone
                // alargar, pero avanzar sigue a un toque.
                ? {
                  title: t('home.stageEndedTitle'),
                  text:  t('home.stageBehindText', { ...names, done: status.done, expected: status.expected, count: status.missingWeeks }),
                  main:  { label: t('home.extendWeeks', { count: status.missingWeeks }), onPress: () => extendStage(pid, status.missingWeeks) },
                  quiet: advance,
                }
                : status.ended
                  ? {
                    title: t('home.stageCompleted'),
                    text:  t('home.stageAdvanceText', names),
                    main:  advance,
                    // Con el aplazamiento: sin él, la semana añadida sería ya
                    // la última con todo hecho y el aviso volvería al instante.
                    quiet: {
                      label:   t('home.oneMoreWeek'),
                      onPress: () => { extendStage(pid, 1); snoozeStageBanner(pid, addDays(status.endsOn, 7)); },
                    },
                  }
                  // Anticipado: última semana y todas las sesiones hechas.
                  : {
                    title: t('home.stageCompleted'),
                    text:  t('home.stageEarlyText', { ...names, expected: status.expected }),
                    main:  advance,
                    quiet: { label: t('home.notNow'), onPress: () => snoozeStageBanner(pid, status.endsOn) },
                  };
          // La meta de la tarjeta de hoy: los dos primeros datos salen de
          // `sessionStats`, que ya existe, y el tercero es cuándo fue la última
          // vez. Con la sesión a medias cambia entera — cuánto llevas y desde
          // cuándo, que es lo único que importa para volver a ella.
          const todayMeta = (day) => {
            if (activeSession.templateId === day.templateId) {
              const exs  = day.template.exercises ?? [];
              const done = exs.filter((ex) => isExerciseDone(ex, activeSession.setsState?.[ex.exerciseId] ?? [])).length;
              return t('home.heroMetaActive', {
                done, total: exs.length, ago: elapsedShort(activeSession.startedAt) ?? '',
              });
            }
            const stats = sessionStats(day.template, allExercises);
            const rel   = relativeTime(day.lastSession?.timestamp, t);
            return [
              t('home.sessionMeta', { count: stats.exercises, minutes: stats.minutes }),
              rel ? t('home.heroMetaLast', { rel: rel.toLowerCase() }) : t('home.firstTime').toLowerCase(),
            ].join(' · ');
          };

          return (
            <>
              <View>
                <SectionHeader label={t('home.sessions').toUpperCase()} count={plan.subtitle} />

                {/* Etapa terminada: el único "algo terminó" que persiste en la
                    Home. Va ENCIMA del hero y no lo sustituye — la sesión que
                    toca sigue siendo la que toca. Sin acción principal (etapa
                    siguiente bloqueada) el botón que queda va en lima. */}
                {banner && (
                  <View style={styles.stageBanner}>
                    <Text style={styles.stageBannerLabel}>{banner.title.toUpperCase()}</Text>
                    <Text style={styles.stageBannerText}>{banner.text}</Text>
                    {!!banner.hint && <Text style={styles.stageBannerHint}>{banner.hint}</Text>}
                    <View style={styles.stageBannerBtns}>
                      {banner.main && (
                        <TouchableOpacity
                          style={[styles.stageBannerBtn, { flex: 2 }]}
                          onPress={banner.main.onPress}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                        >
                          <Text style={styles.stageBannerBtnText}>{banner.main.label}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.stageBannerBtn, banner.main && styles.stageBannerBtnQuiet]}
                        onPress={banner.quiet.onPress}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.stageBannerBtnText, banner.main && styles.stageBannerBtnTextQuiet]}>
                          {banner.quiet.label}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Todas las sesiones, en el orden del programa: la que toca es una
                    más, en su hueco y a otra escala. NO es la lista agrupada de
                    Progreso: cada sesión es una tarjeta suelta con su radio
                    entero, porque cualquiera de ellas puede crecer. */}
                <View style={styles.group}>
                  {plan.rows.map((row) => {
                    const day = byId.get(row.templateId);
                    if (!day) return null;
                    const open   = openId === row.templateId;
                    const active = activeSession.templateId === row.templateId;
                    const name   = day.template.name ?? '';
                    const cta    = startCta(t, day.template.label ?? '', { active, done: row.isDone });
                    const toggle = () => setOpenId(open ? null : row.templateId);
                    const start  = () => requestStart(row.templateId);
                    const a11y   = `${t('workout.sessionLabel', { label: row.marker })}, ${name}, ${row.isDone ? t('home.sessionDone') : t('home.sessionPending')}`;
                    const lines  = (
                      <ExerciseLines template={day.template} allExercises={allExercises} />
                    );

                    if (row.isHero) {
                      return (
                        <TodayCard
                          key={row.templateId}
                          marker={row.marker}
                          flag={plan.heroLabel}
                          name={name}
                          meta={todayMeta(day)}
                          open={open}
                          cta={cta}
                          onToggle={toggle}
                          onStart={start}
                          a11yLabel={`${plan.heroLabel}, ${a11y}`}
                        >
                          {lines}
                        </TodayCard>
                      );
                    }

                    const stats = sessionStats(day.template, allExercises);
                    const rel   = relativeTime(day.lastSession?.timestamp, t);
                    return (
                      <SessionRow
                        key={row.templateId}
                        marker={row.marker}
                        name={name}
                        // Hecha: cuándo fue. Pendiente: cuánto dura. Cuántos
                        // ejercicios tiene está un toque más abajo, con los
                        // ejercicios de verdad.
                        meta={row.isDone && rel
                          ? rel.toLowerCase()
                          : t('home.rowMinutes', { minutes: stats.minutes })}
                        done={row.isDone}
                        // "Adaptada" es texto, no una pastilla: menos ruido, y el
                        // azul sigue significando entrenador.
                        adapted={!!clientSync.pendingOverrides?.[row.templateId]}
                        open={open}
                        cta={cta}
                        onToggle={toggle}
                        onStart={start}
                        a11yLabel={a11y}
                      >
                        {lines}
                      </SessionRow>
                    );
                  })}
                </View>
              </View>

            </>
          );
        })() : (
          <NoProgram />
        )}

        {/* ── Sesiones libres (free-sessions.md §6.1) ── También sin programa:
            tener sesiones sueltas sin programa es justo uno de sus usos. Con
            `layout` porque al plegar una sesión de arriba sube o baja: sin él
            daba el salto de golpe mientras la tarjeta seguía animando. */}
        <Reanimated.View layout={LinearTransition.duration(FOLD_MS)}>
          {homeFree.length > 0 && (
            <View style={styles.freeSection}>
              <SectionHeader label={t('freeSession.sectionTitle').toUpperCase()} />
              <View style={styles.group}>
                {homeFree.map((tpl) => {
                  const open   = openId === tpl.id;
                  const active = activeSession.templateId === tpl.id;
                  const rel    = relativeTime(getLastSession(tpl.id)?.timestamp, t);
                  const name   = freeName(tpl);
                  return (
                    <SessionRow
                      key={tpl.id}
                      // Sin letra: el hueco se queda para que los nombres se
                      // alineen con los de las sesiones del programa.
                      marker=""
                      name={name}
                      meta={rel
                        ? rel.toLowerCase()
                        : t('home.rowMinutes', { minutes: sessionStats(tpl, allExercises).minutes })}
                      done={false}
                      open={open}
                      cta={startCta(t, '', { active, done: false })}
                      onToggle={() => setOpenId(open ? null : tpl.id)}
                      onStart={() => requestStart(tpl.id)}
                      onEdit={() => editFree(tpl.id)}
                      a11yLabel={`${t('freeSession.badge')}, ${name}`}
                    >
                      <ExerciseLines template={tpl} allExercises={allExercises} />
                    </SessionRow>
                  );
                })}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.freeSessionBtn}
            onPress={handleFreePress}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <Text style={styles.freeSessionBtnText}>
              {activeSession.templateId === '__free__'
                ? t('freeSession.btnContinue')
                : t('freeSession.btn')}
            </Text>
          </TouchableOpacity>
        </Reanimated.View>

      </ScrollView>

      {/* Modals */}
      {/* ── ＋ Sesión libre (free-sessions.md §6.2) ── */}
      {freeSheet && (
        <DragSheet visible onClose={() => setFreeSheet(false)} title={t('freeSession.startTitle')}>
          <View style={styles.sheetGroup}>
            <MenuRow
              isFirst
              label={t('freeSession.startNow')}
              sub={t('freeSession.startNowDesc')}
              subLines={0}
              minHeight={62}
              onPress={() => { setFreeSheet(false); startFree(); }}
            />
            <MenuRow
              isLast={myFree.length === 0}
              label={t('freeSession.create')}
              sub={t('freeSession.createDesc')}
              subLines={0}
              minHeight={62}
              onPress={() => {
                setFreeSheet(false);
                editFree(createFreeTemplate());
              }}
            />
            {myFree.length > 0 && (
              <MenuRow
                isLast
                label={t('freeSession.mine', { count: myFree.length })}
                sub={t('freeSession.mineDesc')}
                subLines={0}
                minHeight={62}
                onPress={() => { setFreeSheet(false); setFreeList(true); }}
              />
            )}
          </View>
        </DragSheet>
      )}

      {/* Todas las mías, primero las de Inicio. Es el único camino al editor
          de las que no están en Inicio; borrar va en el editor, donde se ve lo
          que se borra. */}
      {freeList && (() => {
        const list = [...homeFree, ...myFree.filter((tpl) => tpl.onHome === false)];
        return (
          <DragSheet visible onClose={() => setFreeList(false)} title={t('freeSession.mineTitle')}>
            <View style={styles.sheetGroup}>
              {list.map((tpl, i) => (
                <MenuRow
                  key={tpl.id}
                  isFirst={i === 0}
                  isLast={i === list.length - 1}
                  label={freeName(tpl)}
                  sub={freeMeta(tpl)}
                  minHeight={62}
                  onPress={() => { setFreeList(false); requestStart(tpl.id); }}
                  control={(
                    <TouchableOpacity
                      onPress={() => { setFreeList(false); editFree(tpl.id); }}
                      hitSlop={10}
                      accessibilityRole="button"
                    >
                      <Text style={styles.freeTplEdit}>{t('home.edit').toUpperCase()}</Text>
                    </TouchableOpacity>
                  )}
                />
              ))}
            </View>
          </DragSheet>
        );
      })()}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({

  container: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },
  // Sin `gap`: cada bloque pone su propio aire (el rótulo de sección ya trae el
  // suyo, la tarjeta de programa va más separada que el resto).
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.sm,
    paddingBottom:     spacing.xxl * 2,
  },

  // ── Rótulos de sección ────────────────────────────────────────────────────────
  secHeader: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           spacing.sm,
    paddingHorizontal: spacing.xs2,
    marginTop:     spacing.lg,
    marginBottom:  spacing.sm2,
  },
  // SESIONES es el rótulo de la zona de entreno y va en `text`; los demás
  // rótulos de la pantalla se quedan en `mutedLight`.
  secHeaderLabel: { ...textStyles.caps, color: th.colors.text },
  // El mismo cuerpo que el meta del hero ("5 EJERCICIOS · ~55 MIN · …"): son el
  // mismo tipo de dato, contexto en mayúsculas muy trackeado. Antes iba a 9 y
  // en SemiBold, medio punto por debajo de todo lo demás.
  secHeaderCount: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginLeft:    'auto',
  },

  // ── Selector semanal (L M X J V S D + 7 puntos) ───────────────────────────────
  week: {
    gap:               spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical:   9, // exacto de Figma, no cae en ningún token de spacing
  },
  weekLetters: { flexDirection: 'row', justifyContent: 'space-between' },
  weekLetter:  { ...textStyles.labelStrong, color: th.colors.mutedLight },
  weekLetterToday: { color: LIMA },
  weekDots: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDot: {
    width:        12,
    height:       12,
    borderRadius: 6,
  },
  weekDotTrained: { backgroundColor: LIMA },
  weekDotIdle:    { backgroundColor: th.colors.muted },

  // ── Lista de sesiones ───────────────────────────────────────────────────
  // Los cuerpos y los huecos salen de la sesión de diseño
  // (docs/specs/home-sesiones-plegables.md §5), no de Figma: donde no hay token
  // —14, 12, 11— va el número exacto de la spec.
  //
  // Tarjetas sueltas, no una lista agrupada: cualquiera se despliega, así que
  // todas llevan su radio entero. El aire va DENTRO de la tarjeta (60 px de
  // alto) y no entre ellas: separadas y estrechas parecían una persiana, y
  // juntas y altas se leen como fichas.
  group: { gap: spacing.xs2 },

  sesCard: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  sesHead: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    height:            60,
    paddingHorizontal: 14,
  },
  // `includeFontPadding: false` aquí y en la letra grande: es lo que deja que la
  // caja del texto valga lo que dice `lineHeight` y no lo que Android le suma
  // por su cuenta — sin eso, la letra no cae donde se la centra.
  sesGlyph: {
    ...textStyles.title,
    lineHeight:         22,
    includeFontPadding: false,
    // Ajustada a la tinta de la Inter Black a este cuerpo (24 px medidos sobre
    // el .ttf), sin los 2 px de holgura que traía. Lo que separa la letra del
    // nombre es el `gap` de la fila, no una caja con aire de sobra.
    width:              24,
    color:              LIMA,
  },
  sesGlyphDone: { color: th.colors.muted },
  sesName:      { ...textStyles.itemTitle, flex: 1, color: th.colors.text },
  sesNameDone:  { color: th.colors.mutedLight },
  sesMeta:      { ...textStyles.label, color: th.colors.muted },
  rowAdapted:   { ...textStyles.labelStrong, color: th.tint.blue70 },

  sesBody: { paddingHorizontal: 14, paddingTop: spacing.xs, paddingBottom: 14, overflow: 'hidden' },
  // La raya de la cabecera de hoy, apagada: separa sin contar nada.
  sesBodyRule: {
    height:          2,
    borderRadius:    2,
    backgroundColor: th.tint.accent50,
    marginBottom:    spacing.sm2,
  },
  // Sólido y a todo el ancho (QA 26-sep: el contorno se leía flojo y, dentro
  // de la fila de botones, no llenaba). Primario en acento; secundario en
  // `surface2` sin borde, la variante Secondary ya cerrada en la app.
  sesBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 12 },
  sesBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    padding:         14,
  },
  sesBtnText:          { ...textStyles.button, color: th.colors.onAccent },
  sesBtnSecondary:     { backgroundColor: th.colors.surface2 },
  sesBtnTextSecondary: { color: th.colors.text },
  // EDITAR: lo justo para su palabra, que EMPEZAR es lo principal.
  sesBtnEdit:          { flex: 0, justifyContent: 'center' },

  // ── La que toca hoy ─────────────────────────────────────────────────
  // La única pieza en color de la pantalla, así que dentro el acento es el
  // negro: letra, raya y series. El botón se invierte.
  today: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
    // La de hoy respira el doble que las demás por arriba y por abajo: es la
    // pieza grande y pegada a sus vecinas se leía como parte de la misma lista.
    marginVertical:  spacing.xs2,
  },
  todayHead: {
    paddingTop:        14,
    paddingHorizontal: spacing.lg,
    paddingBottom:     11,
  },
  // `flex-end` y no `center`: la letra se apoya en la misma línea de suelo que
  // el nombre. Centrada tampoco quedaba mal, pero a media altura no está
  // alineada con nada y se lee como un descuadre.
  todayHeadRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: spacing.sm },
  // ── Cómo se apoyan la letra y el nombre en el mismo suelo ──────────────────
  // La fila alinea a `flex-end`, o sea que lo que casa son los BORDES de las dos
  // cajas de texto, no las bases de las letras. La distancia de la base al borde
  // inferior es `(lineHeight − (A+D)·cuerpo)/2 + D·cuerpo`, con A=1.0 y D=0.2 em
  // (métricas hhea de la Barlow). Igualando las dos sale una relación limpia:
  //
  //     lineHeight(letra) = lineHeight(nombre) + 6·(A − D) = +4.8
  //
  // De ahí 34 en el nombre (que es además lo mínimo para que la "j" no se corte:
  // 1.2 em × 28 = 33.6) y 39 en la letra. Si cambia un cuerpo, rehacer la cuenta;
  // no son números a ojo.
  todayGlyph: {
    ...textStyles.heroGlyph,
    lineHeight:         39,
    includeFontPadding: false,
    // La tinta de la Barlow a 34 mide 26 justos: 27 para que la cursiva no
    // roce el borde. Aquí el aire se recorta desde el `gap` de la fila, que
    // sólo separa la letra del nombre.
    width:              27,
    color:              th.colors.onAccent,
  },
  // La misma ceja que la tarjeta de programa y las cabeceras de pantalla.
  todayFlag: {
    ...textStyles.caps,
    textTransform: 'uppercase',
    color:         withOpacity(th.colors.onAccent, 0.55),
  },
  todayName: {
    ...textStyles.heroName,
    // 34: la Barlow pide 1.2 em (33.6 a cuerpo 28) para que la "j" de "empuje"
    // quepa entera. Con los 25 de antes se comía 8 px de descendente.
    lineHeight:         34,
    // Imprescindible para que la cuenta de arriba valga en Android: sin esto el
    // sistema le suma su propio relleno a la caja y el suelo deja de casar.
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
  // 6 px a los lados y no 15: el lima queda de FILO, no de marco, y la tarjeta
  // se sigue leyendo como una sola pieza. El pie lleva el mismo margen.
  todayBox: {
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    overflow:          'hidden',
    marginHorizontal:  spacing.sm,
    paddingHorizontal: 12,
    paddingVertical:   9,
  },
  todayFoot: {
    paddingTop:        11,
    paddingHorizontal: spacing.sm,
    paddingBottom:     spacing.sm,
  },
  todayBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: th.colors.onAccent,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
  },
  todayBtnText: { ...textStyles.button, color: LIMA },

  // ── Los ejercicios de la sesión desplegada ──────────────────────────────
  // Sosos a propósito: caja baja, sin filetes y sin lima. Dentro de la tarjeta
  // el acento ya lo gastan la raya y el botón; un tercero repetido siete veces
  // le quita fuerza justo a lo que hay que pulsar (§5.4).
  exRow:  { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md, paddingVertical: spacing.xs2 },
  exIdx:    { ...textStyles.label, width: 13, color: th.colors.muted },
  exName:   { ...textStyles.body, flex: 1, color: th.colors.text },
  exTarget: { ...textStyles.label, color: th.colors.mutedLight },


  // ── Banner de etapa terminada ─────────────────────────────────────────────────
  // Sobre `surface` y con los dos botones en outline: el relleno lima es del
  // hero, y aquí competiría con EMPEZAR.
  stageBanner: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    marginBottom:    spacing.md,
  },
  stageBannerLabel: {
    ...textStyles.caps,
    color:         th.colors.accent,
    textTransform: 'uppercase',
  },
  stageBannerText: {
    ...textStyles.body,
    color:      th.colors.mutedLight,
    lineHeight: textStyles.body.fontSize * 1.5,
    marginTop:  spacing.sm2,
  },
  // Segunda línea del caso bloqueado: lo que SÍ puede hacer mientras tanto.
  stageBannerHint: {
    ...textStyles.body,
    color:      th.colors.mutedLight,
    lineHeight: textStyles.body.fontSize * 1.5,
    marginTop:  spacing.xs,
  },
  stageBannerBtns: {
    flexDirection: 'row',
    gap:           spacing.sm2,
    marginTop:     spacing.md,
  },
  stageBannerBtn: {
    flex:            1,
    paddingVertical: 11,
    borderRadius:    th.radius.md,
    borderWidth:     borders.thin,
    borderColor:     th.tint.accent50,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stageBannerBtnQuiet:     { borderColor: th.colors.border },
  stageBannerBtnText: {
    ...textStyles.caps,
    fontFamily: 'Inter_900Black',
    color:      th.colors.accent,
    textAlign:  'center',
  },
  stageBannerBtnTextQuiet: { color: th.colors.mutedLight },

  // ── Bloque de programa ────────────────────────────────────────────────────────
  programBlock: { marginTop: spacing.xl },

  // ── Sesión libre ──────────────────────────────────────────────────────────────
  // Más aire que entre dos rótulos cualesquiera: es otra zona, no otra lista
  // del programa (QA 26-sep).
  freeSection: { marginTop: spacing.xl },
  freeSessionBtn: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius:      th.radius.md,
    borderWidth:       0.5,
    borderColor:       th.tint.accent50,
    alignItems:        'center',
    marginTop:         spacing.md,
  },
  freeSessionBtnText: {
    ...textStyles.button,
    color: th.colors.accent,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: {
    alignItems:      'center',
    paddingVertical: spacing.xxl * 2,
    gap:             spacing.lg,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    ...textStyles.body,
    color:      th.colors.muted,
    textAlign:  'center',
    lineHeight: lh(textStyles.body.fontSize),
  },
  newProgramBtn: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical:   spacing.lg,
    marginTop:         spacing.sm,
  },
  newProgramBtnText: { ...textStyles.button, color: th.colors.bg },

  // ── Hojas (DragSheet + filas de MenuList) ────────────────────────────────────
  sheetGroup:     { gap: spacing.xs, paddingBottom: spacing.sm },
  freeTplEdit:    { ...textStyles.labelStrong, color: th.colors.accent },
  // Ancho de un check: reserva el hueco de la derecha para que los nombres de
  // etapa terminen todos en la misma vertical, con o sin icono.
  rowControlSpacer: { width: 16 },
  sheetIntro: {
    ...textStyles.body,
    color:        th.colors.mutedLight,
    lineHeight:   18,
    paddingBottom: spacing.md,
  },
  sheetIntroName: { color: th.colors.text },

});
