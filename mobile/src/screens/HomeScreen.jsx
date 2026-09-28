import { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
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
import ProgramUpdateModal from '../components/ProgramUpdateModal';
import DragSheet from '../components/DragSheet';
import { MenuRow } from '../components/ui/MenuList';
import NoProgram from '../components/ui/NoProgram';
import { spacing, textStyles, borders, withOpacity, lh } from '../theme';
import { useThemedStyles } from '../useTheme';
import { isStageLocked } from '../utils/stageLocks';
import { FOLD_MS } from '../components/ui/collapseOut';
import {
  ExerciseLines, SessionRow, TodayCard, SectionHeader,
} from '../components/SessionList';
import { startCta, relativeTime, elapsedShort } from '../utils/sessionRowText';
import { getWeekStatuses } from '../utils/weekProgress';
import { sessionPlan } from '../utils/sessionPlan';
import { sessionStats } from '../utils/sessionStats';
import { isExerciseDone } from '../utils/exerciseStatus';

// Tint base "lima" (#b8ff00) — distinto del accent sólido (#aae216), sin
// token propio (mismo caso que el #81a71e del banner, ver theme.js).
const LIMA = '#b8ff00';

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
  // Entreno de un cliente sin app a medias: sus filas no son las mías, así que
  // sin este aviso se quedaría perdido (trainer-logging.md §3.7).
  const runningClient        = useStore((s) => (
    s.activeSession.forClient ? s.clients[s.activeSession.forClient] ?? null : null
  ));
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
  // Sin las plantillas de sesión: esas viven en Plantillas y se asignan (§4.6).
  const myFree   = Object.values(sessionTemplates).filter((tpl) => !tpl.programId && (tpl.owner ?? 'me') === 'me' && tpl.kind !== 'template');
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

        {runningClient && (
          <TouchableOpacity
            style={styles.running}
            onPress={() => navigation.navigate('Workout')}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <View style={styles.runningDot} />
            <Text style={styles.runningText} numberOfLines={1}>
              {t('home.clientRunning', {
                label: getEffectiveTemplate(activeSession.templateId)?.label ?? '',
                name:  runningClient.name,
              })}
            </Text>
            <Text style={styles.runningCta}>{t('home.btnContinue').toUpperCase()}</Text>
          </TouchableOpacity>
        )}

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
                      // Las que manda el entrenador no se editan: si quieres
                      // una tuya, la haces con «Crear» (group-classes.md §4.4).
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
                  control={tpl.fromTrainer ? null : (
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

  // Entreno de un cliente a medias. Azul: es cosa de entrenador.
  running: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    marginTop:         spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderRadius:      th.radius.md,
    backgroundColor:   withOpacity(th.colors.blue, 0.12),
  },
  runningDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: th.colors.blue },
  runningText: { ...textStyles.body, flex: 1, color: th.colors.text },
  runningCta:  { ...textStyles.labelStrong, color: th.colors.blue },

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
