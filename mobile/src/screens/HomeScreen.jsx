import { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../components/ui/Text';
// Reanimated lleva las dos mitades del plegado: el `layout` de la tarjeta
// anima su propio alto y el contenido entra y sale con opacidad. Es el patrón
// del acordeón de `SessionCard`; ningún `Animated.Value` persiguiendo alturas
// desde JS.
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useStore, selectActiveProgram } from '../../store/useStore';
import { stageDaysAt, athleteProgress, stageStatus, stageBannerDue, localDay, addDays } from '../utils/stageProgress';
import AppHeader from '../components/AppHeader';
import ActiveSessionBanner from '../components/ActiveSessionBanner';
import HomeProgramCard from '../components/HomeProgramCard';
import SessionTabsCard from '../components/SessionTabsCard';
import ProgramUpdateModal from '../components/ProgramUpdateModal';
import DragSheet from '../components/DragSheet';
import SheetRow from '../components/ui/SheetRow';
import { ROW_ICON } from '../components/ui/rowIcons';
import NoProgram from '../components/ui/NoProgram';
import { spacing, textStyles, borders } from '../theme';
import { useThemedStyles } from '../useTheme';
import { isStageLocked } from '../utils/stageLocks';
import { FOLD_MS } from '../components/ui/collapseOut';
import { useSteadyFold } from '../components/ui/useSteadyFold';
import {
  ExerciseLines, SessionRow, TodayCard, SectionHeader,
} from '../components/SessionList';
import { startCta, relativeTime } from '../utils/sessionRowText';
import { getWeekStatuses } from '../utils/weekProgress';
import { sessionPlan } from '../utils/sessionPlan';
import { sessionStats } from '../utils/sessionStats';

