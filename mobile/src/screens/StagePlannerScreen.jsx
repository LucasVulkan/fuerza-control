/**
 * StagePlannerScreen — la vista de plan de un programa.
 *
 * Dos cosas que el editor de programa no puede hacer:
 *
 * 1. **Ver el plan entero.** El `StageSelector` horizontal navega bien hasta 4
 *    etapas y con nombres reales ("Intensificación") deja de caber. Aquí la
 *    lista es vertical y aguanta las que hagan falta.
 * 2. **Montar un bloque de una vez.** Una escalera crea sus peldaños derivando
 *    los ejercicios de la etapa base con una regla (`stageRx.js`), en lugar de
 *    duplicar la etapa N veces y reeditarla a mano.
 *
 * Decisión de diseño: **la escalera se aplica al momento, sin borrador.** Las
 * etapas se crean y se editan aquí mismo (nombre, ciclos, borrar), que es lo
 * que ya sabe hacer el store. Un estado intermedio de "plan pendiente de
 * confirmar" sería una máquina de estados entera para ahorrar un toque de
 * deshacer.
 *
 * La base de la escalera es la ÚLTIMA etapa sin regla, es decir la última
 * construida a mano: es "la base del plan". Si se derivara del último peldaño,
 * un bloque nuevo se montaría encima de una descarga.
 */

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import DragSheet from '../components/DragSheet';
import StepField from '../components/ui/StepField';
import { ArrowIcon, CloseIcon } from '../components/ui/EditorIcons';
import SegmentedControl from '../components/ui/SegmentedControl';
import { ToggleRow } from '../components/ui/EditorRows';
import { LADDER_IDS, LADDER_FIELDS, DELOAD_FIELDS, buildRungs, describeRx, fieldLabelKey } from '../../../src/utils/stageRx';
import { clientStageIndex } from '../../../src/utils/stageProgress';

const HEADER_H = 64;

/** Índice de la etapa base: la última sin regla (la última hecha a mano). */
function baseStageIdx(stages) {
  for (let i = stages.length - 1; i >= 0; i--) if (!stages[i].rx) return i;
  return stages.length - 1;
}

// ─── Fila de etapa ────────────────────────────────────────────────────────────
// Pensada para crecer: cuando existan métricas por etapa (ver P4 en la spec)
// caben bajo la línea de regla sin tocar el resto.

