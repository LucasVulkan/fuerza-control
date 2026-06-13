import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, StyleSheet, Alert,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useStore, selectActiveProgram } from '../../store/useStore';
import AppHeader from '../components/AppHeader';
import ProgramUpdateModal from '../components/ProgramUpdateModal';
import {
  colors, spacing, typography, radius, borders,
  resolveColor, withOpacity,
} from '../theme';
import { formatDate } from '../../../src/utils/formatters';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Formats a Drive backup timestamp into a short, precise relative string.
 * Uses sub-hour precision for recent backups.
 */
function formatBackupTime(isoString) {
  if (!isoString) return null;
  const ms      = Date.now() - new Date(isoString).getTime();
  const mins    = Math.floor(ms / 60000);
  const hours   = Math.floor(ms / 3600000);
  const days    = Math.floor(ms / 86400000);
  if (mins  <  1) return 'ahora';
  if (mins  < 60) return `${mins}min`;
  if (hours < 24) return `${hours}h`;
  if (days  <  2) return 'ayer';
  if (days  <  7) return `${days}d`;
  // Older than a week: show short date
  const d = new Date(isoString);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function relativeTime(ts, t) {
  if (!ts) return null;
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0)  return t('dayCard.today');
  if (days === 1)  return t('dayCard.yesterday');
  if (days < 7)   return t('dayCard.daysAgo', { count: days });
  if (days < 14)  return t('dayCard.oneWeekAgo');
  if (days < 30)  return t('dayCard.weeksAgo', { count: Math.floor(days / 7) });
  return formatDate(ts);
}

/**
 * Global "week" counter = total sessions logged for this program / sessions-per-cycle.
 * "Semana" in this app = one complete rotation through the session templates.
 */
function computeWeekNum(program, workoutLog) {
  const hasStages = (program.stages?.length ?? 0) > 0;

  if (hasStages) {
    // totalWeeksCompleted is incremented on the program each time a full cycle
    // is completed, regardless of stage. Stage changes don't reset it.
    return (program.totalWeeksCompleted ?? 0) + 1;
  }

  // Non-staged programs: count completed cycles from the workoutLog.
  const allIds = new Set((program.days ?? []).map((d) => d.sessionTemplateId));
  const sessionsPerCycle = Math.max(1, program.days?.length ?? 1);
  const total = workoutLog.filter((e) => allIds.has(e.sessionTemplateId)).length;
  return Math.floor(total / sessionsPerCycle) + 1;
}

/**
 * How many sessions have been completed in the CURRENT cycle (0-indexed),
 * and how many sessions are in one cycle.
 */
function computeCycleProgress(program) {
  const hasStages   = (program.stages?.length ?? 0) > 0;
  const stageIdx    = program.currentStageIndex ?? 0;
  const currentDays = hasStages
    ? (program.stages[stageIdx]?.days ?? [])
    : (program.days ?? []);
  const sessionsPerCycle = Math.max(1, currentDays.length);
  const doneInCycle      = (program.stageSessionsCompleted ?? 0) % sessionsPerCycle;
  return { doneInCycle, sessionsPerCycle };
}

/**
 * Data for the stage card (null when there are no stages).
 */
function computeStageInfo(program, t) {
  if ((program.stages?.length ?? 0) === 0) return null;
  const stageIdx         = program.currentStageIndex ?? 0;
  const stage            = program.stages[stageIdx];
  if (!stage) return null;
  const sessionsPerCycle = Math.max(1, stage.days?.length ?? 1);
  const totalWeeks       = stage.durationWeeks ?? 4;
  const sessionsCompleted = program.stageSessionsCompleted ?? 0;
  const weekInStage      = Math.min(
    Math.floor(sessionsCompleted / sessionsPerCycle) + 1,
    totalWeeks,
  );
  const progressRatio    = Math.min(1, sessionsCompleted / (totalWeeks * sessionsPerCycle));
  const defaultLabel     = t('home.stageDefault', { n: stageIdx + 1 });
  return {
    stageLabel:    defaultLabel,
    stageName:     stage.name ?? defaultLabel,
    weekInStage,
    totalWeeks,
    progressRatio,
  };
}

/**
 * Determines the display status of each session slot in the current cycle.
 * Sessions are assumed to be completed in template order (A→B→C→A…).
 *
 *   'active'  — session is currently in progress
 *   'next'    — next in rotation (not yet started this cycle)
 *   'done'    — already completed this cycle
 *   'pending' — not yet reached this cycle
 */
function getSessionStatus(dayIndex, doneInCycle, activeTemplateId, templateId) {
  if (activeTemplateId && activeTemplateId === templateId) return 'active';
  if (dayIndex < doneInCycle)  return 'done';
  if (dayIndex === doneInCycle) return 'next';
  return 'pending';
}

// ── ProgressHeader ─────────────────────────────────────────────────────────────

function DotsRow({ doneInCycle, sessionsPerCycle }) {
  return (
    <View style={styles.phDots}>
      {Array.from({ length: sessionsPerCycle }, (_, i) => {
        const state = i < doneInCycle ? 'done'
                    : i === doneInCycle ? 'pending'
                    : 'idle';
        return (
          <View
            key={i}
            style={[
              styles.phDot,
              state === 'done'    && styles.phDotDone,
              state === 'pending' && styles.phDotPending,
              state === 'idle'    && styles.phDotIdle,
            ]}
          />
        );
      })}
    </View>
  );
}

