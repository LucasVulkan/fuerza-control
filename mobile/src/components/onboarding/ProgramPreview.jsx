/**
 * «Tu programa» de O01, sacado de `OnboardingScreen` para que lo compartan
 * «Nuevo programa» y el camino «por mi cuenta» del recorrido nuevo (O03-04).
 *
 *   ProgramPreviewItems  el contenido (fragmento: lo pone el caller dentro de
 *                        su scroll, con su `gap`); el modelo viene de `usePreviewModel`
 *
 * La hoja de ajustes (`AdjustSheet`) la pinta el caller: es un modal y, dentro de
 * un contenedor con `gap`, dejaría un hueco de más.
 */
import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '../ui/Text';
import { NavRow } from '../ui/EditorRows';
import AdaptationPanel from './AdaptationPanel';
import { StatsRow, SessionRow, RotatingChevron } from './ProposalCard';
import { estimateSessionSec, includesWarmup } from '../../utils/sessionCompression';
import { presetOf } from '../../utils/equipmentPresets';
import { spacing, textStyles, sheetRowBase } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import {
  totalWeeksOf, totalSetsOf, uniqueSessionTemplates, exerciseName,
} from './proposalData';

/** El contenido de «tu programa»; `model.tuned` ha de existir. */
export function ProgramPreviewItems({ model, answers, onOpenSheet }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [adjustmentsOpen,  setAdjustmentsOpen]  = useState(false);   // panel colapsado (§8)
  const { tuned, allEx, language, adjustments } = model;

  function toggleSession(tplId) {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(tplId)) next.delete(tplId);
      else next.add(tplId);
      return next;
    });
  }

  const { program, sessionTemplates: tunedTemplates, phases } = tuned;
  const totalWeeks      = totalWeeksOf(phases);
  const phasesCount     = phases?.length ?? 0;
  const uniqueTemplates = uniqueSessionTemplates(program, tunedTemplates);
  const countsWarmup    = includesWarmup(answers.sessionMinutes);
  const exName          = (id) => exerciseName(allEx, id, language);

  const minutosPorSesion = uniqueTemplates.map((tpl) => Math.round(
    estimateSessionSec(tpl.exercises ?? [], allEx, { includeWarmup: countsWarmup }) / 60,
  ));
  const mediaMinutos = minutosPorSesion.length
    ? Math.round(minutosPorSesion.reduce((a, b) => a + b, 0) / minutosPorSesion.length)
    : 0;
  // §6.3.2: sobre las plantillas YA ADAPTADAS, no sobre el arquetipo — por
  // eso bajan al apretar el tiempo.
  const totalSets = totalSetsOf(uniqueTemplates.map((tpl) => tpl.exercises));

  const materialLabel    = t(`onboarding.adjustSheet.material.${presetOf(answers.equipment)}`).toUpperCase();
  const limitationsList  = answers.limitations ?? [];
  const limitationsLabel = (!limitationsList.length || limitationsList.includes('none'))
    ? t('onboarding.limitations.none.label', 'Sin limitaciones').toUpperCase()
    : limitationsList.length === 1
      ? t(`onboarding.limitations.${limitationsList[0]}.label`, limitationsList[0]).toUpperCase()
      : t('onboarding.chips.limitationsCount', { count: limitationsList.length }).toUpperCase();
  const adjustNavTitle = `${answers.sessionMinutes} MIN · ${materialLabel} · ${limitationsLabel}`;

  return (
    <>
      <Text style={styles.byline}>
        {[
          totalWeeks > 0 ? t('onboarding.proposals.weeks', { weeks: totalWeeks, defaultValue: `${totalWeeks} semanas` }) : null,
          phasesCount > 0 ? t('onboarding.proposals.phasesCount', { count: phasesCount, defaultValue: `${phasesCount} fases` }) : null,
          t(`onboarding.goals.${answers.goal}.label`, answers.goal ?? ''),
        ].filter(Boolean).join(' · ')}
      </Text>

      <StatsRow card items={[
        { value: uniqueTemplates.length, label: t('onboarding.proposals.sessionsLabel', 'SESIONES') },
        { value: totalSets,              label: t('onboarding.preview.setsLabel', 'SERIES') },
        { value: `${mediaMinutos}′`,     label: t('onboarding.preview.perSessionLabel', 'POR SESIÓN') },
      ]} />

      {/* §5.3.1/§9: en sesiones cortas el tiempo se estima sin
          calentamiento general — decirlo, porque los datos de arriba
          dependen de ello y nunca usan `sessionStats`. */}
      {!countsWarmup && (
        <Text style={styles.previewNote}>
          {t('onboarding.preview.noWarmupNote',
            'Tiempo estimado sin calentamiento general — en sesiones cortas se entra a trabajar. Incluye el cambio de material entre ejercicios.')}
        </Text>
      )}

      <View>
        <Text style={styles.sectionLabel}>{t('onboarding.preview.adjustSectionLabel', 'Ajustes')}</Text>
        <NavRow
          title={adjustNavTitle}
          subtitle={t('onboarding.preview.adjustNavSubtitle', 'Tiempo, material y limitaciones')}
          onPress={onOpenSheet}
        />
      </View>

      {adjustments.count > 0 && (
        <TouchableOpacity
          style={styles.adjRow}
          onPress={() => setAdjustmentsOpen((v) => !v)}
          activeOpacity={0.75}
        >
          <Text style={styles.adjRowText}>
            {t('onboarding.preview.adjustmentsRow', { count: adjustments.count, defaultValue: `${adjustments.count} ajustes a tu programa` })}
          </Text>
          <RotatingChevron open={adjustmentsOpen} size={12} color={th.colors.mutedLight} />
        </TouchableOpacity>
      )}
      {adjustmentsOpen && <AdaptationPanel adjustments={adjustments} />}

      {uniqueTemplates.map((tpl, i) => (
        <SessionRow
          key={tpl.id}
          tpl={tpl}
          index={i}
          allEx={allEx}
          exName={exName}
          expanded={expandedSessions.has(tpl.id)}
          onToggle={() => toggleSession(tpl.id)}
          countsWarmup={countsWarmup}
        />
      ))}
    </>
  );
}

// `adjRow`: fila de opción que abre una hoja (`sheetRowBase` de theme.js).
const makeStyles = (th) => StyleSheet.create({
  byline:      { ...textStyles.body, color: th.colors.mutedLight },
  previewNote: { ...textStyles.body, color: th.colors.accent },
  sectionLabel: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  adjRow:     { ...sheetRowBase(th), justifyContent: 'space-between' },
  adjRowText: { ...textStyles.body, color: th.colors.mutedLight, flex: 1 },
});
