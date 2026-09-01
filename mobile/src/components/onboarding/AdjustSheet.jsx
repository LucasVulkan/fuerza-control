/**
 * AdjustSheet — la hoja única de ajustes (spec onboarding-simple.md §7).
 *
 * Un `DragSheet` con tres secciones numeradas, mismo formato que la hoja de
 * Progresión del editor de ejercicio (`ExerciseEditorInline.jsx:706`):
 * `stepTitle` con el número en `accent`, el control, y un `hint` debajo que
 * dice el EFECTO de lo elegido — no una descripción genérica.
 *
 * Sin estado propio de respuestas: `onChange(field, value)` es lo único que
 * sale de aquí, igual que hacía `AnswerChips`.
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import DragSheet from '../DragSheet';
import SegmentedControl from '../ui/SegmentedControl';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { EQUIP_PRESETS, presetOf } from '../../utils/equipmentPresets';

const TIME_OPTIONS = [30, 45, 60, 90].map((min) => ({ id: min, label: String(min) }));
const MATERIAL_OPTIONS = ['gym', 'home', 'bodyweight', 'custom'];
// `bodyweight` va primero y es exclusivo: elegirlo limpia el resto.
const EQUIP_IDS = ['bodyweight', 'machines', 'dumbbells', 'barbell', 'pullup_bar', 'parallettes', 'kettlebell', 'resistance_band', 'ab_wheel'];
const LIMIT_IDS = ['none', 'shoulder', 'lower_back', 'knee'];

/** `id === exclusiveId` limpia el resto; cualquier otro lo quita del grupo. */
function toggleExclusive(current, id, exclusiveId) {
  if (id === exclusiveId) return [exclusiveId];
  const without = (current ?? []).filter((x) => x !== exclusiveId);
  return without.includes(id) ? without.filter((x) => x !== id) : [...without, id];
}

function Pill({ label, selected, onPress }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[styles.pill, selected && styles.pillOn]}>
      <Text style={[styles.pillText, selected && styles.pillTextOn]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function Step({ number, title, children, hint, hintColor }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View>
      <Text style={styles.stepTitle}>
        <Text style={styles.stepNum}>{number} · </Text>{title}
      </Text>
      {children}
      {hint ? <Text style={[styles.hint, hintColor && { color: hintColor }]}>{hint}</Text> : null}
    </View>
  );
}

