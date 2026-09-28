/**
 * PasteWorkoutScreen — pegar el texto que devolvió un cliente y que la app lo
 * entienda (docs/specs/trainer-logging.md §6, C22).
 *
 * Se entra desde la cabecera de Clientes (sin cliente: lo dice el propio
 * texto, que lleva su nombre en la cabecera) o desde «Apuntar sesión pasada»
 * de su ficha (con el cliente ya puesto). Quién, qué sesión y cuándo se eligen
 * aquí; la revisión es una fila por línea con lo entendido, y lo que no se
 * reconoce se resuelve a mano una vez y queda como alias.
 *
 * CONTINUAR abre el Workout en modo registro con todo relleno: la revisión
 * final es el propio Workout, y el guardado es `saveSession`, sin un camino
 * nuevo.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import ScreenHeader from '../components/ui/ScreenHeader';
import { SessionChips, DayChips } from '../components/ClientSessions';
import { useLastDays } from '../hooks/useLastDays';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { parseSessionText, readAnswer, exerciseIndex, normName } from '../utils/sessionText';
import { exerciseName } from '../utils/prescription';
import { clientLink } from '../utils/clientLink';
import { sessionPlan } from '../utils/sessionPlan';
import { athleteProgress, stageStatus, stageDaysAt } from '../utils/stageProgress';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import es from '../locales/es.json';
import en from '../locales/en.json';

/** Las sesiones que se le pueden apuntar: las de su etapa y sus libres. */
function sessionsOf(client, programs, sessionTemplates, unnamed) {
  const program = programs[client?.activeProgramId];
  const days = program
    ? stageDaysAt(program, stageStatus(program, athleteProgress(program, client)).stageIdx)
    : [];
  const fromProgram = days
    .map((d) => sessionTemplates[d.sessionTemplateId])
    .filter(Boolean)
    .map((tpl) => ({ templateId: tpl.id, label: tpl.label ?? '', name: tpl.name ?? '' }));
  const free = Object.values(sessionTemplates)
    .filter((tpl) => !tpl.programId && tpl.owner === client?.id)
    .map((tpl) => ({ templateId: tpl.id, label: '', name: tpl.name || unnamed, free: true }));
  return [...fromProgram, ...free];
}

/** «Sesión C» en los dos idiomas, para reconocerla en la cabecera. */
const labelKeys = (label) => [es, en].map((d) => normName(d.workout.sessionLabel.replace('{{label}}', label)));

/** «4 × 6 · 100 kg» si todas iguales; si no, la lista. */
function summary(sets, unit) {
  const one = (s) => {
    if (s.time !== '') return `${s.time}s`;
    if (s.weight !== '' && s.reps !== '') return `${s.weight}×${s.reps}`;
    return s.weight !== '' ? `${s.weight} ${unit}` : `${s.reps}`;
  };
  const same = sets.every((s) => s.weight === sets[0].weight && s.reps === sets[0].reps && s.time === sets[0].time);
  const rpe  = sets[0].rpe && sets.every((s) => s.rpe === sets[0].rpe) ? ` @${sets[0].rpe}` : '';
  if (!same) return sets.map((s) => one(s) + (s.rpe && !rpe ? `@${s.rpe}` : '')).join(', ') + rpe;
  const s = sets[0];
  const what = s.time !== '' ? `${s.time}s` : (s.reps !== '' ? `${s.reps}` : '—');
  return `${sets.length} × ${what}${s.weight !== '' ? ` · ${s.weight} ${unit}` : ''}${rpe}`;
}

