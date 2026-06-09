import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, StyleSheet, Alert,
} from 'react-native';
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

function lastTimeText(status, lastSession, t) {
  if (status === 'active') return t('home.sessionActiveNow');
  const rel = relativeTime(lastSession?.timestamp, t);
  return rel ? t('home.lastTime', { time: rel }) : t('home.firstTime');
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
    // ── With stages: stage card (left) + week card (right) ──
    return (
      <View style={styles.progressHeader}>

        {/* Stage card */}
        <View style={[styles.phCard, styles.phStage]}>
          <View style={styles.phStageRow1}>
            <Text style={styles.phStageLabel}>{stageInfo.stageLabel}</Text>
            <TouchableOpacity
              onPress={onChangeStage}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 4 }}
            >
              <Text style={styles.phStageMenu}>···</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.phStageName} numberOfLines={1}>
            {stageInfo.stageName}
          </Text>
          <Text style={styles.phStageWeek}>
            {t('home.weekProgress', { current: stageInfo.weekInStage, total: stageInfo.totalWeeks })}
          </Text>
          <View style={styles.phBar}>
            <View
              style={[styles.phBarFill, { width: `${Math.round(stageInfo.progressRatio * 100)}%` }]}
            />
          </View>
        </View>

        {/* Week card */}
        <View style={[styles.phCard, styles.phWeekSq]}>
          <Text style={styles.phWkTop}>{t('home.week')}</Text>
          <Text style={styles.phWkNum}>{weekLabel}</Text>
          <View style={styles.phWeekBottom}>
            <Text style={styles.phWkSes}>{t('home.sessions')}</Text>
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

// ── SessionCard ────────────────────────────────────────────────────────────────