export default function AdjustSheet({
  visible, onClose, answers, onChange, timeCuts, subs, unresolved,
}) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  // §7.2: si el material no coincide con ningún preset, "Otro" va seleccionado
  // y las pills desplegadas. Es DERIVADO del material, no un estado que haya
  // que sincronizar al abrir: el único caso que no se deduce es pulsar "Otro"
  // teniendo un preset puesto, y eso se olvida al cerrar la hoja — en el
  // manejador de cierre, que es un evento, no en un efecto.
  const [customTapped, setCustomTapped] = useState(false);
  const preset        = presetOf(answers.equipment);
  const customOpen    = customTapped || preset === 'custom';
  const materialValue = customOpen ? 'custom' : preset;

  function close() {
    setCustomTapped(false);
    onClose();
  }

  function chooseMaterial(id) {
    if (id === 'custom') { setCustomTapped(true); return; }
    setCustomTapped(false);
    onChange('equipment', EQUIP_PRESETS[id]);
  }

  // ── Hint 1: tiempo — de `diffAdaptations` (§5.2) ──────────────────────────
  const totalSetsDelta   = (timeCuts ?? []).reduce((n, c) => n + c.setsDelta, 0);
  const totalRemoved     = (timeCuts ?? []).reduce((n, c) => n + c.removedIds.length, 0);
  const cutLabels        = (timeCuts ?? []).filter((c) => c.removedIds.length > 0).map((c) => c.label);
  let timeHint; let timeHintCut = false;
  if (totalSetsDelta <= 0) {
    timeHint = t('onboarding.adjustSheet.timeHintOk', 'Cabe todo. Ningún recorte.');
  } else if (totalRemoved > 0) {
    timeHintCut = true;
    timeHint = t('onboarding.adjustSheet.timeHintRemoved', {
      count: totalRemoved, labels: cutLabels.join(' y '), sets: totalSetsDelta,
      defaultValue: `Se quita ${totalRemoved} ejercicio en ${cutLabels.join(' y ')}, y ${totalSetsDelta} series en total.`,
    });
  } else {
    timeHintCut = true;
    timeHint = t('onboarding.adjustSheet.timeHintSetsOnly', {
      sets: totalSetsDelta, defaultValue: `Se quitan ${totalSetsDelta} series en total.`,
    });
  }

  // ── Hint 2: material ───────────────────────────────────────────────────
  const materialHint = customOpen
    ? t('onboarding.adjustSheet.materialCustomHint', {
      subs: (subs ?? []).filter((s) => s.reason === 'equipment').length,
      gaps: (unresolved ?? []).length,
      defaultValue: `${(subs ?? []).filter((s) => s.reason === 'equipment').length} ejercicios sustituidos · ${(unresolved ?? []).length} huecos que no cubre.`,
    })
    : t(`onboarding.adjustSheet.materialHint.${materialValue}`);

  // ── Hint 3: limitaciones ───────────────────────────────────────────────
  const limitationSubs = (subs ?? []).filter((s) => s.reason === 'limitation').length;
  const limitationsHint = (answers.limitations ?? []).includes('none') || !answers.limitations?.length
    ? t('onboarding.adjustSheet.limitationsHintNone', 'Sin limitaciones activas.')
    : t('onboarding.adjustSheet.limitationsHint', {
      count: limitationSubs,
      defaultValue: `${limitationSubs} ejercicios sustituidos para evitar tus limitaciones.`,
    });

  return (
    <DragSheet visible={visible} onClose={close} title={t('onboarding.adjustSheet.title', 'Ajustes')}>
      <View style={styles.sheetBody}>

        <Step number={1} title={t('onboarding.adjustSheet.step1', 'Tiempo por sesión')} hint={timeHint} hintColor={timeHintCut ? th.colors.orange : undefined}>
          <SegmentedControl
            options={TIME_OPTIONS}
            value={answers.sessionMinutes}
            onChange={(v) => onChange('sessionMinutes', v)}
          />
        </Step>

        <Step number={2} title={t('onboarding.adjustSheet.step2', 'Material')} hint={materialHint}>
          <SegmentedControl
            options={MATERIAL_OPTIONS.map((id) => ({ id, label: t(`onboarding.adjustSheet.material.${id}`) }))}
            value={materialValue}
            onChange={chooseMaterial}
          />
          {customOpen && (
            <View style={styles.pillRow}>
              {EQUIP_IDS.map((id) => (
                <Pill
                  key={id}
                  label={t(`onboarding.equipment.${id}.label`, id)}
                  selected={(answers.equipment ?? []).includes(id)}
                  onPress={() => onChange('equipment', toggleExclusive(answers.equipment, id, 'bodyweight'))}
                />
              ))}
            </View>
          )}
        </Step>

        <Step number={3} title={t('onboarding.adjustSheet.step3', 'Limitaciones')} hint={limitationsHint}>
          <View style={styles.pillRow}>
            {LIMIT_IDS.map((id) => (
              <Pill
                key={id}
                label={t(`onboarding.limitations.${id}.label`, id)}
                selected={(answers.limitations ?? []).includes(id)}
                onPress={() => onChange('limitations', toggleExclusive(answers.limitations, id, 'none'))}
              />
            ))}
          </View>
        </Step>

      </View>
    </DragSheet>
  );
}

const makeStyles = (th) => StyleSheet.create({
  sheetBody: { gap: spacing.lg, paddingBottom: spacing.sm },
  stepTitle: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  stepNum: { color: th.colors.accent },
  hint:    { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 14, marginTop: spacing.sm },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  // linkPill (ExerciseEditorInline.jsx) — aquí en fila que envuelve en vez de
  // columna, única desviación (§7): son etiquetas cortas, no largas.
  pill: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.xs,
    paddingHorizontal: 9,
    paddingVertical:   spacing.sm,
  },
  pillOn:      { backgroundColor: th.colors.accent },
  pillText:    { ...textStyles.btnAction, color: th.colors.text },
  pillTextOn:  { color: th.colors.onAccent },
});
