/**
 * NextSessionScreen — trainer's one-off prescription for a client's NEXT
 * session. Not the program editor: targets here are single-use and consumed
 * when the client trains that session. Reached from the client card's "···".
 *
 * Per session (selector at top), each exercise shows what the client did last
 * time and an editable target (weight / reps) + a one-off note. "Enviar"
 * uploads the overrides to the client's slot.
 *
 * Sin nodo en Figma: cada pieza se copia de una pantalla ya migrada, como el
 * Recap. Cabecera, segmentado de sesiones y resumen del editor de sesión
 * (`SessionEditorScreen`); tarjeta, rejilla de celdas y tira de nota del
 * entrenador del Workout (`workout/ExerciseCard` + `SetRow`) — lo que se
 * escribe aquí es lo que el cliente verá en esa misma tarjeta, en azul.
 */

import { useState, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Alert, Keyboard } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { clientStageIndex, stageDaysAt, progressFromBlob } from '../utils/stageProgress';
import { sessionPlan } from '../utils/sessionPlan';
import { targetLabel } from '../utils/prescription';
import ScreenHeader from '../components/ui/ScreenHeader';
import SegmentedControl from '../components/ui/SegmentedControl';
import { GRID } from '../components/workout/grid';
import { spacing, textStyles, lh, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

// Radios de la tarjeta de ejercicio del Workout (`ExerciseCard`: R_CARD / R_SMALL).
const R_CARD  = 16;
const R_SMALL = 9;

/** Input type for an exercise (matches ExerciseCard's fallback logic). */
function inputTypeFor(exConfig, def) {
  return exConfig.inputType ?? (def?.progressionModel === 'time_progression' ? 'time' : 'weight_reps');
}

/** Editable target fields for an exercise: [key, column label] pairs. */
function fieldsFor(inputType, trackRpe, t) {
  const reps = ['reps', t('workout.reps')];
  const time = ['time', t('workout.timeSec')];
  const kg   = ['weight', 'kg'];
  const base = inputType === 'reps'        ? [reps]
             : inputType === 'time'        ? [time]
             : inputType === 'weight_time' ? [kg, time]
             :                               [kg, reps];
  if (trackRpe) base.push(['rpe', 'RPE']);
  return base;
}

function lastSummary(lastExData, inputType) {
  const sets = lastExData?.sets ?? [];
  if (!sets.length) return null;
  const clean = (vals) => vals.filter((v) => v !== '' && v != null);

  if (inputType === 'time') {
    const times = clean(sets.map((s) => s.time));
    return times.length ? `${times.join(', ')} s` : null;
  }

  const weights = [...new Set(clean(sets.map((s) => s.weight)))];
  const wPart = weights.length === 0 ? ''
    : weights.length === 1 ? `${weights[0]} kg`
    : `${Math.min(...weights.map(Number))}–${Math.max(...weights.map(Number))} kg`;
  const secondVals = inputType === 'weight_time'
    ? clean(sets.map((s) => s.time))
    : clean(sets.map((s) => s.reps));
  const second = secondVals.length
    ? (inputType === 'weight_time' ? `${secondVals.join(', ')} s` : secondVals.join(', '))
    : '';
  if (!wPart && !second) return null;
  return [wPart, second].filter(Boolean).join(' · ');
}

export default function NextSessionScreen({ navigation, route }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const clientId = route.params?.clientId;

  const clients          = useStore((s) => s.clients);
  const programs         = useStore((s) => s.programs);
  const clientLogs       = useStore((s) => s.clientLogs);
  const exerciseLibrary  = useStore((s) => s.exerciseLibrary);
  const customExercises  = useStore((s) => s.customExercises);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const setOverrideTarget    = useStore((s) => s.setOverrideTarget);
  const clearOverride        = useStore((s) => s.clearOverride);
  const sendOverrides        = useStore((s) => s.sendOverrides);
  const showToast            = useStore((s) => s.showToast);

  const client        = clients?.[clientId];
  const activeProgram = client ? programs[client.activeProgramId] : null;
  const allExercises  = { ...exerciseLibrary, ...customExercises };

  // Las sesiones que se pueden prescribir son las de la etapa en la que está el
  // cliente DE VERDAD (su progreso espejado), no la que tenga marcada la copia
  // local del entrenador — que no se mueve sola y dejaba preparar sesiones de
  // una etapa que el cliente ya había dejado atrás.
  const templateIds = useMemo(() => {
    if (!activeProgram) return [];
    // La etapa del CLIENTE, no la que el entrenador tenga activada.
    const days = stageDaysAt(activeProgram, clientStageIndex(client, activeProgram));
    return days.map((d) => d.sessionTemplateId);
  }, [activeProgram, client]);

  // La que le toca, por la misma regla que la Home del cliente y la tarjeta de
  // Clientes: `sessionPlan()` sobre su ciclo espejado (qa-sep-conexion.md §6).
  // Antes abría siempre la primera, la A.
  const nextId = useMemo(() => {
    if (!activeProgram) return null;
    const cycleCompletedIds = progressFromBlob(client?.progress, activeProgram.id)?.cycleCompletedIds
      ?? activeProgram.cycleCompletedIds;
    const days = templateIds.map((tid) => ({ templateId: tid, label: getEffectiveTemplate(tid)?.label }));
    return sessionPlan({ days, cycleCompletedIds, t }).heroTemplateId;
  }, [activeProgram, client, templateIds, getEffectiveTemplate, t]);

  // Selected session — clamped during render so it stays valid without an effect.
  const [selRaw, setSelRaw] = useState(null);
  const selectedId = (selRaw && templateIds.includes(selRaw)) ? selRaw : (nextId ?? templateIds[0] ?? null);

  const template = selectedId ? getEffectiveTemplate(selectedId) : null;
  const override = client?.nextOverrides?.[selectedId] ?? null;

  // Most recent logged session of the selected template.
  const lastLog = useMemo(() => {
    const log = clientLogs?.[clientId] ?? [];
    return [...log]
      .filter((e) => e.sessionTemplateId === selectedId)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))[0] ?? null;
  }, [clientLogs, clientId, selectedId]);

  // Local draft seeded from the stored override; committed on blur. Reset when
  // the session changes via the render-time reset pattern (no effect needed).
  const buildSeed = (ov = override) => {
    const ex = ov?.exercises ?? {};
    const seed = {};
    (template?.exercises ?? []).forEach(({ exerciseId }) => {
      const o = ex[exerciseId] ?? {};
      seed[exerciseId] = {
        weight: o.weight != null ? String(o.weight) : '',
        reps:   o.reps   != null ? String(o.reps)   : '',
        time:   o.time   != null ? String(o.time)   : '',
        rpe:    o.rpe    != null ? String(o.rpe)    : '',
        note:   o.note   ?? '',
      };
    });
    return seed;
  };
  const [draft, setDraft]       = useState(buildSeed);
  const [draftKey, setDraftKey] = useState(selectedId);
  if (draftKey !== selectedId) {
    setDraftKey(selectedId);
    setDraft(buildSeed());
  }

  if (!client) return null;

  function setField(exerciseId, field, value) {
    setDraft((d) => ({ ...d, [exerciseId]: { ...d[exerciseId], [field]: value } }));
  }
  function commitField(exerciseId, field) {
    setOverrideTarget(clientId, selectedId, exerciseId, { [field]: draft[exerciseId]?.[field]?.trim() ?? '' });
  }

  const hasTargets = Object.values(override?.exercises ?? {}).length > 0;

  async function handleSend() {
    Keyboard.dismiss();
    if (!client.syncSlotId) {
      Alert.alert(t('nextSession.notConnectedTitle'), t('nextSession.notConnectedBody'));
      return;
    }
    try {
      await sendOverrides(clientId);
      showToast(t('nextSession.sent', { name: client.name }), 2200, 'success');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message ?? t('nextSession.sendFailed'));
    }
  }

  function handleClear() {
    clearOverride(clientId, selectedId);
    setDraft(buildSeed(null));
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        eyebrow={t('nextSession.title')}
        title={client.name}
        right={hasTargets ? (ink) => (
          <TouchableOpacity onPress={handleClear} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.clearText, { color: ink }]}>{t('nextSession.clear')}</Text>
          </TouchableOpacity>
        ) : undefined}
      />

      {!activeProgram ? (
        <View style={styles.empty}><Text style={styles.emptyText}>{t('nextSession.noProgram')}</Text></View>
      ) : (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxl }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Sesiones de la etapa — el mismo segmentado que el editor de sesión */}
            {templateIds.length > 1 && (
              <SegmentedControl
                options={templateIds.map((id) => ({ id, label: getEffectiveTemplate(id)?.label ?? '·' }))}
                value={selectedId}
                onChange={setSelRaw}
              />
            )}

            {/* Resumen — anatomía del resumen del editor de sesión */}
            {template && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTag}>
                  {t('nextSession.sessionTag', { label: template.label ?? '' })}
                  {selectedId === nextId
                    ? <Text style={styles.summaryNext}>{`  ·  ${t('nextSession.upNext')}`}</Text>
                    : null}
                </Text>
                <Text style={styles.summaryMain} numberOfLines={2}>{template.name ?? ''}</Text>
                <Text style={styles.summaryHint}>{t('nextSession.hint')}</Text>
              </View>
            )}

            {(template?.exercises ?? []).map((exConfig, i) => {
              const exerciseId = exConfig.exerciseId;
              const def       = allExercises[exerciseId];
              const inputType = inputTypeFor(exConfig, def);
              const fields    = fieldsFor(inputType, !!exConfig.trackRpe, t);
              const last      = lastLog?.exercises?.find((e) => e.exerciseId === exerciseId);
              const summary   = lastSummary(last, inputType);
              const target    = targetLabel(def, exConfig, t);
              const d = draft[exerciseId] ?? {};
              return (
                <View key={exerciseId} style={styles.card}>
                  {/* Header de la tarjeta del Workout: número + nombre + prescripción */}
                  <View style={styles.header}>
                    <Text style={styles.num}>{String(i + 1).padStart(2, '0')}</Text>
                    <View style={styles.nameBlock}>
                      <Text style={styles.name} numberOfLines={2}>{def?.name ?? exerciseId}</Text>
                      {target ? <Text style={styles.target} numberOfLines={2}>{target}</Text> : null}
                    </View>
                  </View>

                  <View style={styles.body}>
                    <Text style={styles.lastLine}>
                      {summary ? t('nextSession.last', { summary }) : t('nextSession.noLast')}
                    </Text>

                    {/* Rejilla del Workout: cabeceras de columna + una fila de celdas */}
                    <View style={styles.colHeader}>
                      {fields.map(([key, label]) => (
                        <Text key={key} style={styles.colLabel}>{label.toUpperCase()}</Text>
                      ))}
                    </View>
                    <View style={styles.cellRow}>
                      {fields.map(([key]) => (
                        <TextInput
                          key={key}
                          style={styles.cell}
                          value={d[key] ?? ''}
                          onChangeText={(v) => setField(exerciseId, key, v)}
                          onBlur={() => commitField(exerciseId, key)}
                          keyboardType={key === 'reps' || key === 'time' ? 'numeric' : 'decimal-pad'}
                          placeholder="–"
                          placeholderTextColor={th.colors.muted}
                        />
                      ))}
                    </View>

                    {/* Tira de nota del entrenador — la misma que ve el cliente */}
                    <TextInput
                      style={styles.noteInput}
                      value={d.note ?? ''}
                      onChangeText={(v) => setField(exerciseId, 'note', v)}
                      onBlur={() => commitField(exerciseId, 'note')}
                      placeholder={t('nextSession.notePlaceholder')}
                      placeholderTextColor={th.colors.mutedLight}
                      multiline
                    />
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Enviar — geometría del botón de guardar del Workout, en el azul del
              CTA "enviar a clientes" de Clientes: es una acción del entrenador */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            <TouchableOpacity
              style={[styles.sendBtn, !hasTargets && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!hasTargets}
              activeOpacity={0.85}
            >
              <Text style={[styles.sendText, !hasTargets && styles.sendTextDisabled]}>
                {t('nextSession.send', { name: client.name }).toUpperCase()}
              </Text>
            </TouchableOpacity>
            <Text style={styles.footerNote}>{t('nextSession.onlyNext')}</Text>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },
  clearText: { ...textStyles.labelStrong },

  // ── Contenido ── (el de `SessionEditorScreen`)
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    gap:               spacing.md,
  },

  // ── Resumen ── (`SessionEditorScreen` summaryCard: tint/accent-10, sin borde)
  summaryCard: {
    backgroundColor:   th.tint.accent10,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  summaryTag:  { ...textStyles.caps, color: th.colors.accent },
  summaryNext: { color: th.tint.accent50 },
  summaryMain: { ...textStyles.bodyStrong, color: th.colors.text },
  summaryHint: { ...textStyles.label, lineHeight: lh(textStyles.label.fontSize), color: th.colors.mutedLight },

  // ── Tarjeta ── (`workout/ExerciseCard`: card / header / body)
  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    R_CARD,
    overflow:        'hidden',
    // Mismo borde transparente que la del Workout: sin él, Android no recorta
    // de forma fiable una vista con overflow hidden + radio.
    borderWidth: 1,
    borderColor: 'transparent',
  },
  header: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             10,
    backgroundColor: th.colors.surface2,
    paddingTop:      14,
    paddingRight:    12,
    paddingBottom:   14,
    paddingLeft:     16,
  },
  num: {
    ...textStyles.itemTitle,
    lineHeight:  22,
    minWidth:    22,
    color:       th.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  nameBlock: { flex: 1, minWidth: 0 },
  name: {
    ...textStyles.itemTitleQuiet,
    lineHeight: 22,
    color:      th.colors.text,
  },
  target: {
    ...textStyles.bodyStrong,
    color:       th.colors.mutedLight,
    marginTop:   3,
    fontVariant: ['tabular-nums'],
  },
  body: {
    paddingTop:        12,
    paddingBottom:     14,
    paddingHorizontal: 16,
  },
  lastLine: {
    ...textStyles.body,
    lineHeight:   lh(textStyles.body.fontSize),
    color:        th.colors.mutedLight,
    marginBottom: 12,
  },

  // Rejilla (`ExerciseCard` colHeader/colLabel + celda de `SetRow`). El valor va
  // en azul: es el objetivo del entrenador, y así lo pinta el Workout del cliente.
  colHeader: { flexDirection: 'row', gap: GRID.GAP, marginBottom: 8 },
  colLabel: {
    ...textStyles.caps,
    flex:      1,
    color:     th.colors.muted,
    textAlign: 'center',
  },
  cellRow: { flexDirection: 'row', gap: GRID.GAP },
  cell: {
    ...textStyles.itemTitle,
    flex:              1,
    height:            GRID.CELL_H,
    backgroundColor:   th.colors.bg,
    borderRadius:      GRID.RADIUS,
    paddingHorizontal: spacing.xs,
    paddingVertical:   0,
    color:             th.colors.blue,
    textAlign:         'center',
    fontVariant:       ['tabular-nums'],
  },
  // Tira de nota puntual (`ExerciseCard` coachNote): azul al 10 %, sin borde.
  noteInput: {
    ...textStyles.label,
    lineHeight:        lh(textStyles.label.fontSize),
    marginTop:         12,
    minHeight:         GRID.CELL_H,
    backgroundColor:   withOpacity(th.colors.blue, 0.1),
    borderRadius:      R_SMALL,
    paddingHorizontal: 10,
    paddingVertical:   spacing.sm2,
    color:             th.colors.text,
    textAlignVertical: 'top',
  },

  // ── Enviar ──
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    backgroundColor:   th.colors.bg,
  },
  sendBtn: {
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md + 4,
    alignItems:      'center',
    backgroundColor: th.colors.blue,
  },
  sendBtnDisabled:  { backgroundColor: th.colors.surface2 },
  sendText:         { ...textStyles.button, color: th.colors.onAccent },
  sendTextDisabled: { color: th.colors.muted },
  footerNote: { ...textStyles.label, color: th.colors.mutedLight, textAlign: 'center', marginTop: spacing.sm },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { ...textStyles.body, color: th.colors.mutedLight, textAlign: 'center' },
});