function SessionCard({ template, lastSession, allExercises, status, onPress, language }) {
  const { t }  = useTranslation();
  const accent = resolveColor(template?.color ?? 'var(--day1)');

  // First 2 exercise names
  const exerciseNames = (template?.exercises ?? [])
    .slice(0, 2)
    .map(({ exerciseId }) => {
      const ex = allExercises[exerciseId];
      if (!ex) return null;
      return language === 'en' ? (ex.nameEn ?? ex.name) : ex.name;
    })
    .filter(Boolean)
    .join(' · ');

  // Status text
  const statusText = {
    active:  { label: t('home.sessionActive'),  color: colors.accent },
    next:    { label: t('home.sessionNext'),     color: colors.accent },
    done:    { label: t('home.sessionDone'),     color: colors.green  },
    pending: { label: t('home.sessionPending'),  color: colors.muted  },
  }[status];

  // Button config
  const btn = {
    active:  { label: t('home.btnContinue'), style: styles.btnPrimary, textStyle: styles.btnPrimaryText },
    next:    { label: t('home.btnStart'),    style: styles.btnPrimary, textStyle: styles.btnPrimaryText },
    done:    { label: t('home.btnRepeat'),   style: styles.btnRepeat,  textStyle: styles.btnRepeatText  },
    pending: { label: t('home.btnDo'),       style: styles.btnOther,   textStyle: styles.btnOtherText   },
  }[status];

  const timeText = lastTimeText(status, lastSession, t);
  const timeStyle = status === 'active' ? styles.sesLastActive : styles.sesLast;

  return (
    <TouchableOpacity
      style={[styles.sesCard, { borderLeftColor: accent }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Left info block */}
      <View style={styles.sesInfo}>

        {/* SESIÓN A — colored, bigger */}
        <Text style={[styles.sesTag, { color: accent }]}>
          {t('workout.sessionLabel', { label: template?.label ?? '' })}
        </Text>

        {/* Session name */}
        <Text style={styles.sesName} numberOfLines={1}>
          {template?.name ?? ''}
        </Text>

        {/* Status text */}
        <Text style={[styles.sesStatus, { color: statusText.color }]}>
          {statusText.label}
        </Text>

        {/* Exercises */}
        {exerciseNames ? (
          <Text style={styles.sesEx} numberOfLines={1}>{exerciseNames}</Text>
        ) : null}

        {/* Last time */}
        <Text style={timeStyle}>{timeText}</Text>

      </View>

      {/* CTA button */}
      <View style={styles.sesCta}>
        <View style={btn.style}>
          <Text style={btn.textStyle}>{btn.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── ArchiveModal ───────────────────────────────────────────────────────────────

function ArchiveModal({ programName, onConfirm, onClose }) {
  const { t } = useTranslation();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.bottomSheet}>
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
  const currentIdx = program.currentStageIndex ?? 0;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.bottomSheet}>
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

function ProgramBtn({ label, onPress, accent, danger }) {
  return (
    <TouchableOpacity
      style={[
        styles.programBtn,
        accent && styles.programBtnAccent,
        danger && styles.programBtnDanger,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.programBtnText,
        accent && styles.programBtnTextAccent,
        danger && styles.programBtnTextDanger,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
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
  const sessionTemplates     = useStore((s) => s.sessionTemplates);   // reactivity
  const userPrograms         = useStore((s) => s.userPrograms);        // reactivity
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

  // ── Status dots ──────────────────────────────────────────────────────────────
  const driveDotColor = !driveBackup.enabled
    ? colors.muted
    : driveBackup.needsReconnect
      ? colors.orange
      : colors.green;

  const trainerDotColor = !clientSync.slotId
    ? colors.muted
    : (clientSync.pendingUpload || clientSync.syncErrorAt)
      ? colors.orange
      : colors.green;

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
              {/* Program name + trainer credit + drive icon */}
              <View style={styles.progHeader}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.progLabel} numberOfLines={1}>{activeProgram.name}</Text>
                  {programTrainerName ? (
                    <Text style={styles.progTrainer}>{t('workout.trainerCredit', { name: programTrainerName })}</Text>
                  ) : null}
                </View>
                {driveBackup?.enabled && (
                  <TouchableOpacity onPress={() => navigation.navigate('DriveBackup')} hitSlop={10}>
                    <Text style={[styles.progDriveIcon, driveBackup.needsReconnect && { color: colors.orange }]}>
                      {driveBackup.needsReconnect ? '⚠ ☁' : '☁'}
                    </Text>
                  </TouchableOpacity>
                )}
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

              {/* Session cards */}
              <View style={styles.sesList}>
                {currentDays.map(({ sessionTemplateId }, dayIndex) => {
                  const tpl    = getEffectiveTemplate(sessionTemplateId);
                  if (!tpl) return null;
                  const last   = getLastSession(sessionTemplateId);
                  const status = getSessionStatus(
                    dayIndex,
                    doneInCycle,
                    activeSession?.templateId,
                    sessionTemplateId,
                  );
                  return (
                    <SessionCard
                      key={sessionTemplateId}
                      template={tpl}
                      lastSession={last}
                      allExercises={allExercises}
                      status={status}
                      language={i18n.language}
                      onPress={
                        status === 'active'
                          ? () => navigation.navigate('Workout')
                          : () => startSession(sessionTemplateId)
                      }
                    />
                  );
                })}
              </View>

              {/* Sesión libre */}
              <TouchableOpacity
                style={styles.freeSessionBtn}
                onPress={
                  activeSession.templateId === '__free__'
                    ? () => navigation.navigate('Workout')
                    : startFreeSession
                }
                activeOpacity={0.75}
              >
                <Text style={styles.freeSessionBtnText}>
                  {activeSession.templateId === '__free__'
                    ? t('freeSession.btnContinue')
                    : t('freeSession.btn')}
                </Text>
              </TouchableOpacity>

              {/* Program actions */}
              <View style={styles.programActions}>
                <ProgramBtn label={t('home.view')}    onPress={() => navigate('programPrint')}  />
                <ProgramBtn label={t('home.edit')}    onPress={() => navigate('programEditor')} />
                <ProgramBtn label={t('home.archive')} onPress={() => setArchiveOpen(true)}      danger />
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

        {/* ── Botones de estado ── */}
        <View style={styles.statusButtons}>
          <TouchableOpacity
            style={styles.statusBtn}
            onPress={() => navigation.navigate('DriveBackup')}
            activeOpacity={0.75}
          >
            <View style={[styles.statusBtnDot, { backgroundColor: driveDotColor }]} />
            <Text style={styles.statusBtnText}>Google Drive</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statusBtn}
            onPress={() => navigation.navigate('TrainerConnection')}
            activeOpacity={0.75}
          >
            <View style={[styles.statusBtnDot, { backgroundColor: trainerDotColor }]} />
            <Text style={styles.statusBtnText}>
              {clientSync.trainerName ? clientSync.trainerName : 'Entrenador'}
            </Text>
          </TouchableOpacity>
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
    fontSize:     10,
    fontWeight:   typography.regular,
    color:        colors.muted,
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
    fontSize:  9,
    fontWeight: typography.regular,
    color:     colors.muted,
    textAlign: 'center',
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
  sesCard: {
    backgroundColor:  colors.surface,
    borderWidth:      borders.thin,
    borderColor:      colors.borderCard,
    borderLeftWidth:  3,
    borderRadius:     radius.md,
    padding:          spacing.md - 2,
    paddingLeft:      spacing.md,
    paddingRight:     spacing.sm + 3,
    flexDirection:    'row',
    gap:              spacing.sm + 2,
    alignItems:       'stretch',
  },
  sesInfo: {
    flex:     1,
    minWidth: 0,
    gap:      2,
  },
  sesTag: {
    fontSize:      11,
    fontWeight:    typography.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  7,
  },
  sesName: {
    fontSize:   15,
    fontWeight: typography.heavy,
    color:      colors.text,
    lineHeight: 15 * 1.1,
  },
  cloudIcon: {
    fontSize:   12,
    color:      colors.green,
    lineHeight: typography.xl * 1.2,
    opacity:    0.75,
  },
  trainerCredit: {
    fontSize:   typography.xs,
    color:      colors.muted,
    fontStyle:  'italic',
  },
  sesStatus: {
    fontSize:   10,
    fontWeight: typography.medium,
    marginTop:  1,
  },
  sesEx: {
    fontSize:  10,
    color:     '#555555',
    marginTop: 1,
  },
  sesLast: {
    fontSize:  9,
    color:     '#484848',
    marginTop: 1,
  },
  sesLastActive: {
    fontSize:  9,
    color:     withOpacity(colors.accent, 0.5),
    marginTop: 1,
  },
  sesCta: {
    alignItems:    'center',
    justifyContent: 'center',
    flexShrink:    0,
  },

  // Buttons
  btnPrimary: {
    backgroundColor:   colors.accent,
    borderRadius:      radius.sm,
    paddingHorizontal: 11,
    paddingVertical:   8,
  },
  btnPrimaryText: {
    fontSize:   10.5,
    fontWeight: typography.bold,
    color:      colors.onAccent,
  },
  btnRepeat: {
    borderWidth:       1.5,
    borderColor:       '#383838',
    borderRadius:      radius.sm,
    paddingHorizontal: 10,
    paddingVertical:   7,
  },
  btnRepeatText: {
    fontSize:   10.5,
    fontWeight: typography.semibold,
    color:      '#c0c0c0',
  },
  btnOther: {
    borderWidth:       1.5,
    borderColor:       '#2e2e2e',
    borderRadius:      radius.sm,
    paddingHorizontal: 10,
    paddingVertical:   7,
  },
  btnOtherText: {
    fontSize:   10.5,
    fontWeight: typography.semibold,
    color:      '#888888',
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
    paddingVertical: spacing.sm,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    alignItems:      'center',
    backgroundColor: colors.surface,
  },
  programBtnAccent: {
    backgroundColor: withOpacity(colors.accent, 0.07),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  programBtnDanger: {
    backgroundColor: 'rgba(248,113,113,0.07)',
    borderColor:     'rgba(248,113,113,0.3)',
  },
  programBtnText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.muted,
  },
  programBtnTextAccent: { color: colors.accent },
  programBtnTextDanger: { color: colors.red },

  // ── Sesión libre ──────────────────────────────────────────────────────────────
  freeSessionBtn: {
    paddingVertical:   spacing.sm + 2,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       withOpacity(colors.accent, 0.25),
    backgroundColor:   withOpacity(colors.accent, 0.05),
    alignItems:        'center',
  },
  freeSessionBtnText: {
    fontSize:      typography.sm,
    fontWeight:    typography.medium,
    color:         colors.accent,
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

  // ── Botones de estado (Drive + Entrenador) ───────────────────────────────────
  statusButtons: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  statusBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface,
  },
  statusBtnDot: {
    width:        7,
    height:       7,
    borderRadius: 4,
    flexShrink:   0,
  },
  statusBtnText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.muted,
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