function ProgressHeader({ weekNum, doneInCycle, sessionsPerCycle, stageInfo, onChangeStage }) {
  const { t }     = useTranslation();
  const weekLabel = String(weekNum).padStart(2, '0');

  if (stageInfo) {
    // ── With stages: unified card — week number (left) + stage progress (right) ──
    return (
      <View style={styles.cpCard}>

        {/* Week number — the one stat that leads */}
        <View style={styles.cpWeekCol}>
          <Text style={styles.cpWeekNum}>{weekLabel}</Text>
          <Text style={styles.cpWeekLabel}>{t('home.week')}</Text>
        </View>

        <View style={styles.cpDivider} />

        {/* Stage name + menu, progress bar, week-in-stage + cycle dots */}
        <View style={styles.cpRight}>
          <View style={styles.cpRightTop}>
            <Text style={styles.cpStageName} numberOfLines={1}>
              {stageInfo.stageName}
              <Text style={styles.cpStageLabel}>{`  ·  ${stageInfo.stageLabel}`}</Text>
            </Text>
            <TouchableOpacity
              onPress={onChangeStage}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 4 }}
            >
              <Text style={styles.cpMenu}>···</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cpBar}>
            <View style={[styles.cpBarFill, { width: `${Math.round(stageInfo.progressRatio * 100)}%` }]} />
          </View>
          <View style={styles.cpRightBottom}>
            <Text style={styles.cpWeekInStage}>
              {t('home.weekProgress', { current: stageInfo.weekInStage, total: stageInfo.totalWeeks })}
            </Text>
            <DotsRow doneInCycle={doneInCycle} sessionsPerCycle={sessionsPerCycle} />
          </View>
        </View>

      </View>
    );
  }

  // ── Without stages: horizontal pill ──
  return (
    <View style={[styles.phCard, styles.phPill]}>
      <View style={styles.phPillLeft}>
        <Text style={styles.phPillLabel}>{t('home.week')}</Text>
        <Text style={styles.phPillNum}>{weekLabel}</Text>
      </View>
      <View style={styles.phPillDivider} />
      <View style={styles.phPillRight}>
        <Text style={styles.phWkSes}>{t('home.sessions')}</Text>
        <DotsRow doneInCycle={doneInCycle} sessionsPerCycle={sessionsPerCycle} />
      </View>
    </View>
  );
}

// ── Session cards ──────────────────────────────────────────────────────────────

function sessionA11yLabel(t, template, statusLabel) {
  return `${t('workout.sessionLabel', { label: template?.label ?? '' })}, ${template?.name ?? ''}, ${statusLabel}`;
}

function exercisePreview(template, allExercises, language, count) {
  return (template?.exercises ?? [])
    .slice(0, count)
    .map(({ exerciseId }) => {
      const ex = allExercises[exerciseId];
      if (!ex) return null;
      return language === 'en' ? (ex.nameEn ?? ex.name) : ex.name;
    })
    .filter(Boolean)
    .join(' · ');
}

