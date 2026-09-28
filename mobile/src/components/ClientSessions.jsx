/**
 * ClientSessions — la ficha de un cliente: sus sesiones y sus sesiones libres.
 *
 * `ClientSessions` es la de un cliente SIN app: sus sesiones como las vería él
 * en su Inicio, con EMPEZAR, y la puerta para apuntar lo que ya hizo
 * (docs/specs/trainer-logging.md §3.1-3.2). El entrenador hace de su app, así
 * que las piezas son las de Inicio (`SessionList`), leídas contra el historial
 * del cliente. La ficha de un cliente conectado no la usa: allí entrena él.
 *
 * `ClientFreeSessions` son sus sesiones libres, con y sin app
 * (docs/specs/group-classes.md §4.1 y §4.6).
 */
import { useState, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Text } from './ui/Text';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import DragSheet from './DragSheet';
import { MenuRow } from './ui/MenuList';
import { ExerciseLines, SessionRow, TodayCard, SectionHeader } from './SessionList';
import { startCta, relativeTime, elapsedShort } from '../utils/sessionRowText';
import { sessionPlan } from '../utils/sessionPlan';
import { sessionStats } from '../utils/sessionStats';
import { isExerciseDone } from '../utils/exerciseStatus';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

const DAY_MS = 86400000;

function PencilGlyph({ color }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </Svg>
  );
}

function lastOfIn(log, templateId) {
  for (let i = log.length - 1; i >= 0; i--) if (log[i].sessionTemplateId === templateId) return log[i];
  return null;
}

/**
 * Empezar o apuntar un entreno de este cliente. Descartar uno a medias se
 * confirma, sea mío o de otro cliente; el suyo a medias se retoma.
 */
function useClientStart(client) {
  const { t }         = useTranslation();
  const navigation    = useNavigation();
  const activeSession = useStore((s) => s.activeSession);
  const startSession  = useStore((s) => s.startSession);

  const guard = (fn) => {
    if (!activeSession.templateId) { fn(); return; }
    Alert.alert(t('workout.discardConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('workout.discardSession'), style: 'destructive', onPress: fn },
    ]);
  };
  const mine = activeSession.forClient === client.id;
  return {
    activeSession,
    activeId: mine ? activeSession.templateId : null,
    start: (templateId) => {
      if (mine && activeSession.templateId === templateId) { navigation.navigate('Workout'); return; }
      guard(() => startSession(templateId, { forClient: client.id }));
    },
    logAt: (templateId, ts) => guard(() => startSession(templateId, { forClient: client.id, loggedAt: ts, logOnly: true })),
  };
}

/**
 * Hoja «Apuntar sesión pasada» (§3.2): qué sesión y qué día, y se abre el
 * Workout en modo registro. Hoy también vale: lo que decide el modo es la
 * entrada, no la fecha.
 */
