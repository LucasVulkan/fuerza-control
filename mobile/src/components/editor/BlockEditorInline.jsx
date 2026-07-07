import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';
import { emomTotalIntervals } from '../../../../src/utils/conditioningBlocks';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { spacing, typography, borders, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

// Compact "M:SS" / "M min" for a duration in seconds — matches how the
// workout clock reads, but collapses to whole minutes when there's no
// remainder so "10 min" doesn't become "10:00".
function fmtDuration(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Local pieces (copied from ExerciseEditorInline — same visual language) ───

function StepField({ label, value, onChange, min, max }) {
  const sf = useThemedStyles(makeSf);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const numVal = Number(value);

  function handleChangeText(v) { setDraft(v.replace(/[^0-9]/g, '')); }
  function handleBlur() {
    const n = parseInt(draft, 10);
    if (!isNaN(n)) { const c = Math.min(max, Math.max(min, n)); setDraft(String(c)); onChange(c); }
    else setDraft(String(value));
  }

  return (
    <View style={sf.card}>
      <Text style={sf.label}>{label}</Text>
      <View style={sf.row}>
        <TouchableOpacity style={sf.stepBtn} onPress={() => onChange(Math.max(min, numVal - 1))}>
          <Text style={sf.stepText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={sf.valueInput}
          keyboardType="numeric"
          value={draft}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          selectTextOnFocus
        />
        <TouchableOpacity style={sf.stepBtn} onPress={() => onChange(Math.min(max, numVal + 1))}>
          <Text style={sf.stepText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeSf = (th) => StyleSheet.create({
  card: {
    flex:            1,
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.md,
    padding:         spacing.sm + 2,
    gap:             6,
  },
  label: {
    fontSize:      typography.xs,
    color:         th.colors.muted,
    letterSpacing: 0.5,
    fontWeight:    typography.medium,
    textAlign:     'center',
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  stepBtn: {
    width:           36,
    height:          36,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stepText: {
    fontSize:   18,
    color:      th.colors.muted,
    lineHeight: 22,
  },
  valueInput: {
    flex:               1,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    fontSize:           typography.lg,
    fontWeight:         typography.bold,
    color:              th.colors.text,
    backgroundColor:    'transparent',
    height:             40,
    paddingVertical:    0,
  },
});

function ToggleRow({ label, value, onChange }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={() => onChange(!value)} activeOpacity={0.7}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

function SegPicker({ options, value, onChange }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.segRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          style={[styles.segBtn, value === opt.id && styles.segBtnActive]}
          onPress={() => onChange(opt.id)}
        >
          <Text style={[styles.segLabel, value === opt.id && styles.segLabelActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const UNIT_CYCLE = ['reps', 'cal', 'm', 'sec'];

// ─── BlockEditorInline ────────────────────────────────────────────────────────
//
// Config editor for one ConditioningBlock. Mirrors ExerciseEditorInline's
// autosave pattern: local state commits to the store 400ms after the last
// change, flushed on unmount too.

function computeInitial(block) {
  return {
    format:      block.format ?? 'amrap',
    capSec:      block.capSec ?? 600,
    intervalSec: block.intervalSec ?? 60,
    rounds:      block.rounds ?? (block.format === 'for_time' ? 3 : 10),
    emomMode:    block.emomMode ?? 'rotate',
    movements:   block.movements ?? [],
    name:        block.name ?? '',
    notes:       block.notes ?? '',
    hasCap:      block.format === 'for_time' ? block.capSec != null : true,
  };
}

export default function BlockEditorInline({ templateId, block, allExercises, onClose, navigation }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const { label: weightLabel, toDisplay, toKg } = useWeightUnit();

  const updateBlock          = useStore((s) => s.updateBlock);
  const removeBlockFromSession = useStore((s) => s.removeBlockFromSession);
  const saveBlockPreset      = useStore((s) => s.saveBlockPreset);
  const showToast            = useStore((s) => s.showToast);
  const blockPickerResult    = useStore((s) => s.ui._blockPickerResult);
  const setBlockPickerResult = useStore((s) => s.setBlockPickerResult);

  const initialRef = useRef(computeInitial(block));
  const i = initialRef.current;

  const [format,      setFormat]      = useState(i.format);
  const [capSec,       setCapSec]       = useState(i.capSec);
  const [intervalSec,  setIntervalSec]  = useState(i.intervalSec);
  const [rounds,       setRounds]       = useState(i.rounds);
  const [emomMode,     setEmomMode]     = useState(i.emomMode);
  const [movements,    setMovements]    = useState(i.movements);
  const [name,         setName]        = useState(i.name);
  const [notes,        setNotes]       = useState(i.notes);
  const [hasCap,       setHasCap]      = useState(i.hasCap);

  const stateRef  = useRef(null);
  const dirtyRef  = useRef(false);
  const timerRef  = useRef(null);
  const updateRef = useRef(updateBlock);
  useEffect(() => { updateRef.current = updateBlock; }, [updateBlock]);

  stateRef.current = { format, capSec, intervalSec, rounds, emomMode, movements, name, notes, hasCap };

  const commitValues = useCallback((s) => {
    const updates = {
      format:      s.format,
      capSec:      s.format === 'amrap' ? s.capSec : s.format === 'for_time' ? (s.hasCap ? s.capSec : null) : null,
      intervalSec: s.format === 'emom' ? s.intervalSec : null,
      rounds:      s.format === 'amrap' ? null : s.rounds,
      emomMode:    s.emomMode,
      movements:   s.movements,
      name:        s.name.trim() || null,
      notes:       s.notes.trim() || null,
    };
    updateRef.current(templateId, block.id, updates);
  }, [templateId, block.id]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    dirtyRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { commitValues(stateRef.current); }, 400);
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, capSec, intervalSec, rounds, emomMode, movements, name, notes, hasCap]);

  useEffect(() => {
    return () => {
      if (dirtyRef.current) { clearTimeout(timerRef.current); commitValues(stateRef.current); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Movement picker handoff (ExerciseSelectorScreen → ui._blockPickerResult) ──
  useEffect(() => {
    if (!blockPickerResult) return;
    setMovements((prev) => [...prev, { exerciseId: blockPickerResult, amount: 10, unit: 'reps', weight: null }]);
    setBlockPickerResult(null);
  }, [blockPickerResult, setBlockPickerResult]);

  function handleAddMovement() {
    navigation.navigate('ExerciseSelector', { templateId, blockPicker: true });
  }

  function handleRemoveMovement(idx) {
    setMovements((prev) => prev.filter((_, i2) => i2 !== idx));
  }

  function updateMovement(idx, patch) {
    setMovements((prev) => prev.map((m, i2) => i2 === idx ? { ...m, ...patch } : m));
  }

  function cycleUnit(idx) {
    const cur = movements[idx].unit ?? 'reps';
    const next = UNIT_CYCLE[(UNIT_CYCLE.indexOf(cur) + 1) % UNIT_CYCLE.length];
    updateMovement(idx, { unit: next });
  }

  function handleSavePreset() {
    // saveBlockPreset strips whatever `id` we pass and assigns a fresh presetId.
    saveBlockPreset({
      id: block.id,
      format,
      capSec:      format === 'amrap' ? capSec : format === 'for_time' ? (hasCap ? capSec : null) : null,
      intervalSec: format === 'emom' ? intervalSec : null,
      rounds:      format === 'amrap' ? null : rounds,
      emomMode,
      movements,
      name:  name.trim() || null,
      notes: notes.trim() || null,
    });
    showToast(t('blocks.presetSaved'), 2200, 'success');
  }

  function handleDeleteBlock() {
    Alert.alert(
      t('blocks.deleteBlock'),
      t('blocks.deleteConfirm', { name: name.trim() || t(`blocks.formats.${format}`) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('blocks.deleteBlock'), style: 'destructive',
          onPress: () => { removeBlockFromSession(templateId, block.id); onClose(); },
        },
      ]
    );
  }

  const FORMAT_OPTIONS = ['amrap', 'emom', 'for_time'].map((id) => ({ id, label: t(`blocks.formats.${id}`) }));
  const INTERVAL_OPTIONS = [30, 45, 60, 90, 120].map((s) => ({ id: s, label: `${s}s` }));

  // ── Live summary — the single most important thing this editor answers:
  // what happens each interval/round, how long it lasts, and whether the
  // movements all sit inside one round or are spread across several.
  const moveCount = movements.length;
  let summaryMain, summarySub;
  if (format === 'amrap') {
    summaryMain = t('blocks.summary.amrapMain', { min: Math.round(capSec / 60) });
    summarySub = moveCount > 0
      ? t('blocks.summary.amrapSub', { count: moveCount })
      : t('blocks.summary.empty');
  } else if (format === 'emom') {
    const totalIntervals = emomTotalIntervals({ format: 'emom', rounds, emomMode, movements });
    summaryMain = t('blocks.summary.emomMain', {
      rounds, interval: `${intervalSec}s`, total: fmtDuration(intervalSec * totalIntervals),
    });
    summarySub = moveCount === 0
      ? t('blocks.summary.empty')
      : moveCount === 1
        ? t('blocks.summary.emomSubOne')
        : emomMode === 'rotate'
          ? t('blocks.summary.emomSubRotate', { count: moveCount })
          : t('blocks.summary.emomSubAll', { count: moveCount });
  } else {
    summaryMain = hasCap
      ? t('blocks.summary.forTimeMainCap', { rounds, cap: Math.round(capSec / 60) })
      : t('blocks.summary.forTimeMainNoCap', { rounds });
    summarySub = moveCount > 0
      ? t('blocks.summary.forTimeSub', { count: moveCount })
      : t('blocks.summary.empty');
  }

  return (
    <View style={styles.container}>

      {/* ══ RESUMEN ══════════════════════════════════════════════════════════ */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTag}>{t('exerciseEditor.summaryTitle')}</Text>
        <Text style={styles.summaryMain}>{summaryMain}</Text>
        <Text style={styles.summarySub}>{summarySub}</Text>
      </View>

      {/* ══ FORMATO ══════════════════════════════════════════════════════════ */}
      <View>
        <Text style={styles.secTitle}>{t('blocks.formatLabel')}</Text>
        <SegPicker
          options={FORMAT_OPTIONS}
          value={format}
          onChange={setFormat}
        />
      </View>

      <View style={styles.divider} />

      {/* ══ PARÁMETROS ═══════════════════════════════════════════════════════ */}
      <View>
        {format === 'amrap' && (
          <StepField
            label={t('blocks.capLabel')}
            value={Math.round(capSec / 60)}
            onChange={(min) => setCapSec(min * 60)}
            min={1}
            max={60}
          />
        )}

        {format === 'emom' && (
          <View style={{ gap: spacing.md }}>
            <View>
              <Text style={styles.fieldLabel}>{t('blocks.intervalLabel')}</Text>
              <SegPicker
                options={INTERVAL_OPTIONS}
                value={intervalSec}
                onChange={setIntervalSec}
              />
            </View>
            <View style={styles.fieldRow}>
              <StepField label={t('blocks.roundsLabel')} value={rounds} onChange={setRounds} min={1} max={40} />
              <View style={{ flex: 1 }} />
            </View>
            {movements.length >= 2 && (
              <ToggleRow
                label={t('blocks.rotateLabel')}
                value={emomMode === 'rotate'}
                onChange={(v) => setEmomMode(v ? 'rotate' : 'all')}
              />
            )}
          </View>
        )}

        {format === 'for_time' && (
          <View style={{ gap: spacing.md }}>
            <View style={styles.fieldRow}>
              <StepField label={t('blocks.roundsLabel')} value={rounds} onChange={setRounds} min={1} max={20} />
              <View style={{ flex: 1 }} />
            </View>
            <View>
              <ToggleRow
                label={t('blocks.noCap')}
                value={!hasCap}
                onChange={(v) => setHasCap(!v)}
              />
              {hasCap && (
                <View style={[styles.fieldRow, { marginTop: spacing.sm }]}>
                  <StepField
                    label={t('blocks.capLabel')}
                    value={Math.round(capSec / 60)}
                    onChange={(min) => setCapSec(min * 60)}
                    min={1}
                    max={60}
                  />
                  <View style={{ flex: 1 }} />
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* ══ MOVIMIENTOS ══════════════════════════════════════════════════════ */}
      <View>
        <Text style={styles.secTitle}>{t('blocks.movements')}</Text>
        <View style={styles.movementsCard}>
          {movements.map((m, idx) => {
            const def = allExercises?.[m.exerciseId];
            return (
              <View key={idx} style={styles.movementRow}>
                <Text style={styles.movementName} numberOfLines={1}>{def?.name ?? m.exerciseId}</Text>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="numeric"
                  value={String(m.amount)}
                  onChangeText={(v) => {
                    const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                    updateMovement(idx, { amount: isNaN(n) ? 0 : n });
                  }}
                  selectTextOnFocus
                />
                <TouchableOpacity style={styles.unitBtn} onPress={() => cycleUnit(idx)}>
                  <Text style={styles.unitBtnText}>{t(`blocks.units.${m.unit ?? 'reps'}`)}</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.weightInput}
                  keyboardType="decimal-pad"
                  placeholder={weightLabel}
                  placeholderTextColor={th.colors.muted2}
                  value={m.weight == null ? '' : String(toDisplay(m.weight))}
                  onChangeText={(v) => {
                    if (v === '') { updateMovement(idx, { weight: null }); return; }
                    if (/^\d*\.?\d*$/.test(v)) updateMovement(idx, { weight: toKg(v) });
                  }}
                />
                <TouchableOpacity hitSlop={8} onPress={() => handleRemoveMovement(idx)}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addMovementBtn} onPress={handleAddMovement} activeOpacity={0.7}>
            <Text style={styles.addMovementText}>{t('blocks.addMovement')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ══ NOMBRE Y NOTA ════════════════════════════════════════════════════ */}
      <View style={{ gap: spacing.md }}>
        <View>
          <Text style={styles.fieldLabel}>{t('blocks.nameLabel')}</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder={t(`blocks.formats.${format}`)}
            placeholderTextColor={th.colors.muted2}
          />
        </View>
        <View>
          <TextInput
            style={styles.noteInput}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('blocks.notePlaceholder')}
            placeholderTextColor={th.colors.muted2}
            multiline
            maxLength={280}
          />
        </View>
      </View>

      {/* ══ ACCIONES ═════════════════════════════════════════════════════════ */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.substituteBtn} onPress={handleSavePreset}>
          <Text style={styles.substituteBtnText}>{t('blocks.savePreset')}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteBlock}>
        <Text style={styles.deleteBtnText}>{t('blocks.deleteBlock')}</Text>
      </TouchableOpacity>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({

  container: {
    padding:       spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
    gap:           spacing.lg,
  },

  // ── Summary card ───────────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: withOpacity(th.colors.accent, 0.06),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.accent, 0.25),
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    gap:             2,
  },
  summaryTag: {
    fontSize:      typography.xs - 1,
    fontWeight:    typography.heavy,
    color:         withOpacity(th.colors.accent, 0.7),
    letterSpacing: 1.2,
    marginBottom:  2,
  },
  summaryMain: {
    fontSize:   typography.md,
    fontWeight: typography.semibold,
    color:      th.colors.accent,
  },
  summarySub: {
    fontSize:   typography.sm,
    color:      th.colors.mutedLight,
    lineHeight: typography.sm * 1.5,
  },

  secTitle: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },

  fieldLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.medium,
    color:         th.colors.muted,
    marginBottom:  spacing.xs,
  },

  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: th.colors.border,
  },

  fieldRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },

  // ── Segmented picker ───────────────────────────────────────────────────────
  segRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  segBtn: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface,
    alignItems:      'center',
  },
  segBtnActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.10),
    borderColor:     withOpacity(th.colors.accent, 0.40),
  },
  segLabel: {
    fontSize:   typography.sm,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },
  segLabelActive: {
    color: th.colors.accent,
  },

  // ── Toggle ─────────────────────────────────────────────────────────────────
  toggleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor:   th.colors.surface,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    borderRadius:      th.radius.md,
  },
  toggleLabel: {
    fontSize:   typography.sm,
    color:      th.colors.text,
    fontWeight: typography.medium,
  },
  track: {
    width:           40,
    height:          22,
    borderRadius:    11,
    backgroundColor: th.colors.border,
    padding:         2,
    justifyContent:  'center',
  },
  trackOn: {
    backgroundColor: withOpacity(th.colors.accent, 0.25),
    borderWidth:     1,
    borderColor:     withOpacity(th.colors.accent, 0.6),
  },
  thumb: {
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: th.colors.muted,
  },
  thumbOn: {
    backgroundColor: th.colors.accent,
    transform:       [{ translateX: 18 }],
  },

  // ── Movements ──────────────────────────────────────────────────────────────
  movementsCard: {
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.md,
    padding:         spacing.sm,
    gap:             spacing.sm,
  },
  movementRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  movementName: {
    flex:       1,
    minWidth:   0,
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  amountInput: {
    width:              44,
    height:             34,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    backgroundColor:    th.colors.surface2,
    borderWidth:         borders.thin,
    borderColor:         th.colors.border,
    borderRadius:        th.radius.sm,
    fontSize:            typography.sm,
    color:               th.colors.text,
  },
  unitBtn: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical:   6,
    borderRadius:      th.radius.sm,
    backgroundColor:   withOpacity(th.colors.accent, 0.10),
  },
  unitBtnText: {
    fontSize:   typography.xs,
    fontWeight: typography.medium,
    color:      th.colors.accent,
  },
  weightInput: {
    width:              56,
    height:             34,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    backgroundColor:    th.colors.surface2,
    borderWidth:         borders.thin,
    borderColor:         th.colors.border,
    borderRadius:        th.radius.sm,
    fontSize:            typography.xs,
    color:               th.colors.text,
  },
  removeBtn: {
    fontSize: typography.sm,
    color:    th.colors.muted,
    padding:  spacing.xs,
  },
  addMovementBtn: {
    paddingVertical: spacing.sm,
    borderRadius:    th.radius.sm,
    borderWidth:     1,
    borderStyle:     'dashed',
    borderColor:     withOpacity(th.colors.accent, 0.4),
    alignItems:      'center',
  },
  addMovementText: {
    fontSize: typography.sm,
    color:    th.colors.accent,
  },

  // ── Name / note ────────────────────────────────────────────────────────────
  nameInput: {
    backgroundColor:   th.colors.surface,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    fontSize:          typography.sm,
    color:             th.colors.text,
  },
  noteInput: {
    backgroundColor:   th.colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.sm,
    color:             th.colors.text,
    fontSize:          typography.sm,
    minHeight:         60,
    textAlignVertical: 'top',
  },

  // ── Actions ────────────────────────────────────────────────────────────────
  btnRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  substituteBtn: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.sm,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
  },
  substituteBtnText: {
    fontSize:   typography.sm,
    color:      th.colors.text,
    fontWeight: typography.medium,
  },
  deleteBtn: {
    paddingVertical: spacing.sm + 2,
    borderRadius:    th.radius.md,
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.red, 0.3),
    alignItems:      'center',
  },
  deleteBtnText: {
    fontSize:   typography.sm,
    color:      th.colors.red,
    fontWeight: typography.medium,
  },
});