/** Featured card for the next (or in-progress) session — the main CTA of the home. */
function HeroSessionCard({ template, lastSession, allExercises, status, onPress, language, hasOverride }) {
  const { t }  = useTranslation();
  const accent = resolveColor(template?.color ?? 'var(--day1)');
  const exerciseNames = exercisePreview(template, allExercises, language, 3);
  const isActive    = status === 'active';
  const timeText    = isActive
    ? t('home.sessionActiveNow')
    : (relativeTime(lastSession?.timestamp, t) ?? t('home.firstTime'));
  const statusLabel = isActive ? t('home.sessionActive') : t('home.sessionNext');

  return (
    <TouchableOpacity
      style={styles.heroCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={sessionA11yLabel(t, template, statusLabel)}
    >
      <View style={styles.heroTop}>
        <View style={styles.heroTagRow}>
          <Text style={[styles.heroTag, { color: accent }]}>
            {t('workout.sessionLabel', { label: template?.label ?? '' }).toUpperCase()}
          </Text>
          {hasOverride && (
            <View style={styles.adaptedChip}><Text style={styles.adaptedChipText}>{t('home.adapted')}</Text></View>
          )}
        </View>
        <Text style={[styles.heroTime, isActive && { color: colors.accent }]}>{timeText}</Text>
      </View>
      <Text style={styles.heroName} numberOfLines={1}>{template?.name ?? ''}</Text>
      {exerciseNames ? (
        <Text style={styles.heroEx} numberOfLines={1}>{exerciseNames}</Text>
      ) : null}
      <View style={styles.heroCta}>
        <Text style={styles.heroCtaText}>
          {`${isActive ? t('home.btnContinue') : t('home.btnStart')}  →`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** Compact row for the rest of the cycle: done sessions dimmed, pending neutral. */
function CompactSessionCard({ template, lastSession, status, orderNum, onPress, hasOverride }) {
  const { t }  = useTranslation();
  const accent = resolveColor(template?.color ?? 'var(--day1)');
  const done   = status === 'done';
  const rel    = relativeTime(lastSession?.timestamp, t);
  const meta   = done
    ? `${t('home.sessionDone')}${rel ? ` · ${rel}` : ''}`
    : (rel ?? t('home.firstTime'));
  const statusLabel = done ? t('home.sessionDone') : t('home.sessionPending');

  return (
    <TouchableOpacity
      style={[styles.cmpCard, { borderLeftColor: accent }, done && styles.cmpCardDone]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={sessionA11yLabel(t, template, statusLabel)}
    >
      <View style={styles.cmpLeft}>
        {done
          ? <CheckIcon size={15} color={colors.green} />
          : <Text style={styles.cmpOrder}>{orderNum}</Text>}
      </View>
      <View style={styles.cmpInfo}>
        <View style={styles.cmpTitleRow}>
          <Text style={[styles.cmpTitle, { color: accent }]} numberOfLines={1}>
            {`${template?.label ?? ''} · ${template?.name ?? ''}`}
          </Text>
          {hasOverride && (
            <View style={styles.adaptedChip}><Text style={styles.adaptedChipText}>{t('home.adapted')}</Text></View>
          )}
        </View>
        <Text style={styles.cmpMeta} numberOfLines={1}>{meta}</Text>
      </View>
      <View style={styles.cmpBtn}>
        <Text style={styles.cmpBtnText}>{done ? t('home.btnRepeat') : t('home.btnDo')}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── ArchiveModal ───────────────────────────────────────────────────────────────

function ArchiveModal({ programName, onConfirm, onClose }) {
  const { t }    = useTranslation();
  const insets   = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(spacing.xxl, insets.bottom + spacing.lg) }]}>
        <Text style={styles.sheetTitle}>{t('home.archiveModal.title')}</Text>
        <Text style={styles.archiveDesc}>
          <Text style={{ color: colors.text, fontWeight: typography.semibold }}>{programName}</Text>
          {'\n'}{t('home.archiveModal.desc')}
        </Text>
        <ArchiveOption
          label={t('home.archiveModal.keepHistory')}
          desc={t('home.archiveModal.keepHistoryDesc')}
          onPress={() => onConfirm(false)}
        />
        <ArchiveOption
          label={t('home.archiveModal.clearHistory')}
          desc={t('home.archiveModal.clearHistoryDesc')}
          onPress={() => onConfirm(true)}
          danger
        />
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function ArchiveOption({ label, desc, onPress, danger }) {
  return (
    <TouchableOpacity
      style={[styles.archiveOption, danger && styles.archiveOptionDanger]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.archiveOptionLabel, danger && { color: colors.red }]}>{label}</Text>
      <Text style={styles.archiveOptionDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

// ── StagePickerModal ───────────────────────────────────────────────────────────

function StagePickerModal({ program, onSelect, onClose }) {
  const { t }      = useTranslation();
  const insets     = useSafeAreaInsets();
  const currentIdx = program.currentStageIndex ?? 0;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(spacing.xxl, insets.bottom + spacing.lg) }]}>
        <Text style={styles.sheetTitle}>{t('home.selectStage')}</Text>
        <View style={styles.stageList}>
          {program.stages.map((stage, idx) => {
            const isActive = idx === currentIdx;
            return (
              <TouchableOpacity
                key={stage.id ?? idx}
                style={[styles.stageOption, isActive && styles.stageOptionActive]}
                onPress={() => onSelect(idx)}
                activeOpacity={isActive ? 1 : 0.7}
              >
                <View style={styles.stageOptionHeader}>
                  <Text style={[styles.stageOptionName, isActive && styles.stageOptionNameActive]}>
                    {stage.name}
                  </Text>
                  {isActive && <Text style={styles.stageActiveLabel}>ACTIVA</Text>}
                </View>
                <Text style={styles.stageOptionDesc}>
                  {`${stage.durationWeeks ?? 4} sem · ${stage.days?.length ?? 0} sesiones/ciclo`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── ProgramBtn ─────────────────────────────────────────────────────────────────

function ProgramBtn({ label, onPress, icon }) {
  return (
    <TouchableOpacity
      style={styles.programBtn}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      {icon}
      <Text style={styles.programBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Status card icons ─────────────────────────────────────────────────────────

function CloudIcon({ size = 22, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PersonIcon({ size = 22, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function CheckIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronRightIcon({ size = 14, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function EyeIcon({ size = 14, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function PencilIcon({ size = 14, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BarbellIcon({ size = 14, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9v6M20 9v6M7 6.5v11M17 6.5v11M7 12h10" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// ── Section header ──────────────────────────────────────────────────────────────
// SESIONES carries an icon (the training core); PROGRAMA/CONEXIONES are text-only,
// muted — the hierarchy comes from the icon, the colour and the divider above.

function SectionHeader({ label, icon, muted }) {
  return (
    <View style={styles.secHeader}>
      {icon}
      <Text style={[styles.secHeaderLabel, muted && styles.secHeaderLabelMuted]}>{label}</Text>
    </View>
  );
}

// ── HomeScreen ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [stagePicker, setStagePicker] = useState(false);

  const activeProgram        = useStore(selectActiveProgram);
  const activeSession        = useStore((s) => s.activeSession);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  const workoutLog           = useStore((s) => s.workoutLog);
  // Subscribed only so template/program edits re-render this screen
  // eslint-disable-next-line no-unused-vars
  const sessionTemplates     = useStore((s) => s.sessionTemplates);
  // eslint-disable-next-line no-unused-vars
  const userPrograms         = useStore((s) => s.userPrograms);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const getLastSession       = useStore((s) => s.getLastSession);
  const startSession         = useStore((s) => s.startSession);
  const startFreeSession     = useStore((s) => s.startFreeSession);
  const navigate             = useStore((s) => s.navigate);
  const clientSync           = useStore((s) => s.clientSync);
  const archiveProgram       = useStore((s) => s.archiveProgram);
  const advanceStage         = useStore((s) => s.advanceStage);
  const dismissStageAdvance  = useStore((s) => s.dismissStageAdvance);
  const setCurrentStage      = useStore((s) => s.setCurrentStage);
  const driveBackup          = useStore((s) => s.driveBackup);

  const allExercises = { ...exerciseLibrary, ...customExercises };

  function handleArchiveConfirm(clearHistory) {
    if (activeProgram) archiveProgram(activeProgram.id, clearHistory);
    setArchiveOpen(false);
  }

  // ── Status cards data ────────────────────────────────────────────────────────
  const driveConnected  = driveBackup.enabled && !driveBackup.needsReconnect;
  const driveWarn       = driveBackup.enabled && driveBackup.needsReconnect;
  const driveIconColor  = driveWarn ? colors.orange : driveConnected ? colors.green : colors.muted;
  const driveSub        = driveWarn
    ? t('home.reconnect')
    : driveConnected
      ? (driveBackup.lastBackup ? formatBackupTime(driveBackup.lastBackup) : t('home.connected'))
      : t('home.notConnected');

  const trainerOk        = !!clientSync.slotId && !clientSync.syncErrorAt && !clientSync.pendingUpload;
  const trainerWarn      = !!clientSync.slotId && (!!clientSync.syncErrorAt || clientSync.pendingUpload);
  const trainerIconColor = trainerWarn ? colors.orange : trainerOk ? colors.blue : colors.muted;
  const trainerTitle     = (trainerOk || trainerWarn)
    ? (clientSync.trainerName ?? t('home.trainer'))
    : t('home.trainer');
  const trainerSub       = trainerWarn
    ? t('home.pendingSync')
    : trainerOk ? t('home.connected') : t('home.notConnected');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />
      <ProgramUpdateModal />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {activeProgram ? (() => {
          const hasStages   = (activeProgram.stages?.length ?? 0) > 0;
          const stageIdx    = activeProgram.currentStageIndex ?? 0;
          const currentStage = hasStages ? activeProgram.stages[stageIdx] : null;
          const nextStage    = hasStages ? activeProgram.stages[stageIdx + 1] : null;

          // Computed values for progress header
          const stageInfo                  = computeStageInfo(activeProgram, t);
          const weekNum                    = computeWeekNum(activeProgram, workoutLog);
          const { doneInCycle, sessionsPerCycle } = computeCycleProgress(activeProgram);

          // Current session templates in cycle order (handles both flat and staged programs)
          const currentDays = hasStages
            ? (activeProgram.stages[stageIdx]?.days ?? [])
            : (activeProgram.days ?? []);

          // Trainer name — from the first session template that has one
          const programTrainerName = currentDays
            .map((d) => getEffectiveTemplate(d.sessionTemplateId)?.trainerName)
            .find(Boolean) ?? null;

          return (
            <>
              {/* Program name + trainer credit */}
              <View style={styles.progHeader}>
                <Text style={styles.progLabel} numberOfLines={1}>
                  {activeProgram.name}
                  {programTrainerName
                    ? <Text style={styles.progTrainerInline}>{`  ·  ${t('workout.trainerCredit', { name: programTrainerName })}`}</Text>
                    : null}
                </Text>
              </View>

              {/* Progress header (stage + week / pill) */}
              <ProgressHeader
                weekNum={weekNum}
                doneInCycle={doneInCycle}
                sessionsPerCycle={sessionsPerCycle}
                stageInfo={stageInfo}
                onChangeStage={() => setStagePicker(true)}
              />

              {/* Stage advance banner */}
              {activeProgram.stageAdvancePending && nextStage && (
                <View style={styles.stageBanner}>
                  <Text style={styles.stageBannerLabel}>{t('home.stageCompleted').toUpperCase()}</Text>
                  <Text style={styles.stageBannerText}>
                    {t('home.stageAdvanceText', {
                      current: currentStage?.name ?? t('home.currentStageDefault'),
                      next: nextStage.name,
                    })}
                  </Text>
                  <View style={styles.stageBannerBtns}>
                    <TouchableOpacity
                      style={styles.stageBannerAdvanceBtn}
                      onPress={() => advanceStage(activeProgram.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.stageBannerAdvanceBtnText}>
                        {t('home.advanceTo', { name: (nextStage.name ?? '').toUpperCase() })}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stageBannerContinueBtn}
                      onPress={() => dismissStageAdvance(activeProgram.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stageBannerContinueBtnText}>{t('home.continueStage')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── SESIONES ── (hero + pending sessions + free session) */}
              <View style={styles.section}>
                <SectionHeader
                  icon={<BarbellIcon size={14} color={colors.accent} />}
                  label={t('home.sessions').toUpperCase()}
                />
                {(() => {
                  const days = currentDays
                    .map(({ sessionTemplateId }, dayIndex) => ({
                      templateId:  sessionTemplateId,
                      template:    getEffectiveTemplate(sessionTemplateId),
                      lastSession: getLastSession(sessionTemplateId),
                      status:      getSessionStatus(dayIndex, doneInCycle, activeSession?.templateId, sessionTemplateId),
                      orderNum:    dayIndex + 1,
                    }))
                    .filter((d) => d.template);

                  const hero = days.find((d) => d.status === 'active')
                            ?? days.find((d) => d.status === 'next');
                  const rest = days.filter((d) => d !== hero);

                  // Starting a session out of rotation is easy to do by accident —
                  // compact rows confirm before starting.
                  const confirmStart = (d) => {
                    Alert.alert(
                      t('home.startOutOfOrderTitle', {
                        label: t('workout.sessionLabel', { label: d.template.label ?? '' }),
                      }),
                      t('home.startOutOfOrderDesc'),
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('home.btnStart'), onPress: () => startSession(d.templateId) },
                      ],
                    );
                  };

                  return (
                    <View style={styles.sesList}>
                      {hero && (
                        <HeroSessionCard
                          template={hero.template}
                          lastSession={hero.lastSession}
                          allExercises={allExercises}
                          status={hero.status}
                          language={i18n.language}
                          hasOverride={!!clientSync.pendingOverrides?.[hero.templateId]}
                          onPress={
                            hero.status === 'active'
                              ? () => navigation.navigate('Workout')
                              : () => startSession(hero.templateId)
                          }
                        />
                      )}
                      {rest.length > 0 && (
                        <Text style={styles.subLabel}>{t('home.restOfCycle').toUpperCase()}</Text>
                      )}
                      {rest.map((d) => (
                        <CompactSessionCard
                          key={d.templateId}
                          template={d.template}
                          lastSession={d.lastSession}
                          status={d.status === 'done' ? 'done' : 'pending'}
                          orderNum={d.orderNum}
                          hasOverride={!!clientSync.pendingOverrides?.[d.templateId]}
                          onPress={() => confirmStart(d)}
                        />
                      ))}
                    </View>
                  );
                })()}

                {/* Sesión libre */}
                <TouchableOpacity
                  style={styles.freeSessionBtn}
                  onPress={
                    activeSession.templateId === '__free__'
                      ? () => navigation.navigate('Workout')
                      : startFreeSession
                  }
                  activeOpacity={0.75}
                  accessibilityRole="button"
                >
                  <Text style={styles.freeSessionBtnText}>
                    {activeSession.templateId === '__free__'
                      ? t('freeSession.btnContinue')
                      : t('freeSession.btn')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── PROGRAMA ── */}
              <View style={styles.section}>
                <SectionHeader label={t('home.program').toUpperCase()} muted />
                <View style={styles.programActions}>
                  <ProgramBtn
                    label={t('home.viewProgram')}
                    icon={<EyeIcon size={14} color={colors.mutedLight} />}
                    onPress={() => navigate('programPrint')}
                  />
                  <ProgramBtn
                    label={t('home.edit')}
                    icon={<PencilIcon size={14} color={colors.mutedLight} />}
                    onPress={() => navigate('programEditor')}
                  />
                  <TouchableOpacity
                    style={styles.programBtnMore}
                    onPress={() => setArchiveOpen(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.moreOptions')}
                  >
                    <Text style={styles.programBtnMoreText}>···</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          );
        })() : (
          /* ── Empty state ── */
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyText}>
              {t('home.noActiveProgram')}
            </Text>
            <TouchableOpacity
              style={styles.newProgramBtn}
              onPress={() => {
                if (clientSync?.slotId) {
                  Alert.alert(
                    '¿Crear nuevo programa?',
                    'Al crear un programa nuevo te desconectarás de tu entrenador y el programa actual será reemplazado.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Continuar', style: 'destructive', onPress: () => navigate('onboarding') },
                    ],
                  );
                } else {
                  navigate('onboarding');
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.newProgramBtnText}>{t('home.newProgram')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── CONEXIONES (Drive + Entrenador) — solo destacan si necesitan atención ── */}
        <View style={styles.section}>
        <SectionHeader label={t('home.connections').toUpperCase()} muted />
        <View style={styles.statusCards}>

          {/* Drive */}
          <TouchableOpacity
            style={[styles.statusCard, driveWarn && styles.statusCardWarn]}
            onPress={() => navigation.navigate('DriveBackup')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Drive, ${driveSub}`}
          >
            <CloudIcon size={18} color={driveIconColor} />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle} numberOfLines={1}>Drive</Text>
              <Text style={[styles.statusSub, driveWarn && { color: colors.orange }]} numberOfLines={1}>
                {driveSub}
              </Text>
            </View>
            <ChevronRightIcon size={13} color={colors.muted2} />
          </TouchableOpacity>

          {/* Entrenador */}
          <TouchableOpacity
            style={[styles.statusCard, trainerWarn && styles.statusCardWarn]}
            onPress={() => navigation.navigate('TrainerConnection')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${trainerTitle}, ${trainerSub}`}
          >
            <PersonIcon size={18} color={trainerIconColor} />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle} numberOfLines={1}>{trainerTitle}</Text>
              <Text style={[styles.statusSub, trainerWarn && { color: colors.orange }]} numberOfLines={1}>
                {trainerSub}
              </Text>
            </View>
            <ChevronRightIcon size={13} color={colors.muted2} />
          </TouchableOpacity>

        </View>
        </View>
      </ScrollView>

      {/* Modals */}
      {archiveOpen && (
        <ArchiveModal
          programName={activeProgram?.name}
          onConfirm={handleArchiveConfirm}
          onClose={() => setArchiveOpen(false)}
        />
      )}
      {stagePicker && (activeProgram?.stages?.length ?? 0) > 0 && (
        <StagePickerModal
          program={activeProgram}
          onSelect={(idx) => {
            if (idx !== (activeProgram.currentStageIndex ?? 0)) {
              setCurrentStage(activeProgram.id, idx);
            }
            setStagePicker(false);
          }}
          onClose={() => setStagePicker(false)}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  container: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  content: {
    padding:       spacing.xl,
    paddingBottom: spacing.xxl * 2,
    gap:           spacing.lg,
  },

  // ── Section structure (Sesiones / Programa / Conexiones) ──────────────────────
  section: {
    gap: spacing.sm,
  },
  secHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  secHeaderLabel: {
    fontSize:      11,
    fontWeight:    typography.semibold,
    letterSpacing: 1.5,
    color:         colors.muted,
    textTransform: 'uppercase',
  },
  secHeaderLabelMuted: {
    color: colors.muted2,
  },
  subLabel: {
    fontSize:      10,
    fontWeight:    typography.medium,
    letterSpacing: 1,
    color:         colors.muted2,
    paddingLeft:   2,
    marginTop:     5,
    marginBottom:  -1,
  },

  // ── Stage/week header (C+) ────────────────────────────────────────────────────
  cpCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    backgroundColor: '#101010',
    borderWidth:     borders.thin,
    borderColor:     '#242424',
    borderRadius:    radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md + 2,
  },
  cpWeekCol: {
    alignItems: 'center',
    flexShrink: 0,
  },
  cpWeekNum: {
    fontSize:      26,
    fontWeight:    typography.bold,
    color:         colors.text,
    lineHeight:    26,
    letterSpacing: -1,
  },
  cpWeekLabel: {
    fontSize:      9,
    fontWeight:    typography.semibold,
    letterSpacing: 1,
    color:         colors.muted2,
    marginTop:     3,
    textTransform: 'uppercase',
  },
  cpDivider: {
    width:           1,
    alignSelf:       'stretch',
    backgroundColor: '#242424',
  },
  cpRight: {
    flex:     1,
    minWidth: 0,
  },
  cpRightTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'baseline',
    marginBottom:   8,
  },
  cpStageName: {
    flexShrink: 1,
    fontSize:   13,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  cpStageLabel: {
    fontSize:   11,
    fontWeight: typography.regular,
    color:      colors.muted2,
  },
  cpMenu: {
    fontSize:      16,
    color:         colors.muted,
    lineHeight:    16,
    letterSpacing: 1,
    paddingLeft:   spacing.sm,
  },
  cpBar: {
    height:          4,
    backgroundColor: colors.border,
    borderRadius:    2,
    overflow:        'hidden',
    marginBottom:    6,
  },
  cpBarFill: {
    height:          '100%',
    backgroundColor: colors.accent,
    borderRadius:    2,
  },
  cpRightBottom: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  cpWeekInStage: {
    fontSize: 11,
    color:    colors.muted2,
  },

  // ── Program label ────────────────────────────────────────────────────────────
  progHeader: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  progLabel: {
    fontSize:      typography.sm,
    fontWeight:    typography.bold,
    letterSpacing: 2,
    color:         colors.muted2,
    textTransform: 'uppercase',
    paddingLeft:   2,
  },
  progTrainer: {
    fontSize:  typography.xs,
    color:     colors.muted2,
    marginTop: 1,
    paddingLeft: 2,
  },
  progTrainerInline: {
    fontSize:      typography.xs,
    color:         colors.muted2,
    fontWeight:    typography.regular,
    letterSpacing: 0,
    textTransform: 'none',
  },
  progDriveBlock: {
    alignItems: 'flex-end',
    marginTop:  2,
    gap:        1,
  },
  progDriveIcon: {
    fontSize:  13,
    color:     colors.green,
    opacity:   0.8,
  },
  progDriveTime: {
    fontSize:      typography.xs - 1,
    color:         colors.green,
    opacity:       0.7,
    textAlign:     'right',
  },

  // ── Progress header ──────────────────────────────────────────────────────────
  progressHeader: {
    flexDirection: 'row',
    gap:           8,
  },
  phCard: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     '#242424',
    borderRadius:    radius.md,
  },

  // Stage card (left, wider)
  phStage: {
    flex:    1.6,
    padding: spacing.md,
  },
  phStageRow1: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   3,
  },
  phStageLabel: {
    fontSize:      11,
    fontWeight:    typography.semibold,
    color:         colors.muted,
    letterSpacing: 0.2,
  },
  phStageMenu: {
    fontSize:      16,
    color:         colors.muted,
    lineHeight:    16,
    letterSpacing: 1,
  },
  phStageName: {
    fontSize:     15,
    fontWeight:   typography.bold,
    color:        colors.text,
    lineHeight:   15 * 1.2,
    marginBottom: 3,
  },
  phStageWeek: {
    fontSize:     11,
    fontWeight:   typography.regular,
    color:        colors.mutedLight,
    marginBottom: spacing.sm,
  },
  phBar: {
    height:          4,
    backgroundColor: colors.border,
    borderRadius:    2,
    overflow:        'hidden',
  },
  phBarFill: {
    height:          '100%',
    backgroundColor: colors.accent,
    borderRadius:    2,
  },

  // Week card (right, squarish)
  phWeekSq: {
    flex:           1,
    padding:        11,
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  phWkTop: {
    fontSize:      11,
    fontWeight:    typography.semibold,
    color:         colors.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  phWkNum: {
    fontSize:      22,
    fontWeight:    typography.bold,
    color:         colors.text,
    lineHeight:    22,
    letterSpacing: -0.5,
  },
  phWeekBottom: {
    alignItems: 'center',
    gap:        4,
  },
  phWkSes: {
    fontSize:   11,
    fontWeight: typography.regular,
    color:      colors.mutedLight,
    textAlign:  'center',
  },
  phDots: {
    flexDirection:  'row',
    gap:            5,
    alignItems:     'center',
    justifyContent: 'center',
  },
  phDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  phDotDone: {
    backgroundColor: colors.accent,
  },
  phDotPending: {
    backgroundColor: withOpacity(colors.accent, 0.15),
    borderWidth:     1.5,
    borderColor:     withOpacity(colors.accent, 0.5),
  },
  phDotIdle: {
    backgroundColor: '#333333',
  },

  // Week pill (no stages, full width)
  phPill: {
    flex:           1,
    height:         54,
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: spacing.lg,
  },
  phPillLeft: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           7,
  },
  phPillLabel: {
    fontSize:      11,
    fontWeight:    typography.semibold,
    color:         colors.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  phPillNum: {
    fontSize:      22,
    fontWeight:    typography.bold,
    color:         colors.text,
    letterSpacing: -0.5,
    lineHeight:    22,
  },
  phPillDivider: {
    width:           1,
    height:          26,
    backgroundColor: colors.border,
    marginRight:     spacing.lg,
  },
  phPillRight: {
    alignItems: 'center',
    gap:        4,
  },

  // ── Session cards ─────────────────────────────────────────────────────────────
  sesList: {
    gap: 7,
  },
  secLabel: {
    fontSize:      11,
    fontWeight:    typography.semibold,
    letterSpacing: 1,
    color:         colors.mutedLight,
    paddingLeft:   2,
    marginBottom:  1,
  },

  // Hero (next / in-progress session)
  heroCard: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.35),
    borderRadius:    radius.md,
    padding:         spacing.md + 2,
  },
  heroTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   2,
  },
  heroTagRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flexShrink:    1,
  },
  cmpTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  adaptedChip: {
    backgroundColor:   withOpacity(colors.blue, 0.14),
    borderRadius:      radius.full,
    paddingHorizontal: 7,
    paddingVertical:   1,
    flexShrink:        0,
  },
  adaptedChipText: {
    fontSize:      9,
    fontWeight:    typography.bold,
    color:         colors.blue,
    letterSpacing: 0.5,
  },
  heroTag: {
    fontSize:      12,
    fontWeight:    typography.bold,
    letterSpacing: 1,
  },
  heroTime: {
    fontSize: 11,
    color:    colors.mutedLight,
  },
  heroName: {
    fontSize:     17,
    fontWeight:   typography.bold,
    color:        colors.text,
    marginBottom: 3,
  },
  heroEx: {
    fontSize:     12,
    color:        colors.mutedLight,
    marginBottom: spacing.sm,
  },
  heroCta: {
    backgroundColor: colors.accent,
    borderRadius:    radius.sm + 2,
    paddingVertical: 11,
    alignItems:      'center',
    marginTop:       spacing.md,
  },
  heroCtaText: {
    fontSize:      14,
    fontWeight:    typography.bold,
    color:         colors.onAccent,
    letterSpacing: 0.5,
  },

  // Compact rows (done / pending)
  cmpCard: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm + 2,
    backgroundColor:   colors.surface,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderLeftWidth:   3,
    borderRadius:      radius.md,
    paddingVertical:   spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  cmpCardDone: {
    opacity: 0.55,
  },
  cmpLeft: {
    width:      18,
    alignItems: 'center',
  },
  cmpOrder: {
    fontSize:   12,
    fontWeight: typography.medium,
    color:      colors.muted,
  },
  cmpInfo: {
    flex:     1,
    minWidth: 0,
    gap:      1,
  },
  cmpTitle: {
    fontSize:   13,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  cmpMeta: {
    fontSize: 11,
    color:    colors.mutedLight,
  },
  cmpBtn: {
    borderWidth:       borders.thin,
    borderColor:       '#333333',
    borderRadius:      radius.sm,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  cmpBtnText: {
    fontSize:   11,
    fontWeight: typography.medium,
    color:      colors.mutedLight,
  },

  // ── Stage advance banner ──────────────────────────────────────────────────────
  stageBanner: {
    backgroundColor: withOpacity(colors.accent, 0.06),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.25),
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
  },
  stageBannerLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 1.5,
  },
  stageBannerText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.text,
    lineHeight: typography.sm * 1.5,
  },
  stageBannerBtns: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  stageBannerAdvanceBtn: {
    flex:            2,
    backgroundColor: colors.accent,
    borderRadius:    radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems:      'center',
  },
  stageBannerAdvanceBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.onAccent,
    letterSpacing: 0.5,
  },
  stageBannerContinueBtn: {
    flex:            1,
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.3),
    borderRadius:    radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems:      'center',
  },
  stageBannerContinueBtnText: {
    fontSize:   typography.sm,
    color:      colors.muted,
    fontWeight: typography.medium,
  },

  // ── Program action buttons ────────────────────────────────────────────────────
  programActions: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  programBtn: {
    flex:            1,
    flexDirection:   'row',
    justifyContent:  'center',
    alignItems:      'center',
    gap:             6,
    paddingVertical: spacing.sm + 1,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface,
  },
  programBtnText: {
    fontSize:   typography.sm + 1,
    fontWeight: typography.medium,
    color:      colors.mutedLight,
  },
  programBtnMore: {
    width:           46,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },
  programBtnMoreText: {
    fontSize:      15,
    color:         colors.mutedLight,
    letterSpacing: 1,
  },

  // ── Sesión libre ──────────────────────────────────────────────────────────────
  freeSessionBtn: {
    paddingVertical: spacing.sm + 1,
    borderRadius:    radius.md,
    borderWidth:     borders.thin,
    borderStyle:     'dashed',
    borderColor:     '#333333',
    alignItems:      'center',
  },
  freeSessionBtnText: {
    fontSize:      typography.sm + 1,
    fontWeight:    typography.medium,
    color:         colors.mutedLight,
    letterSpacing: 0.3,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: {
    alignItems:      'center',
    paddingVertical: spacing.xxl * 2,
    gap:             spacing.lg,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    fontSize:   typography.base,
    color:      colors.muted,
    textAlign:  'center',
    lineHeight: typography.base * 1.7,
  },
  newProgramBtn: {
    backgroundColor:   colors.accent,
    borderRadius:      radius.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical:   spacing.lg,
    marginTop:         spacing.sm,
  },
  newProgramBtnText: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         colors.bg,
    letterSpacing: 1,
  },

  // ── Modals ────────────────────────────────────────────────────────────────────
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  bottomSheet: {
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth:       borders.thin,
    borderTopColor:       colors.border,
    padding:              spacing.xl,
    paddingBottom:        spacing.xxl,
    gap:                  spacing.sm,
  },
  sheetTitle: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         colors.text,
    letterSpacing: 0.5,
    marginBottom:  spacing.xs,
  },
  archiveDesc: {
    fontSize:     typography.sm,
    color:        colors.muted,
    lineHeight:   typography.sm * 1.6,
    marginBottom: spacing.xs,
  },
  archiveOption: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.sm,
    padding:         spacing.md,
  },
  archiveOptionDanger: {
    borderColor:     'rgba(248,113,113,0.3)',
    backgroundColor: 'rgba(248,113,113,0.05)',
  },
  archiveOptionLabel: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  archiveOptionDesc: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 3,
  },
  cancelBtn: {
    paddingVertical: spacing.md,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    alignItems:      'center',
    marginTop:       spacing.xs,
  },
  cancelBtnText: {
    fontSize:   typography.base,
    color:      colors.muted,
    fontWeight: typography.medium,
  },

  // ── Conexiones (Drive + Entrenador) ──────────────────────────────────────────
  statusCards: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  statusCard: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    backgroundColor:   colors.surface,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.md,
    paddingVertical:   spacing.sm + 2,
    paddingHorizontal: spacing.md - 2,
  },
  statusCardWarn: {
    backgroundColor: withOpacity(colors.orange, 0.06),
    borderColor:     withOpacity(colors.orange, 0.4),
  },
  statusInfo: {
    flex:     1,
    minWidth: 0,
  },
  statusTitle: {
    fontSize:   12,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  statusSub: {
    fontSize:  11,
    color:     colors.mutedLight,
    marginTop: 1,
  },

  // Stage picker
  stageList: {
    gap: spacing.sm,
  },
  stageOption: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.sm,
    padding:         spacing.md,
  },
  stageOptionActive: {
    backgroundColor: withOpacity(colors.accent, 0.06),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  stageOptionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   3,
  },
  stageOptionName: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  stageOptionNameActive: {
    color: colors.accent,
  },
  stageActiveLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 1,
  },
  stageOptionDesc: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
});