function LogPastSheet({ visible, sessions, heroId, onClose, onLog }) {
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [tplId, setTplId] = useState(heroId);
  const [dayIdx, setDayIdx] = useState(0);
  // La hoja se monta al abrirse: «hoy» es el de ese momento.
  const [now] = useState(() => Date.now());

  // Hoy y los 6 anteriores, a la hora actual (la que lleva la entrada).
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - i * DAY_MS);
    return {
      top: i === 0
        ? t('dayCard.today')
        : d.toLocaleDateString(i18n.language, { weekday: 'short' }).replace('.', ''),
      num: d.getDate(),
      ts:  d.getTime(),
    };
  }), [now, t, i18n.language]);

  const selected = tplId ?? heroId;

  return (
    <DragSheet visible={visible} onClose={onClose} title={t('clients.logPast.title')}>
      <View style={styles.sheetBody}>
        <Text style={styles.sheetLabel}>{t('clients.logPast.which').toUpperCase()}</Text>
        <View style={styles.chips}>
          {sessions.map((s) => {
            const on = s.templateId === selected;
            return (
              <TouchableOpacity
                key={s.templateId}
                style={[styles.chip, styles.chipTall, on && styles.chipOn]}
                onPress={() => setTplId(s.templateId)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipNum, on && styles.chipTextOn]}>{s.label}</Text>
                <Text style={[styles.chipSub, on && styles.chipSubOn]} numberOfLines={1}>{s.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sheetLabel}>{t('clients.logPast.when').toUpperCase()}</Text>
        <View style={styles.chips}>
          {days.map((d, i) => {
            const on = i === dayIdx;
            return (
              <TouchableOpacity
                key={d.ts}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => setDayIdx(i)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipTop, on && styles.chipTopOn]} numberOfLines={1}>{d.top.toUpperCase()}</Text>
                <Text style={[styles.chipNum, on && styles.chipTextOn]}>{d.num}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sheetHint}>{t('clients.logPast.hint')}</Text>

        <TouchableOpacity
          style={styles.cta}
          onPress={() => onLog(selected, days[dayIdx].ts)}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>{t('clients.logPast.btn')}</Text>
        </TouchableOpacity>
      </View>
    </DragSheet>
  );
}

export default function ClientSessions({ client, program, days, log }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [openId,  setOpenId]  = useState(null);
  const [logPast, setLogPast] = useState(false);

  const { activeSession, activeId, start, logAt } = useClientStart(client);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  const sessions = days
    .map((d) => ({ templateId: d.sessionTemplateId, template: getEffectiveTemplate(d.sessionTemplateId) }))
    .filter((d) => d.template)
    .map((d) => ({ ...d, label: d.template.label ?? '', name: d.template.name ?? '' }));
  const byId = new Map(sessions.map((d) => [d.templateId, d]));

  const plan = sessionPlan({
    days: sessions.map((d) => ({ templateId: d.templateId, label: d.label })),
    log,
    activeTemplateId: activeId,
    t,
  });

  const heroMeta = (d) => {
    if (activeId === d.templateId) {
      const exs  = d.template.exercises ?? [];
      const done = exs.filter((ex) => isExerciseDone(ex, activeSession.setsState?.[ex.exerciseId] ?? [])).length;
      return t('home.heroMetaActive', { done, total: exs.length, ago: elapsedShort(activeSession.startedAt) ?? '' });
    }
    const stats = sessionStats(d.template, allExercises);
    const rel   = relativeTime(lastOfIn(log, d.templateId)?.timestamp, t);
    return [
      t('home.sessionMeta', { count: stats.exercises, minutes: stats.minutes }),
      rel ? t('home.heroMetaLast', { rel: rel.toLowerCase() }) : t('home.firstTime').toLowerCase(),
    ].join(' · ');
  };

  if (!program || sessions.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <SectionHeader label={t('home.sessions').toUpperCase()} count={plan.subtitle} />
      <View style={styles.group}>
        {plan.rows.map((row) => {
          const d = byId.get(row.templateId);
          if (!d) return null;
          const open   = openId === row.templateId;
          const active = activeId === row.templateId;
          const cta    = startCta(t, d.label, { active, done: row.isDone });
          const toggle = () => setOpenId(open ? null : row.templateId);
          const a11y   = `${t('workout.sessionLabel', { label: row.marker })}, ${d.name}`;
          const lines  = <ExerciseLines template={d.template} allExercises={allExercises} />;

          if (row.isHero) {
            return (
              <TodayCard
                key={row.templateId}
                marker={row.marker}
                // «Le toca», no «Mi entreno de hoy»: el entreno es suyo.
                flag={active ? t('home.sessionActive') : t('clients.sessionFlag')}
                name={d.name}
                meta={heroMeta(d)}
                open={open}
                cta={cta}
                onToggle={toggle}
                onStart={() => start(row.templateId)}
                a11yLabel={`${plan.heroLabel}, ${a11y}`}
              >
                {lines}
              </TodayCard>
            );
          }
          const rel = relativeTime(lastOfIn(log, row.templateId)?.timestamp, t);
          return (
            <SessionRow
              key={row.templateId}
              marker={row.marker}
              name={d.name}
              meta={row.isDone && rel
                ? rel.toLowerCase()
                : t('home.rowMinutes', { minutes: sessionStats(d.template, allExercises).minutes })}
              done={row.isDone}
              open={open}
              cta={cta}
              onToggle={toggle}
              onStart={() => start(row.templateId)}
              a11yLabel={a11y}
            >
              {lines}
            </SessionRow>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.logPastBtn}
        onPress={() => setLogPast(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <PencilGlyph color={th.colors.text} />
        <Text style={styles.logPastText}>{t('clients.logPast.open')}</Text>
      </TouchableOpacity>

      {/* Montada solo mientras está abierta: así arranca siempre en la que
          toca y en Hoy. */}
      {logPast && (
        <LogPastSheet
          visible
          sessions={sessions}
          heroId={plan.heroTemplateId}
          onClose={() => setLogPast(false)}
          onLog={(templateId, ts) => { setLogPast(false); logAt(templateId, ts); }}
        />
      )}
    </View>
  );
}

/**
 * Las sesiones libres de un cliente (group-classes.md §4.1, C24): las que le
 * creaste o le asignaste desde Plantillas. Sin app, se entrenan desde aquí;
 * con app le llegan con su programa y aquí solo se consultan y se editan.
 */
export function ClientFreeSessions({ client, log }) {
  const { t }      = useTranslation();
  const styles     = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const [openId, setOpenId] = useState(null);
  const [sheet,  setSheet]  = useState(false);

  const sessionTemplates   = useStore((s) => s.sessionTemplates);
  const createFreeTemplate = useStore((s) => s.createFreeTemplate);
  const copyFreeTemplate   = useStore((s) => s.copyFreeTemplate);
  const showToast          = useStore((s) => s.showToast);
  const exerciseLibrary    = useStore((s) => s.exerciseLibrary);
  const customExercises    = useStore((s) => s.customExercises);
  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );
  const { activeId, start } = useClientStart(client);

  const all     = Object.values(sessionTemplates).filter((tpl) => !tpl.programId);
  const his     = all.filter((tpl) => tpl.owner === client.id);
  // Mis plantillas de sesión: mis sesiones libres (§4.6), sin las que me
  // hubiera mandado a mí un entrenador.
  const library = all.filter((tpl) => (tpl.owner ?? 'me') === 'me' && !tpl.fromTrainer)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const nameOf  = (tpl) => tpl.name || t('freeSession.templateUnnamed');
  const edit    = (templateId) => navigation.navigate('SessionEditor', { templateId });
  const metaOf  = (tpl) => [
    t('freeSession.templateExercises', { count: tpl.exercises?.length ?? 0 }),
    (tpl.blocks?.length ?? 0) > 0 ? t('freeSession.templateBlocks', { count: tpl.blocks.length }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.freeWrap}>
      {his.length > 0 && (
        <>
          <SectionHeader label={t('freeSession.sectionTitle').toUpperCase()} />
          <View style={styles.group}>
            {his.map((tpl) => {
              const open = openId === tpl.id;
              const rel  = relativeTime(lastOfIn(log, tpl.id)?.timestamp, t);
              return (
                <SessionRow
                  key={tpl.id}
                  marker=""
                  name={nameOf(tpl)}
                  meta={rel
                    ? rel.toLowerCase()
                    : t('home.rowMinutes', { minutes: sessionStats(tpl, allExercises).minutes })}
                  done={false}
                  open={open}
                  cta={startCta(t, '', { active: activeId === tpl.id, done: false })}
                  onToggle={() => setOpenId(open ? null : tpl.id)}
                  // Con app la entrena él: aquí no se empieza.
                  onStart={client.syncLinked ? undefined : () => start(tpl.id)}
                  onEdit={() => edit(tpl.id)}
                  a11yLabel={`${t('freeSession.badge')}, ${nameOf(tpl)}`}
                >
                  <ExerciseLines template={tpl} allExercises={allExercises} />
                </SessionRow>
              );
            })}
          </View>
        </>
      )}

      <TouchableOpacity style={styles.freeBtn} onPress={() => setSheet(true)} activeOpacity={0.75} accessibilityRole="button">
        <Text style={styles.freeBtnText}>{t('freeSession.btn')}</Text>
      </TouchableOpacity>

      {sheet && (
        <DragSheet visible onClose={() => setSheet(false)} title={t('clients.freeSheet.title', { name: client.name })}>
          <View style={styles.sheetGroup}>
            <MenuRow
              isFirst
              isLast
              label={t('clients.freeSheet.blank')}
              sub={t('clients.freeSheet.blankDesc')}
              subLines={0}
              minHeight={62}
              onPress={() => { setSheet(false); edit(createFreeTemplate(null, client.id)); }}
            />
          </View>
          {library.length > 0 && (
            <>
              <Text style={styles.sheetLabel}>{t('clients.freeSheet.fromTemplate').toUpperCase()}</Text>
              <View style={styles.sheetGroup}>
                {library.map((tpl, i) => (
                  <MenuRow
                    key={tpl.id}
                    isFirst={i === 0}
                    isLast={i === library.length - 1}
                    label={nameOf(tpl)}
                    sub={metaOf(tpl)}
                    minHeight={62}
                    onPress={() => {
                      setSheet(false);
                      copyFreeTemplate(tpl.id, { owner: client.id });
                      showToast(t('clients.freeSheet.assigned', { name: client.name }), 2200, 'success');
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </DragSheet>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  wrap:     { marginTop: spacing.sm },
  freeWrap: { marginTop: spacing.lg },
  group:    { gap: spacing.xs2 },

  // Secundario sólido, el mismo que «Editar programa» (`apBtn`): no es un
  // «＋» de crear algo, es la otra forma de apuntar.
  logPastBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm2,
    height:          44,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.surface2,
    marginTop:       spacing.md,
  },
  logPastText: { ...textStyles.button, color: th.colors.text },

  // El «＋ Sesión libre» de Inicio: contorno lima, es crear algo.
  freeBtn: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius:      th.radius.md,
    borderWidth:       0.5,
    borderColor:       th.tint.accent50,
    alignItems:        'center',
    marginTop:         spacing.md,
  },
  freeBtnText: { ...textStyles.button, color: th.colors.accent },

  // ── Hojas ──
  sheetGroup: { gap: spacing.xs, paddingBottom: spacing.sm },
  sheetBody:  { gap: spacing.sm, paddingBottom: spacing.sm },
  sheetLabel: { ...textStyles.caps, color: th.colors.mutedLight, marginTop: spacing.sm, marginBottom: spacing.xs2 },
  sheetHint:  { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.sm },
  // Chips de `NumberChips`: mismo ancho, `surface`, activo en acento.
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex:            1,
    minWidth:        0,
    alignItems:      'center',
    paddingVertical: spacing.sm,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface,
  },
  chipTall:   { paddingVertical: spacing.sm2, paddingHorizontal: spacing.xs2 },
  chipOn:     { backgroundColor: th.colors.accent },
  chipTop:    { ...textStyles.label, color: th.colors.mutedLight },
  chipTopOn:  { color: th.colors.onAccent },
  chipNum:    { ...textStyles.itemTitle, color: th.colors.mutedLight },
  chipTextOn: { color: th.colors.onAccent },
  chipSub:    { ...textStyles.label, color: th.colors.mutedLight },
  chipSubOn:  { color: th.colors.onAccent },
  cta: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    padding:         14,
    alignItems:      'center',
    marginTop:       spacing.md,
  },
  ctaText: { ...textStyles.button, color: th.colors.onAccent },
});