function StageRow({ stage, index, isActive, canDelete, onRename, onCycles, onDelete }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState(stage.name ?? '');

  const rxParts = describeRx(stage.rx, t);

  return (
    <View style={[styles.row, isActive && styles.rowActive]}>
      <View style={styles.rowTop}>
        <Text style={styles.rowNum}>{index + 1}</Text>
        <TextInput
          style={styles.rowName}
          value={name}
          onChangeText={setName}
          onBlur={() => {
            const trimmed = name.trim();
            if (trimmed && trimmed !== stage.name) onRename(trimmed);
            else setName(stage.name ?? '');
          }}
          placeholder={t('planner.stagePlaceholder')}
          returnKeyType="done"
        />
        {isActive && <Text style={styles.activeBadge}>{t('editor.stageActiveBadge')}</Text>}
        {/* Borrar es una X en la esquina, no un botón de texto: "Eliminar" se
            comía media fila y competía con el stepper de ciclos, que es el
            control que de verdad se toca aquí. */}
        {canDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={10} activeOpacity={0.7}>
            <CloseIcon size={14} color={th.colors.mutedLight} />
          </TouchableOpacity>
        )}
      </View>

      {rxParts.length > 0 && (
        <Text style={styles.rowRx} numberOfLines={2}>{rxParts.join(' · ')}</Text>
      )}

      {/* Sin envoltorio de fila: dentro de la columna, el control estira al
          ancho completo — `cardHorizontal` ya reparte label a la izquierda y
          controles a la derecha con `space-between`. */}
      {stage.durationWeeks == null ? (
        <TouchableOpacity style={styles.noLimitBtn} onPress={() => onCycles(4)} activeOpacity={0.7}>
          <Text style={styles.noLimitText}>{t('editor.cyclesOpen')}</Text>
        </TouchableOpacity>
      ) : (
        <StepField
          horizontal dark
          label={t('editor.stageWeeksUnit')}
          value={stage.durationWeeks}
          onChange={onCycles}
          min={1}
          max={52}
        />
      )}
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function StagePlannerScreen({ navigation }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const programs        = useStore((s) => s.programs);
  const clients         = useStore((s) => s.clients);
  const profile         = useStore((s) => s.profile);
  const ui              = useStore((s) => s.ui);
  const updateStage     = useStore((s) => s.updateStage);
  const removeStage     = useStore((s) => s.removeStageFromProgram);
  const addStageLadder  = useStore((s) => s.addStageLadder);
  const showToast       = useStore((s) => s.showToast);

  const [ladderOpen, setLadderOpen] = useState(false);
  const [ladderId,   setLadderId]   = useState('linear');
  const [withDeload, setWithDeload] = useState(true);
  // Los peldaños son estado EDITABLE de la hoja, no una plantilla fija:
  // `buildRungs` solo los prerrellena. Cambiar de tipo o de número los
  // regenera — se asume que quien cambia de escalera quiere sus defectos.
  const [rungs, setRungs] = useState(() => buildRungs('linear', 2, true));

  function regenerate(id, count, deload) {
    setLadderId(id);
    setWithDeload(deload);
    setRungs(buildRungs(id, count, deload));
  }

  const workCount = rungs.filter((r) => r.kind === 'work').length;

  function patchRung(idx, patch) {
    setRungs((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch, rx: { ...r.rx, ...(patch.rx ?? {}) } } : r)));
  }

  const programId = ui._editingProgramId ?? profile.activeProgramId;
  const program   = programs[programId];
  const stages    = program?.stages ?? [];

  if (!program || stages.length === 0) return null;

  const baseIdx    = baseStageIdx(stages);
  const baseStage  = stages[baseIdx];
  const activeIdx  = clientStageIndex(clients?.[program.clientId], program);
  const perCycle   = baseStage?.days?.length ?? 0;

  // Una etapa sin límite hace el total indeterminado: se suman las que sí lo
  // tienen y se marca con "+".
  const anyOpen    = stages.some((s) => s.durationWeeks == null);
  const totalCycles = stages.reduce((a, s) => a + (s.durationWeeks ?? 0), 0);

  function rungName(rung, i) {
    return rung.kind === 'deload'
      ? t('planner.rungs.deload')
      : t(`planner.rungNames.${ladderId}`, { n: i + 2 });
  }

  function handleApply() {
    const payload = rungs.map((r, i) => ({
      name:          rungName(r, i),
      durationWeeks: r.durationWeeks,
      rx:            r.rx,
    }));
    const firstIdx = addStageLadder(programId, { sourceStageIdx: baseIdx, rungs: payload });
    setLadderOpen(false);
    if (firstIdx != null) showToast(t('planner.toastAdded', { count: payload.length }), 2400, 'success');
  }

  function handleDelete(idx) {
    Alert.alert(
      t('planner.deleteTitle'),
      t('planner.deleteBody', { name: stages[idx].name ?? '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => removeStage(programId, idx) },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.headerSide}>
          <ArrowIcon size={20} color={th.colors.onAccent} back />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow} numberOfLines={1}>{t('planner.eyebrow')}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{program.name ?? ''}</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTag}>{t('planner.summaryTag')}</Text>
          <Text style={styles.summaryMain}>
            {anyOpen
              ? t('planner.summaryOpen', { cycles: totalCycles, stages: stages.length })
              : t('planner.summary',     { cycles: totalCycles, stages: stages.length })}
          </Text>
          <Text style={styles.summaryHint}>{t('planner.summaryPerCycle', { count: perCycle })}</Text>
        </View>

        <Text style={styles.secTitle}>{t('editor.sectionStages').toUpperCase()}</Text>
        {stages.map((stage, idx) => (
          <StageRow
            // El id de la etapa como key: por índice, renombrar una y borrar
            // otra reciclaba el TextInput con el texto de la vecina.
            key={stage.id ?? idx}
            stage={stage}
            index={idx}
            isActive={idx === activeIdx}
            canDelete={stages.length > 1}
            onRename={(name) => updateStage(programId, idx, { name })}
            onCycles={(v) => updateStage(programId, idx, { durationWeeks: v })}
            onDelete={() => handleDelete(idx)}
          />
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={() => setLadderOpen(true)} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>{t('planner.addBlock')}</Text>
        </TouchableOpacity>
        <Text style={styles.baseHint}>{t('planner.baseHint', { name: baseStage?.name ?? '' })}</Text>
      </ScrollView>

      <DragSheet
        visible={ladderOpen}
        onClose={() => setLadderOpen(false)}
        title={t('planner.ladderTitle')}
        action={{ label: t('planner.applyBtn'), onPress: handleApply }}
        // Sobre `surface` (el fondo por defecto de la hoja) las tarjetas de
        // peldaño no se despegaban del fondo. Mismo patrón que las hojas de
        // AppHeader / ClientCodeModal / TrainerSyncModal.
        background={th.colors.bg}
      >
        <View style={styles.sheetBody}>
          <SegmentedControl
            options={LADDER_IDS.map((id) => ({ id, label: t(`planner.ladders.${id}`) }))}
            value={ladderId}
            onChange={(id) => regenerate(id, workCount, withDeload)}
          />
          <Text style={styles.ladderDesc}>{t(`planner.ladderDesc.${ladderId}`)}</Text>
          {/* La base es siempre la última etapa SIN regla, así que añadir un
              segundo bloque NO parte de la descarga del primero. Decirlo aquí
              es la diferencia entre una regla y una sorpresa. */}
          <Text style={styles.baseLine}>{t('planner.baseLine', { name: baseStage?.name ?? '' })}</Text>

          <View style={styles.countRow}>
            <Text style={styles.fieldLabel}>{t('planner.rungCount')}</Text>
            <StepField
              horizontal dark
              value={workCount}
              onChange={(v) => regenerate(ladderId, v, withDeload)}
              min={1}
              max={4}
            />
          </View>

          <ToggleRow
            label={t('planner.withDeload')}
            hint={t('planner.withDeloadHint')}
            value={withDeload}
            onChange={(v) => regenerate(ladderId, workCount, v)}
          />

          {rungs.map((rung, i) => (
            <View key={i} style={styles.rungCard}>
              <Text style={styles.rungName}>{rungName(rung, i)}</Text>
              <View style={styles.rungField}>
                <Text style={styles.fieldLabel}>{t('editor.stageWeeksUnit')}</Text>
                <StepField
                  horizontal dark
                  value={rung.durationWeeks}
                  onChange={(v) => patchRung(i, { durationWeeks: v })}
                  min={1}
                  max={12}
                />
              </View>
              {(rung.kind === 'deload' ? DELOAD_FIELDS : LADDER_FIELDS[ladderId]).map((f) => (
                <View key={f.key} style={styles.rungField}>
                  <Text style={styles.fieldLabel}>{t(fieldLabelKey(f, rung.rx.scope))}</Text>
                  <StepField
                    horizontal dark
                    value={rung.rx[f.key] ?? 0}
                    onChange={(v) => patchRung(i, { rx: { [f.key]: v } })}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </DragSheet>

    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: th.colors.bg },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    height:            HEADER_H,
    marginHorizontal:  spacing.lg,
    marginTop:         spacing.lg,
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
  },
  headerSide:    { width: 26, alignItems: 'center' },
  headerCenter:  { flex: 1, alignItems: 'center', gap: spacing.xs, minWidth: 0 },
  headerEyebrow: {
    ...textStyles.btnAction,
    fontSize:      10,
    letterSpacing: 1,
    color:         th.colors.muted,
    textTransform: 'uppercase',
  },
  headerTitle: { ...textStyles.hero, color: th.colors.onAccent, lineHeight: 22, flexShrink: 1 },

  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xs2 },

  summaryCard: {
    backgroundColor:   th.tint.accent10,
    borderRadius:      th.radius.md,
    padding:           spacing.md,
    gap:               spacing.xs,
  },
  summaryTag:  { ...textStyles.spacingTag, color: th.colors.accent },
  summaryMain: { ...textStyles.cardType, color: th.colors.text },
  summaryHint: { ...textStyles.subtitle, color: th.colors.mutedLight },

  secTitle: { ...textStyles.spacingTag, color: th.colors.mutedLight, paddingTop: spacing.md },

  row: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
  },
  rowActive: { backgroundColor: th.tint.accent10 },
  rowTop:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Mismo criterio que la letra de sesión del editor de programa (`sesLetter`):
  // es el ancla visual de la fila, no una etiqueta.
  rowNum:    { ...textStyles.hero, color: th.colors.accent, textAlign: 'center', minWidth: 16 },
  rowName:   { ...textStyles.cardType, color: th.colors.text, flex: 1, minWidth: 0, padding: 0 },
  activeBadge: { ...textStyles.tag, color: th.colors.accent },
  rowRx:     { ...textStyles.subtitle, color: th.colors.accent },

  noLimitBtn: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      th.radius.sm,
    backgroundColor:   th.colors.surface2,
  },
  noLimitText: { ...textStyles.cardType, color: th.colors.mutedLight },

  addBtn: {
    marginTop:       spacing.md,
    paddingVertical: spacing.md,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
  },
  addBtnText: { ...textStyles.btnAction, color: th.colors.onAccent, textTransform: 'uppercase' },
  baseHint:   { ...textStyles.subtitle, color: th.colors.mutedLight, paddingTop: spacing.xs },

  sheetBody:  { gap: spacing.sm, paddingBottom: spacing.md },
  ladderCard: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    gap:             spacing.xs2,
  },
  ladderDesc: { ...textStyles.subtitle, color: th.colors.mutedLight },
  baseLine:   { ...textStyles.subtitle, color: th.colors.accent },
  countRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  fieldLabel: { ...textStyles.cardType, color: th.colors.mutedLight, flexShrink: 1 },
  rungCard: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
  },
  rungName:   { ...textStyles.cardType, color: th.colors.accent },
  rungField:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