export default function PasteWorkoutScreen({ navigation, route }) {
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const lockedClientId = route.params?.clientId ?? null;

  const clients          = useStore((s) => s.clients);
  const programs         = useStore((s) => s.programs);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const clientLogs       = useStore((s) => s.clientLogs);
  const trainerSync      = useStore((s) => s.trainerSync);
  const exerciseLibrary  = useStore((s) => s.exerciseLibrary);
  const customExercises  = useStore((s) => s.customExercises);
  const exerciseAliases  = useStore((s) => s.exerciseAliases);
  const activeSession    = useStore((s) => s.activeSession);
  const startSession     = useStore((s) => s.startSession);
  const setExerciseAlias = useStore((s) => s.setExerciseAlias);
  const pickerResult     = useStore((s) => s.ui._blockPickerResult);
  const setPickerResult  = useStore((s) => s.setBlockPickerResult);
  const { label: unit, toKg } = useWeightUnit();
  const allExercises = useMemo(() => ({ ...exerciseLibrary, ...customExercises }), [exerciseLibrary, customExercises]);

  const [text,       setText]       = useState('');
  const [pickedId,   setPickedId]   = useState(null);
  const [pickedTpl,  setPickedTpl]  = useState(null);
  const [dayIdx,     setDayIdx]     = useState(0);
  const days = useLastDays();

  // Lo normal es venir de WhatsApp con el texto copiado: se pega solo.
  useEffect(() => {
    Clipboard.getStringAsync().then((s) => { if (s?.trim()) setText((cur) => cur || s); }).catch(() => {});
  }, []);
  const pasteNow = () => Clipboard.getStringAsync().then((s) => { if (s?.trim()) setText(s); }).catch(() => {});

  const parsed = useMemo(() => parseSessionText(text), [text]);
  const headerKeys = useMemo(() => new Set((parsed.header ?? []).map(normName)), [parsed.header]);

  // ── Quién ── Solo clientes sin app: los conectados apuntan ellos (§2.1).
  const offline = useMemo(() => Object.values(clients)
    .filter((c) => clientLink(c, trainerSync) === 'none')
    .sort((a, b) => a.name.localeCompare(b.name)), [clients, trainerSync]);
  const named = Object.values(clients).find((c) => headerKeys.has(normName(c.name))) ?? null;
  const namedOnline = named && clientLink(named, trainerSync) !== 'none' ? named : null;
  const clientId = lockedClientId ?? pickedId ?? (named && !namedOnline ? named.id : null);
  const client   = clients[clientId] ?? null;

  // ── Qué sesión ── La que diga la cabecera; si no, la que le toca.
  const sessions = useMemo(() => sessionsOf(client, programs, sessionTemplates, t('freeSession.templateUnnamed')), [client, programs, sessionTemplates, t]);
  const log = clientLogs[clientId] ?? [];
  const headerTpl = sessions.find((s) => s.label && labelKeys(s.label).some((k) => headerKeys.has(k)))
    ?? sessions.find((s) => s.name && headerKeys.has(normName(s.name)));
  const hero = sessionPlan({ days: sessions.filter((s) => s.label).map((s) => ({ templateId: s.templateId, label: s.label })), log, t }).heroTemplateId;
  const tplId = [pickedTpl, headerTpl?.templateId, hero, sessions[0]?.templateId]
    .find((id) => id && sessions.some((s) => s.templateId === id)) ?? null;
  const template = sessionTemplates[tplId] ?? null;

  // ── Revisión ──
  const inSession = useMemo(() => new Map((template?.exercises ?? []).map((ex) => [ex.exerciseId, ex])), [template]);
  const find = useMemo(
    () => exerciseIndex(allExercises, exerciseAliases ?? {}, [...inSession.keys()]),
    [allExercises, exerciseAliases, inSession],
  );
  const rows = parsed.lines.map((l, i) => {
    if (l.ignored) return { key: i, kind: 'ignored', raw: l.raw };
    if (l.block)   return { key: i, kind: 'block', raw: l.raw, name: l.name };
    return { key: i, kind: 'ex', name: l.name, exerciseId: find(l.name), sets: readAnswer(l.answer, l.rx, l.hint) };
  });
  const usable = rows.filter((r) => r.kind === 'ex' && r.exerciseId && r.sets);

  // ELEGIR: el selector de siempre, en su modo de elegir uno; lo que vuelve se
  // guarda como alias y la fila se reconoce sola.
  const pendingName = useRef(null);
  useEffect(() => {
    if (!pickerResult || !pendingName.current) return;
    setExerciseAlias(pendingName.current, pickerResult);
    pendingName.current = null;
    setPickerResult(null);
  }, [pickerResult, setExerciseAlias, setPickerResult]);
  const pick = (name) => {
    pendingName.current = name;
    navigation.navigate('ExerciseSelector', { blockPicker: true, eyebrow: `«${name}»`, title: t('paste.pickTitle') });
  };

  function onContinue() {
    const kgSet = (s) => {
      const hasWork = s.reps !== '' || s.time !== '';
      return {
        weight: s.weight === '' ? '' : String(toKg(s.weight)),
        reps:   s.reps === '' ? '' : String(s.reps),
        time:   s.time === '' ? '' : String(s.time),
        ...(s.rpe ? { rpe: String(s.rpe) } : {}),
        // Una serie sin reps ni tiempo (un «ok» con rango) se queda abierta:
        // eso lo pone el entrenador en el Workout.
        done: hasWork,
      };
    };
    const setsState = {};
    const adHoc = [];
    usable.forEach((r) => {
      const sets = r.sets.map(kgSet);
      if (inSession.has(r.exerciseId)) setsState[r.exerciseId] = [...(setsState[r.exerciseId] ?? []), ...sets];
      else {
        const prev = adHoc.find((a) => a.exerciseId === r.exerciseId);
        if (prev) prev.setsState.push(...sets); else adHoc.push({ exerciseId: r.exerciseId, setsState: sets });
      }
    });
    const go = () => {
      navigation.goBack();
      startSession(tplId, { forClient: clientId, loggedAt: days[dayIdx].ts, logOnly: true, prefill: { setsState, adHoc } });
    };
    if (!activeSession.templateId) { go(); return; }
    Alert.alert(t('workout.discardConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('workout.discardSession'), style: 'destructive', onPress: go },
    ]);
  }

  const canGo = !!clientId && !!tplId && usable.length > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader onBack={() => navigation.goBack()} eyebrow={t('paste.eyebrow')} title={t('paste.title')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.inputBox}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            multiline
            placeholder={t('paste.placeholder')}
            placeholderTextColor={th.colors.muted}
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.pasteBtn} onPress={pasteNow} activeOpacity={0.75} accessibilityRole="button">
            <Text style={styles.pasteBtnText}>{t('paste.pasteBtn').toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Quién ── */}
        {!lockedClientId && (
          <>
            <Text style={styles.label}>{t('paste.who').toUpperCase()}</Text>
            {namedOnline && <Text style={styles.hint}>{t('paste.online', { name: namedOnline.name })}</Text>}
            {offline.length === 0 ? (
              <Text style={styles.hint}>{t('paste.noClients')}</Text>
            ) : (
              <SessionChips
                wrap
                sessions={offline.map((c) => ({ templateId: c.id, label: '', name: c.name }))}
                selected={clientId}
                onSelect={(id) => { setPickedId(id); setPickedTpl(null); }}
              />
            )}
          </>
        )}

        {/* ── Qué sesión y cuándo ── */}
        {!!client && (
          sessions.length === 0 ? (
            <Text style={[styles.hint, styles.gapTop]}>{t('paste.noSessions', { name: client.name })}</Text>
          ) : (
            <>
              <Text style={styles.label}>{t('clients.logPast.which').toUpperCase()}</Text>
              {/* Las del programa con su letra, como en «Apuntar sesión pasada»;
                  las libres aparte, por su nombre. */}
              {sessions.some((x) => !x.free) && (
                <SessionChips sessions={sessions.filter((x) => !x.free)} selected={tplId} onSelect={setPickedTpl} />
              )}
              {sessions.some((x) => x.free) && (
                <>
                  <Text style={styles.subLabel}>{t('freeSession.sectionTitle').toUpperCase()}</Text>
                  <SessionChips wrap sessions={sessions.filter((x) => x.free)} selected={tplId} onSelect={setPickedTpl} />
                </>
              )}
              <Text style={styles.label}>{t('clients.logPast.when').toUpperCase()}</Text>
              <DayChips days={days} selected={dayIdx} onSelect={setDayIdx} />
            </>
          )
        )}

        {/* ── Lo que se ha entendido ── */}
        <Text style={styles.label}>{t('paste.review').toUpperCase()}</Text>
        {rows.length === 0 ? (
          <Text style={styles.hint}>{t('paste.empty')}</Text>
        ) : (
          <View style={styles.rows}>
            {rows.map((r) => {
              if (r.kind === 'ignored') {
                return <Text key={r.key} style={styles.ignored} numberOfLines={2}>{r.raw}</Text>;
              }
              if (r.kind === 'block') {
                return (
                  <View key={r.key} style={styles.row}>
                    <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.rowMeta}>{t('paste.block')}</Text>
                  </View>
                );
              }
              const exCfg = inSession.get(r.exerciseId);
              const extra = r.exerciseId && !exCfg;
              const trimmed = exCfg && r.sets && r.sets.length > exCfg.sets;
              return (
                <View key={r.key} style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={[styles.rowName, !r.exerciseId && styles.rowUnknown]} numberOfLines={1}>
                      {r.exerciseId ? exerciseName(allExercises[r.exerciseId], i18n.language, r.exerciseId) : r.name}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={2}>
                      {!r.exerciseId
                        ? t('paste.unknown')
                        : r.sets ? summary(r.sets, unit) : t('paste.notDone')}
                      {extra ? ` · ${t('paste.added')}` : ''}
                    </Text>
                    {trimmed && <Text style={styles.rowWarn}>{t('paste.trimmed', { count: exCfg.sets })}</Text>}
                  </View>
                  {!r.exerciseId && (
                    <TouchableOpacity style={styles.pickBtn} onPress={() => pick(r.name)} activeOpacity={0.75} accessibilityRole="button">
                      <Text style={styles.pickBtnText}>{t('paste.pick').toUpperCase()}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.foot}>
        <TouchableOpacity
          style={[styles.cta, !canGo && styles.ctaOff]}
          onPress={onContinue}
          disabled={!canGo}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGo }}
        >
          <Text style={styles.ctaText}>{t('paste.continue').toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: th.colors.bg },
  body:   { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },

  inputBox: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         12,
    marginTop:       spacing.md,
  },
  input: { ...textStyles.body, color: th.colors.text, minHeight: 96, maxHeight: 180, padding: 0 },
  pasteBtn: {
    alignSelf:         'flex-end',
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop:         spacing.sm,
  },
  pasteBtnText: { ...textStyles.button, color: th.colors.text },

  // Los rótulos de la hoja «Apuntar sesión pasada», que es la misma pregunta.
  label:  { ...textStyles.caps, color: th.colors.mutedLight, marginTop: spacing.lg, marginBottom: spacing.sm },
  hint:   { ...textStyles.body, color: th.colors.mutedLight, marginBottom: spacing.sm },
  subLabel: { ...textStyles.caps, color: th.colors.muted, marginTop: spacing.md, marginBottom: spacing.sm },
  gapTop: { marginTop: spacing.lg },

  rows: { gap: spacing.xs2 },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingVertical:   12,
    paddingHorizontal: 14,
  },
  rowMain:    { flex: 1, minWidth: 0, gap: spacing.xs },
  rowName:    { ...textStyles.itemTitle, color: th.colors.text },
  rowUnknown: { color: th.colors.orange },
  rowMeta:    { ...textStyles.label, color: th.colors.mutedLight },
  rowWarn:    { ...textStyles.label, color: th.colors.orange },
  // Lo que no es un ejercicio se enseña tachado: no se ha perdido, se ha visto.
  ignored: {
    ...textStyles.label,
    color:              th.colors.muted,
    textDecorationLine: 'line-through',
    paddingHorizontal:  14,
    paddingVertical:    spacing.xs,
  },
  pickBtn: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pickBtnText: { ...textStyles.button, color: th.colors.text },

  foot: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  cta: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    padding:         14,
    alignItems:      'center',
  },
  ctaOff:  { opacity: 0.4 },
  ctaText: { ...textStyles.button, color: th.colors.onAccent },
});
