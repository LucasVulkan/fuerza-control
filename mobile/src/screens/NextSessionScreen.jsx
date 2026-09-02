/**
 * NextSessionScreen — trainer's one-off prescription for a client's NEXT
 * session. Not the program editor: targets here are single-use and consumed
 * when the client trains that session. Reached from the client card's "···".
 *
 * Per session (selector at top), each exercise shows what the client did last
 * time and an editable target (weight / reps) + a one-off note. "Enviar"
 * uploads the overrides to the client's slot.
 */

import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { clientStageIndex, stageDaysAt } from '../../../src/utils/stageProgress';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

/** Input type for an exercise (matches ExerciseCard's fallback logic). */
function inputTypeFor(exConfig, def) {
  return exConfig.inputType ?? (def?.progressionModel === 'time_progression' ? 'time' : 'weight_reps');
}

/** Editable target fields for an exercise: [key, label] pairs. */
function fieldsFor(inputType, trackRpe) {
  const base = inputType === 'reps'        ? [['reps', 'reps']]
             : inputType === 'time'        ? [['time', 's']]
             : inputType === 'weight_time' ? [['weight', 'kg'], ['time', 's']]
             :                               [['weight', 'kg'], ['reps', 'reps']];
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

  // Selected session — clamped during render so it stays valid without an effect.
  const [selRaw, setSelRaw] = useState(null);
  const selectedId = (selRaw && templateIds.includes(selRaw)) ? selRaw : (templateIds[0] ?? null);

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
  const buildSeed = () => {
    const ex = override?.exercises ?? {};
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
    const cleared = {};
    (template?.exercises ?? []).forEach(({ exerciseId }) => { cleared[exerciseId] = { weight: '', reps: '', note: '' }; });
    setDraft(cleared);
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerKicker}>{t('nextSession.title').toUpperCase()}</Text>
          <Text style={styles.headerName} numberOfLines={1}>{client.name}</Text>
        </View>
        {hasTargets && (
          <TouchableOpacity onPress={handleClear} hitSlop={8} style={styles.clearBtn}>
            <Text style={styles.clearText}>{t('nextSession.clear')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!activeProgram ? (
        <View style={styles.empty}><Text style={styles.emptyText}>{t('nextSession.noProgram')}</Text></View>
      ) : (
        <>
          {/* Session selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectorWrap}
            contentContainerStyle={styles.selector}
          >
            {templateIds.map((tid) => {
              const tpl = getEffectiveTemplate(tid);
              const sel = tid === selectedId;
              return (
                <TouchableOpacity
                  key={tid}
                  style={[styles.sessTab, sel && styles.sessTabActive]}
                  onPress={() => setSelRaw(tid)}
                >
                  <Text style={[styles.sessTabText, sel && styles.sessTabTextActive]} numberOfLines={1}>
                    {`${tpl?.label ?? ''} · ${tpl?.name ?? ''}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.hint}>{t('nextSession.hint')}</Text>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
            keyboardShouldPersistTaps="handled"
          >
            {(template?.exercises ?? []).map((exConfig) => {
              const exerciseId = exConfig.exerciseId;
              const def       = allExercises[exerciseId];
              const inputType = inputTypeFor(exConfig, def);
              const fields    = fieldsFor(inputType, !!exConfig.trackRpe);
              const last      = lastLog?.exercises?.find((e) => e.exerciseId === exerciseId);
              const summary   = lastSummary(last, inputType);
              const d = draft[exerciseId] ?? {};
              return (
                <View key={exerciseId} style={styles.exCard}>
                  <Text style={styles.exName} numberOfLines={1}>{def?.name ?? exerciseId}</Text>
                  <Text style={styles.exLast}>
                    {summary ? t('nextSession.last', { summary }) : t('nextSession.noLast')}
                  </Text>
                  <View style={styles.fieldsRow}>
                    {fields.map(([key, label]) => (
                      <View key={key} style={styles.field}>
                        <Text style={styles.fieldLabel}>{label}</Text>
                        <TextInput
                          style={styles.fieldInput}
                          value={d[key] ?? ''}
                          onChangeText={(v) => setField(exerciseId, key, v)}
                          onBlur={() => commitField(exerciseId, key)}
                          keyboardType={key === 'reps' || key === 'time' ? 'numeric' : 'decimal-pad'}
                          placeholder="—"
                          placeholderTextColor={th.colors.muted2}
                        />
                      </View>
                    ))}
                  </View>
                  <TextInput
                    style={styles.noteInput}
                    value={d.note ?? ''}
                    onChangeText={(v) => setField(exerciseId, 'note', v)}
                    onBlur={() => commitField(exerciseId, 'note')}
                    placeholder={t('nextSession.notePlaceholder')}
                    placeholderTextColor={th.colors.muted2}
                    multiline
                  />
                </View>
              );
            })}
          </ScrollView>

          {/* Send */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            <TouchableOpacity
              style={[styles.sendBtn, !hasTargets && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!hasTargets}
              activeOpacity={0.85}
            >
              <Text style={[styles.sendText, !hasTargets && styles.sendTextDisabled]}>
                {t('nextSession.send', { name: client.name })}
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

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: borders.thin, borderBottomColor: th.colors.border,
  },
  backBtn: { padding: spacing.xs },
  backIcon: { fontSize: 26, color: th.colors.muted, lineHeight: 30 },
  headerKicker: { fontSize: 10, letterSpacing: 1, color: th.colors.muted, fontWeight: typography.semibold },
  headerName: { fontSize: typography.lg, fontWeight: typography.bold, color: th.colors.text },
  clearBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  clearText: { fontSize: typography.sm, color: th.colors.muted },

  selectorWrap: { flexGrow: 0, borderBottomWidth: borders.thin, borderBottomColor: th.colors.border },
  selector: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  sessTab: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 1,
    borderRadius: th.radius.full, borderWidth: borders.thin, borderColor: th.colors.border,
    backgroundColor: th.colors.surface2,
  },
  sessTabActive: { backgroundColor: withOpacity(th.colors.blue, 0.14), borderColor: withOpacity(th.colors.blue, 0.5) },
  sessTabText: { fontSize: typography.sm, color: th.colors.muted, maxWidth: 180 },
  sessTabTextActive: { color: th.colors.blue, fontWeight: typography.medium },

  hint: { fontSize: typography.xs, color: th.colors.muted, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  exCard: {
    backgroundColor: th.colors.surface, borderWidth: borders.thin, borderColor: th.colors.border,
    borderLeftWidth: 3, borderLeftColor: withOpacity(th.colors.blue, 0.55),
    borderRadius: th.radius.md, padding: spacing.md,
  },
  exName: { fontSize: typography.base, fontWeight: typography.semibold, color: th.colors.text },
  exLast: { fontSize: typography.xs, color: th.colors.muted, marginTop: 3, marginBottom: spacing.sm },
  fieldsRow: { flexDirection: 'row', gap: spacing.sm },
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: th.colors.surface2, borderWidth: borders.thin, borderColor: th.colors.border,
    borderRadius: th.radius.sm, paddingHorizontal: spacing.sm,
  },
  fieldLabel: { fontSize: typography.xs, color: th.colors.muted2 },
  fieldInput: {
    flex: 1, textAlign: 'right', color: th.colors.blue,
    fontSize: typography.md, fontWeight: typography.semibold,
    paddingVertical: spacing.sm,
  },
  noteInput: {
    marginTop: spacing.sm, backgroundColor: th.colors.surface2,
    borderWidth: borders.thin, borderColor: th.colors.border, borderRadius: th.radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: th.colors.text, fontSize: typography.sm, minHeight: 38,
  },

  footer: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: borders.thin, borderTopColor: th.colors.border, backgroundColor: th.colors.bg,
  },
  sendBtn: { backgroundColor: th.colors.blue, borderRadius: th.radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: th.colors.surface2, borderWidth: borders.thin, borderColor: th.colors.border },
  sendText: { fontSize: typography.base, fontWeight: typography.heavy, color: th.colors.onAccent, letterSpacing: 0.3 },
  sendTextDisabled: { color: th.colors.muted },
  footerNote: { fontSize: typography.xs, color: th.colors.muted, textAlign: 'center', marginTop: spacing.sm },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { fontSize: typography.base, color: th.colors.muted, textAlign: 'center' },
});