import { confirmDiscardActive } from '../components/ui/confirmDiscard';
// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── HomeScreen ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t }      = useTranslation();
  const styles     = useThemedStyles(makeStyles);

  const [freeSheet,   setFreeSheet]   = useState(false);
  const [tplList,     setTplList]     = useState(false);
  // Acordeón puro: como mucho una sesión abierta. Ni se persiste ni se
  // recuerda al volver — es una preferencia de un segundo, no un ajuste.
  // Sin saltos de golpe al plegar cerca del final: `useSteadyFold`.
  const fold = useSteadyFold();

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
  const copyFreeTemplate     = useStore((s) => s.copyFreeTemplate);
  const showToast            = useStore((s) => s.showToast);
  const clientSync           = useStore((s) => s.clientSync);
  const advanceStage         = useStore((s) => s.advanceStage);
  const extendStage          = useStore((s) => s.extendStage);
  const snoozeStageBanner    = useStore((s) => s.snoozeStageBanner);
  const stageBannerSnooze    = useStore((s) => s.stageBannerSnooze);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  // Lista plegable (U04) o una tarjeta con pestañas (U13), a elegir en Preferencias.
  const homeView             = useStore((s) => s.profile.homeView ?? 'cards');

  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  // Empezar una sesión que no toca ya no lleva diálogo: hay que abrir su
  // tarjeta y pulsar un botón que además va en contorno, o sea dos toques
  // deliberados. El aviso solo añadía fricción (spec §5.6). Descartar una
  // sesión a medias, en cambio, se sigue confirmando: ahí sí se pierde algo.
  const requestStart = (templateId) => {
    if (activeSession.templateId === templateId) { navigation.navigate('Workout'); return; }
    if (activeSession.templateId) { confirmDiscardActive(t, () => startSession(templateId)); return; }
    startSession(templateId);
  };

  const startFree = () => {
    if (activeSession.templateId) { confirmDiscardActive(t, () => startFreeSession()); return; }
    startFreeSession();
  };

  // ── Sesiones libres (T06-free-sessions.md §6) ──
  // Solo las MÍAS (§4.1.1): las de un cliente o un grupo no salen en mi Inicio.
  // `Object.values` conserva el orden de alta, que es el de la lista.
  // Sin las plantillas de sesión: esas viven en Plantillas y se asignan (§4.6).
  const myFree   = Object.values(sessionTemplates).filter((tpl) => !tpl.programId && (tpl.owner ?? 'me') === 'me' && tpl.kind !== 'template');
  // Toda sesión mía sale en Inicio (QA 28-sep): lo que no quieres aquí es una
  // plantilla, y las plantillas viven en Plantillas.
  const homeFree = myFree;
  // Las plantillas de sesión, para llevarte una copia (C06-group-classes.md §4.6).
  const templates = Object.values(sessionTemplates)
    .filter((tpl) => !tpl.programId && tpl.kind === 'template')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
        {...fold.scrollProps}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* La sesión a medias, sea cual sea, arriba de todo (U52). */}
        <ActiveSessionBanner />

        {/* En qué programa estás y por qué semana vas (U12). Lleva al tab
            Programa. Provisional: el reparto entre Inicio y Programa está por
            diseñar (U12-02). */}
        {activeProgram && (
          <HomeProgramCard program={activeProgram} onOpen={() => navigation.navigate('MyProgram')} />
        )}

        <WeekSelector workoutLog={workoutLog} />

        {activeProgram ? (() => {
          // Dónde va de la etapa: la misma cuenta que ve su entrenador
          // (P08-weeks-model.md §3.7). El día se lee al pintar.
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
            log: workoutLog,
            t,
            // Rotación, la semana desde la A, o libre: lo dice el programa (U13 §8-9).
            order: activeProgram.sessionOrder,
          });

          // ── Aviso de fin de etapa (P08-weeks-model.md §6.1) ──
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
          // vez. Igual si está a medias: cuánto llevas lo dice el banner (U52).
          const todayMeta = (day) => {
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
                {homeView === 'tabs' ? (
                  <SessionTabsCard
                    heroId={plan.heroTemplateId}
                    sessions={plan.rows.filter((row) => byId.has(row.templateId)).map((row) => {
                      const day   = byId.get(row.templateId);
                      const stats = sessionStats(day.template, allExercises);
                      const rel   = relativeTime(day.lastSession?.timestamp, t);
                      const name  = day.template.name ?? '';
                      return {
                        id:      row.templateId,
                        marker:  row.marker,
                        name,
                        done:    row.isDone,
                        // Lo que dice la maqueta, y cuándo fue si ya está hecha.
                        meta:    [
                          t('home.sessionMeta', { count: stats.exercises, minutes: stats.minutes }),
                          row.isDone && rel ? rel : null,
                        ].filter(Boolean).join(' · '),
                        adapted: !!clientSync.pendingOverrides?.[row.templateId],
                        // El mismo texto que en la lista: EMPEZAR SESIÓN B.
                        cta:     startCta(t, day.template.label ?? '', { active: activeSession.templateId === row.templateId, done: row.isDone }),
                        onStart: () => requestStart(row.templateId),
                        a11y:    `${t('workout.sessionLabel', { label: row.marker })}, ${name}, ${row.isDone ? t('home.sessionDone') : t('home.sessionPending')}`,
                        lines:   <ExerciseLines template={day.template} allExercises={allExercises} />,
                      };
                    })}
                  />
                ) : (
                <View style={styles.group}>
                  {plan.rows.map((row) => {
                    const day = byId.get(row.templateId);
                    if (!day) return null;
                    const active = activeSession.templateId === row.templateId;
                    const name   = day.template.name ?? '';
                    const cta    = startCta(t, day.template.label ?? '', { active, done: row.isDone });
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
                          {...fold.row(row.templateId)}
                          cta={cta}
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
                        {...fold.row(row.templateId)}
                        cta={cta}
                        onStart={start}
                        a11yLabel={a11y}
                      >
                        {lines}
                      </SessionRow>
                    );
                  })}
                </View>
                )}
              </View>

            </>
          );
        })() : (
          <NoProgram />
        )}

        {/* ── Sesiones libres (T06-free-sessions.md §6.1) ── También sin programa:
            tener sesiones sueltas sin programa es justo uno de sus usos. Con
            `layout` porque al plegar una sesión de arriba sube o baja: sin él
            daba el salto de golpe mientras la tarjeta seguía animando. */}
        <Reanimated.View layout={LinearTransition.duration(FOLD_MS)}>
          {homeFree.length > 0 && (
            <View style={styles.freeSection}>
              <SectionHeader label={t('freeSession.sectionTitle').toUpperCase()} />
              <View style={styles.group}>
                {homeFree.map((tpl, i) => {
                  const active = activeSession.templateId === tpl.id;
                  const rel    = relativeTime(getLastSession(tpl.id)?.timestamp, t);
                  const name   = freeName(tpl);
                  return (
                    <SessionRow
                      key={tpl.id}
                      // Número donde las del programa llevan la letra (U31), en el
                      // gris de las hechas y no en lima: numera, no dice qué toca.
                      marker={String(i + 1).padStart(2, '0')}
                      markerMuted
                      name={name}
                      meta={rel
                        ? rel.toLowerCase()
                        : t('home.rowMinutes', { minutes: sessionStats(tpl, allExercises).minutes })}
                      done={false}
                      {...fold.row(tpl.id)}
                      cta={startCta(t, '', { active, done: false })}
                      onStart={() => requestStart(tpl.id)}
                      // Las que manda el entrenador no se editan: si quieres
                      // una tuya, la haces con «Crear» (C06-group-classes.md §4.4).
                      onEdit={tpl.fromTrainer ? undefined : () => editFree(tpl.id)}
                      by={tpl.fromTrainer ? (tpl.trainerName || clientSync.trainerName || '') : null}
                      a11yLabel={`${t('freeSession.badge')}, ${name}`}
                    >
                      <ExerciseLines template={tpl} allExercises={allExercises} />
                    </SessionRow>
                  );
                })}
              </View>
            </View>
          )}

          {/* Con `layout` propio: al abrir una sesión libre se mueve dentro de
              la sección, y el `layout` de fuera no lo cubre. */}
          <Reanimated.View layout={LinearTransition.duration(FOLD_MS)}>
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
        </Reanimated.View>

        <View style={{ height: fold.pad }} />
      </ScrollView>

      {/* Modals */}
      {/* ── ＋ Sesión libre (T06-free-sessions.md §6.2) ── */}
      {freeSheet && (
        <DragSheet visible onClose={() => setFreeSheet(false)} title={t('freeSession.startTitle')}>
          <View style={styles.sheetGroup}>
            <SheetRow
              isFirst
              icon={ROW_ICON.start}
              label={t('freeSession.startNow')}
              sub={t('freeSession.startNowDesc')}
              subLines={0}
              minHeight={62}
              onPress={() => { setFreeSheet(false); startFree(); }}
            />
            <SheetRow
              isLast={templates.length === 0}
              icon={ROW_ICON.new}
              label={t('freeSession.create')}
              sub={t('freeSession.createDesc')}
              subLines={0}
              minHeight={62}
              onPress={() => {
                setFreeSheet(false);
                editFree(createFreeTemplate());
              }}
            />
            {/* Como en la ficha de un cliente: te llevas una copia a Inicio y
                la adaptas sin tocar la plantilla. Sin plantillas (sin PRO, o sin
                haber hecho ninguna) no sale. */}
            {templates.length > 0 && (
              <SheetRow
                isLast
                icon={ROW_ICON.preset}
                label={t('freeSession.fromTemplates')}
                value={String(templates.length)}
                sub={t('freeSession.fromTemplatesDesc')}
                subLines={0}
                minHeight={62}
                onPress={() => { setFreeSheet(false); setTplList(true); }}
              />
            )}
          </View>
        </DragSheet>
      )}

      {/* Tus plantillas de sesión: tocar una la copia a tu Inicio. */}
      {tplList && (
        <DragSheet visible onClose={() => setTplList(false)} title={t('freeSession.templatesTitle')}>
          <View style={styles.sheetGroup}>
            {templates.map((tpl, i) => (
              <SheetRow
                key={tpl.id}
                icon={ROW_ICON.preset}
                isFirst={i === 0}
                isLast={i === templates.length - 1}
                label={freeName(tpl)}
                sub={freeMeta(tpl)}
                minHeight={62}
                onPress={() => {
                  setTplList(false);
                  copyFreeTemplate(tpl.id, { owner: 'me' });
                  showToast(t('freeSession.addedToHome'), 2200, 'success');
                }}
              />
            ))}
          </View>
        </DragSheet>
      )}
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

  // ── Selector semanal (L M X J V S D + 7 puntos) ───────────────────────────────
  week: {
    gap:               spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical:   9, // exacto de Figma, no cae en ningún token de spacing
  },
  weekLetters: { flexDirection: 'row', justifyContent: 'space-between' },
  weekLetter:  { ...textStyles.labelStrong, color: th.colors.mutedLight },
  weekLetterToday: { color: th.colors.accent },
  weekDots: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDot: {
    width:        12,
    height:       12,
    borderRadius: 6,
  },
  weekDotTrained: { backgroundColor: th.colors.accent },
  weekDotIdle:    { backgroundColor: th.colors.muted },

  // La lista de sesiones vive en `components/SessionList.jsx`; aquí solo el
  // contenedor de las sesiones libres, que es el mismo `group`.
  group: { gap: spacing.xs2 },

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

  // ── Hojas (DragSheet + filas de MenuList) ────────────────────────────────────
  sheetGroup:     { gap: spacing.xs, paddingBottom: spacing.sm },
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
