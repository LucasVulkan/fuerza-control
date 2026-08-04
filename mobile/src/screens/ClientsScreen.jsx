/**
 * ClientsScreen — PRO feature. Port of web ClientsView.jsx.
 *
 * Views (managed with useState, no nested navigator):
 *   'list'    → client list + search + status filter
 *   'detail'  → single client (4 tabs: programs, history, progress, info)
 *   'billing' → global billing summary
 */

import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, StyleSheet, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import * as Clipboard from 'expo-clipboard';
import Svg, { Path, Circle } from 'react-native-svg';
import Reanimated, { LinearTransition, FadeOutUp } from 'react-native-reanimated';
import { useStore } from '../../store/useStore';
import { useWeightUnit } from '../hooks/useWeightUnit';
import AppHeader from '../components/AppHeader';
import PaywallModal from '../components/PaywallModal';
import TrainerSyncModal from '../components/TrainerSyncModal';
import DragSheet from '../components/DragSheet';
import SegmentedControl from '../components/ui/SegmentedControl';
import ProgressPanel from '../components/stats/ProgressPanel';
import SessionCard from '../components/SessionCard';
import { spacing, typography, textStyles, borders, withOpacity, sheetRowBase } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { summarizeSets } from '../../../src/utils/progression';
import { volumeDeltas } from '../../../src/utils/sessionRecap';
import { computeAdherence, requiresAttention, adherencePct, STATUS } from '../../../src/utils/adherence';
import { progressFromBlob, clientStageIndex } from '../../../src/utils/stageProgress';
import { sessionLoads, dailySeries } from '../../../src/utils/trainingLoad';
import { sessionStats } from '../utils/sessionStats';
import { LockIcon, CheckIcon, ChevronDown } from '../components/ui/EditorIcons';
import StageSegBar from '../components/ui/StageSegBar';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getAllProgramDays(p) {
  if (p?.stages?.length > 0) return p.stages.flatMap((st) => st.days ?? []);
  return p?.days ?? [];
}

/** Expected sessions per week = days in the program's CURRENT cycle (active stage). */
function weeklyTarget(program) {
  if (!program) return 0;
  const hasStages = (program.stages?.length ?? 0) > 0;
  const stageIdx  = program.currentStageIndex ?? 0;
  const days = hasStages ? (program.stages[stageIdx]?.days ?? []) : (program.days ?? []);
  return days.length;
}

/** Adherence procedural status → theme color. */
function adherenceColor(th, status) {
  if (status === STATUS.AT_RISK)  return th.colors.red;
  if (status === STATUS.SLIPPING) return th.colors.orange;
  if (status === STATUS.ON_TRACK) return th.colors.green;
  return th.colors.muted; // no_data / muted
}

function parseImportFile(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.version) return { ok: false, error: 'El archivo no tiene campo "version".' };
    if (!['1', '2'].includes(String(parsed.version))) return { ok: false, error: `Versión ${parsed.version} no compatible.` };
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
}

// ── Shared small components ────────────────────────────────────────────────────

// ── Inline SVG icon helper ─────────────────────────────────────────────────────

function HeaderIcon({ d, size = 14, active = false }) {
  const th = useTheme();
  const stroke = active ? th.colors.accent : th.colors.muted;
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

// ── Filter chip ────────────────────────────────────────────────────────────────

function FilterChip({ label, active, onPress, count }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive, { flex: 1, textAlign: 'center' }]}>
        {label}
      </Text>
      {count != null && (
        <View style={[styles.chipCountBadge, active && styles.chipCountBadgeActive]}>
          <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function AccentBtn({ label, onPress, small, disabled }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.accentBtn, small && styles.accentBtnSmall, disabled && { opacity: 0.4 }]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.accentBtnText, small && styles.accentBtnTextSmall]}>{label}</Text>
    </TouchableOpacity>
  );
}

function GhostBtn({ label, onPress, danger }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.ghostBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.ghostBtnText, danger && { color: th.colors.red }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Status dot ─────────────────────────────────────────────────────────────────

// ── Accordion (for Info tab sections) ─────────────────────────────────────────

function Accordion({ label, open, onToggle, children }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.accordion}>
      <TouchableOpacity style={styles.accordionHeader} onPress={onToggle} activeOpacity={0.7}>
        <Text style={styles.accordionLabel}>{label}</Text>
        <Text style={[styles.accordionArrow, open && { transform: [{ rotate: '180deg' }] }]}>▾</Text>
      </TouchableOpacity>
      {open && <View style={styles.accordionBody}>{children}</View>}
    </View>
  );
}

// ── Exercise mini-card (progress tab) ─────────────────────────────────────────

function ExerciseMiniCard({ exerciseId, logs }) {
  const styles = useThemedStyles(makeStyles);
  const { i18n } = useTranslation();
  const { fmt: fmtW, toDisplay: wDisplay } = useWeightUnit();

  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const allExercises = { ...exerciseLibrary, ...customExercises };
  const def = allExercises[exerciseId];

  const name = def
    ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
    : exerciseId;

  // Compute best set summary for each log
  const entries = useMemo(() => {
    return [...logs].reverse().map(({ timestamp, exercise }) => {
      const done = exercise?.sets?.filter((s) => s.done || s.weight || s.reps || s.time) ?? [];
      const summary = summarizeSets(def, done, fmtW);
      const date = new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      return { date, summary };
    });
  }, [logs, def, fmtW]);

  const [open, setOpen] = useState(false);

  return (
    <View style={styles.exMiniCard}>
      <TouchableOpacity style={styles.exMiniHeader} onPress={() => setOpen((v) => !v)} activeOpacity={0.75}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exMiniName}>{name}</Text>
          {entries[0]?.summary ? <Text style={styles.exMiniLast}>{entries[0].summary}</Text> : null}
        </View>
        <Text style={styles.exMiniArrow}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.exMiniBody}>
          {entries.map((e, i) => (
            <View key={i} style={styles.exMiniRow}>
              <Text style={styles.exMiniDate}>{e.date}</Text>
              <Text style={styles.exMiniVal}>{e.summary ?? '—'}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Client import modal ────────────────────────────────────────────────────────

function ClientImportModal({ fileName, parsedData, onImport, onClose }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.importModalWrap}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>IMPORTAR PROGRAMA</Text>
          <Text style={styles.modalSub} numberOfLines={1}>{fileName}</Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {[
              { mode: 'replace',     label: t('clients.importModal.replaceLabel'),     desc: t('clients.importModal.replaceDesc') },
              { mode: 'replace_log', label: t('clients.importModal.replaceLogLabel'),  desc: t('clients.importModal.replaceLogDesc') },
              { mode: 'merge_log',   label: t('clients.importModal.mergeLogLabel'),    desc: t('clients.importModal.mergeLogDesc') },
            ].map(({ mode, label, desc }) => (
              <TouchableOpacity
                key={mode}
                style={styles.importOption}
                onPress={() => onImport(parsedData, mode)}
                activeOpacity={0.75}
              >
                <Text style={styles.importOptionLabel}>{label}</Text>
                <Text style={styles.importOptionDesc}>{desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <GhostBtn label="Cancelar" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

// ── Small icons for program rows ───────────────────────────────────────────────

function EyeIcon({ size = 18, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}
function DownloadIcon({ size = 18, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12M8 11l4 4 4-4M5 21h14" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
// Flecha de "enviar" de los CTA de la tarjeta de cliente. Va con el trazo del
// texto que acompaña (card-type es ExtraBold): la "↑" tipográfica se veía
// canija al lado de la etiqueta.
function UploadIcon({ size = 12, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20V5M5 12l7-7 7 7" stroke={color} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Track de la barra de etapas, sin token propio (mismo caso que el #b8ff00 y el
// #81a71e del banner de Home): `surface2` no se veía y `mutedLight` competía con
// el relleno. Es el punto medio exacto entre los dos.
const STAGE_TRACK = '#545454';

// Una caja de dato mide ~86px en un móvil estrecho: el texto se encoge antes de
// truncarse. Mismo recurso que las Progress cards.
const FIT = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.7 };

// ── Tarjeta de programa asignado (tab de Programa) ──────────────────────────────
// Pinta el bloque entero del tab: los avisos que te paran, la tarjeta de dos
// colores (nombre + ciclo · barra de etapa · adherencia/ritmo/carga), la fila de
// acciones con el "⋯" que guarda todo lo demás, y la sección de próxima sesión.

function AssignedProgramCard({
  program, getEffectiveTemplate, allExercises, adherence, adherence4w, loadPct,
  dirty, progress, archivedCount,
  onView, onEdit, onUpload, onPrescribe, onShare, onExport, onImport, onNewProgram,
  onDeassign, onDelete, onUnlock, onPlanStages, onShowArchived,
}) {
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isEs = i18n.language?.startsWith('es');
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Mesocycle position ──
  // Mirrored from the client's last upload, never recomputed here: the trainer's
  // own copy of the program has counters that only its owner's device moves, and
  // re-deriving from the log would drift the moment the client deletes an entry
  // (spec §3.1). Falls back to the local copy for clients who never sync.
  const mine         = progressFromBlob(progress, program.id);
  const stages       = program.stages ?? [];
  const hasStages    = stages.length > 0;
  const stageIdx     = clientStageIndex({ progress }, program);
  const currentStage = hasStages ? stages[stageIdx] : null;
  const currentDays  = hasStages ? (currentStage?.days ?? []) : (program.days ?? []);
  const sessPerCycle = Math.max(1, currentDays.length);
  const weeksDone    = mine?.stageWeeksCompleted ?? program.stageWeeksCompleted ?? 0;

  // ── Next session in the rotation ── first one NOT done this cycle. By
  // template, not by position: an index breaks as soon as the client trains out
  // of rotation order.
  const doneIds     = new Set(mine?.cycleCompletedIds ?? program.cycleCompletedIds ?? []);
  const doneInCycle = currentDays.filter((d) => doneIds.has(d.sessionTemplateId)).length;
  const nextDayIdx  = currentDays.findIndex((d) => !doneIds.has(d.sessionTemplateId));
  const nextDay     = currentDays[nextDayIdx >= 0 ? nextDayIdx : 0];
  const nextTpl     = nextDay ? getEffectiveTemplate(nextDay.sessionTemplateId) : null;
  const nextLabel   = nextTpl?.label ?? String.fromCharCode(65 + Math.max(0, nextDayIdx));
  const nextName    = nextTpl?.name ?? '';
  const nextStats   = nextTpl ? sessionStats(nextTpl, allExercises) : null;

  // "Ciclo NN" = vueltas COMPLETAS al ciclo + 1 — el mismo contador que el
  // banner de Home y la tarjeta del listado, espejado del blob del cliente.
  const cycleNum = (mine?.totalWeeksCompleted ?? program.totalWeeksCompleted ?? 0) + 1;

  // ── Stage progress bar (multi-stage with a defined length) ──
  const stageWeeks    = currentStage?.durationWeeks ?? null;
  const weekInStage   = stageWeeks ? Math.min(stageWeeks, weeksDone + 1) : null;
  // Con una sola etapa no hay nada que situar: la barra mediría el programa
  // entero contra sí mismo. Sin techo de ciclos tampoco hay tira que dibujar.
  const showStageBar  = stages.length > 1 && stageWeeks != null;

  // ── Did they finish the stage, and can they move on? ──
  // `isStageLocked` is no use here: it answers for the device it runs on, and
  // the trainer has no slot. The question is about the client, so it's the raw
  // flag on the stage that follows theirs.
  const nextStage    = stages[stageIdx + 1] ?? null;
  const stageEnded   = stageWeeks != null && weeksDone >= stageWeeks;
  const stageDone    = stageEnded && !!nextStage;
  const nextLocked   = stageDone && !!nextStage.locked;
  // Terminó la ÚLTIMA etapa: repetirá el bloque para siempre y en silencio, que
  // es lo que hace falta para dejar de planificar todo por adelantado
  // (`client-triage.md` §2). Mismo aviso que la etapa bloqueada — también está
  // parado esperándote, solo que aquí el trabajo pendiente es montar el bloque.
  const blockDone    = stageEnded && !nextStage;

  // ── Real pace ──
  const paceRaw     = adherence?.recentPerWeek ?? 0;
  const paceHasData = adherence != null && adherence.status !== STATUS.NO_DATA && paceRaw > 0;
  const paceRounded = Math.round(paceRaw * 2) / 2;
  const paceRateStr = Number.isInteger(paceRounded)
    ? String(paceRounded)
    : paceRounded.toFixed(1).replace('.', isEs ? ',' : '.');
  // La adherencia es el único de los 3 datos que emite un veredicto, así que es
  // el único que se colorea cuando pide atención.
  const attnColor = adherence && requiresAttention(adherence.status)
    ? adherenceColor(th, adherence.status)
    : null;

  const menu = (fn) => () => { setMenuOpen(false); fn(); };

  return (
    <>
      {/* ── Avisos ── van ENCIMA de la tarjeta: son lo que te para al abrir la
          ficha, y la tarjeta de programa se queda siempre con la misma forma
          (cabecera · barra · 3 datos) tenga o no aviso. */}
      {dirty && onUpload && (
        <View style={styles.lockBox}>
          <View style={styles.lockHeader}>
            <UploadIcon size={13} color={th.colors.orange} />
            <Text style={styles.lockTag}>{t('clients.changesPendingTag')}</Text>
          </View>
          <Text style={styles.lockText}>{t('clients.changesPendingText')}</Text>
          <TouchableOpacity style={styles.lockBtn} onPress={onUpload} activeOpacity={0.85}>
            <Text style={styles.lockBtnText}>{t('clients.menuUpload')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Etapa bloqueada: el cliente está parado esperándote. */}
      {nextLocked && (
        <View style={styles.lockBox}>
          <View style={styles.lockHeader}>
            <LockIcon size={13} color={th.colors.orange} />
            <Text style={styles.lockTag}>{t('clients.stageLockedTag')}</Text>
          </View>
          <Text style={styles.lockText}>
            {t('clients.stageLockedText', {
              current: currentStage?.name ?? '',
              next:    nextStage.name,
            })}
          </Text>
          <TouchableOpacity style={styles.lockBtn} onPress={() => onUnlock(stageIdx + 1)} activeOpacity={0.85}>
            <Text style={styles.lockBtnText}>{t('clients.stageUnlockBtn')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bloque terminado y sin siguiente: avisar sin dar el siguiente paso
          deja el trabajo a medias, así que el botón va al planificador. */}
      {blockDone && (
        <View style={styles.lockBox}>
          <View style={styles.lockHeader}>
            <CheckIcon size={13} color={th.colors.orange} />
            <Text style={styles.lockTag}>{t('clients.blockDoneTag')}</Text>
          </View>
          <Text style={styles.lockText}>
            {t('clients.blockDoneText', { current: currentStage?.name ?? '' })}
          </Text>
          <TouchableOpacity style={styles.lockBtn} onPress={onPlanStages} activeOpacity={0.85}>
            <Text style={styles.lockBtnText}>{t('clients.blockDoneBtn')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Tarjeta de programa asignado ──
          Dos colores como la tarjeta de ejercicio del workout: cabecera en
          surface2, cuerpo en surface. */}
      <View style={styles.apCard}>

        <View style={styles.apHead}>
          <View style={styles.apHeadName}>
            <Text style={styles.apEyebrow}>{t('clients.assignedProgram')}</Text>
            <Text style={styles.apName} numberOfLines={1}>{program.name}</Text>
          </View>
          <View style={styles.apHeadCycle}>
            <Text style={styles.apEyebrowRight}>{t('home.cycle')}</Text>
            <Text style={styles.apCycleNum}>{String(cycleNum).padStart(2, '0')}</Text>
          </View>
        </View>

        <View style={styles.apBody}>
          {showStageBar && (
            <View style={styles.apStage}>
              <View style={styles.apStageRow}>
                <Text style={styles.apStageName} numberOfLines={1}>
                  {t('home.stageDefault', { n: stageIdx + 1 })}
                  {currentStage?.name
                    ? <Text style={styles.apStageOwnName}>{` · ${currentStage.name}`}</Text>
                    : null}
                </Text>
                <Text style={styles.apStageMeta}>
                  {t('home.cycleProgress', { current: weekInStage, total: stageWeeks })}
                </Text>
              </View>
              {/* Un segmento por ciclo de la etapa: pasados al 100%, el actual a
                  la fracción de sesiones hechas, los futuros vacíos. Misma
                  lectura que los puntos de la cabecera, del mismo dato. */}
              <StageSegBar
                ratios={Array.from({ length: stageWeeks }, (_, i) => (
                  stageEnded ? 1
                    : i < weekInStage - 1 ? 1
                    : i === weekInStage - 1 ? doneInCycle / sessPerCycle
                    : 0
                ))}
                trackColor={STAGE_TRACK}
                fillColor={th.colors.accent}
              />
              {/* Terminó la etapa y no ha avanzado. Puede ser decisión suya o
                  tuya ("hazme un ciclo más"), así que se informa sin alarmar —
                  el naranja se reserva para cuando NO puede avanzar. */}
              {stageDone && !nextLocked && (
                <Text style={styles.apStageMeta}>
                  {t('clients.stageFinishedStaying', { current: currentStage?.name ?? '' })}
                </Text>
              )}
            </View>
          )}

          {/* Las 3 cajas se reparten el ancho a partes iguales, así que en un
              móvil estrecho quedan ~86px de contenido: valor y etiqueta llevan
              `adjustsFontSizeToFit` (mismo recurso que las Progress cards) para
              que ninguna se parta ni se trunque. */}
          <View style={[styles.apStats, !showStageBar && { marginTop: 0 }]}>
            <View style={styles.apStat}>
              <Text style={[styles.apStatVal, attnColor && { color: attnColor }]} {...FIT}>
                {adherence4w != null ? adherence4w : '—'}
                {adherence4w != null && <Text style={styles.apStatUnit}>%</Text>}
              </Text>
              <Text style={styles.apStatKey} {...FIT}>{t('clients.statAdherence')}</Text>
            </View>
            <View style={styles.apStat}>
              <Text style={styles.apStatVal} {...FIT}>
                {paceHasData ? paceRateStr : '—'}
                <Text style={styles.apStatUnit}> {t('clients.cyclesPerWeek')}</Text>
              </Text>
              <Text style={styles.apStatKey} {...FIT}>{t('clients.statPace')}</Text>
            </View>
            <View style={styles.apStat}>
              <Text style={styles.apStatVal} {...FIT}>
                {loadPct != null ? `${loadPct > 0 ? '+' : ''}${loadPct}` : '—'}
                {loadPct != null && <Text style={styles.apStatUnit}>%</Text>}
              </Text>
              <Text style={styles.apStatKey} {...FIT}>{t('clients.statLoad')}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Acciones del programa ── */}
      <View style={styles.apActions}>
        <TouchableOpacity style={[styles.apBtn, { flex: 1 }]} onPress={onEdit} activeOpacity={0.85}>
          <Text style={styles.apBtnText} numberOfLines={1}>{t('clients.editProgram')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.apBtn, { flex: 1 }]} onPress={onView} activeOpacity={0.85}>
          <Text style={styles.apBtnText} numberOfLines={1}>{t('clients.viewProgram')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.apBtn, styles.apBtnIcon]} onPress={() => setMenuOpen(true)} activeOpacity={0.85}>
          <Text style={styles.apBtnIconText}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* ── Próxima sesión — sección propia ── */}
      <Text style={styles.apSectionLabel}>{t('clients.nextSectionLabel').toUpperCase()}</Text>
      <View style={styles.apNext}>
        <Text style={styles.apNextLetter}>{nextLabel}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.apNextName} numberOfLines={1}>{nextName || nextLabel}</Text>
          {nextStats && (
            <Text style={styles.apNextMeta}>
              {t('clients.sessionMeta', { count: nextStats.exercises, minutes: nextStats.minutes })}
            </Text>
          )}
        </View>
        <TouchableOpacity style={[styles.apBtn, styles.apBtnAccent]} onPress={onPrescribe} activeOpacity={0.85}>
          <TargetIcon size={16} color={th.colors.accent} />
          <Text style={[styles.apBtnText, { color: th.colors.accent }]}>{t('clients.prepare')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.apNextHint}>{t('clients.nextSessionHint')}</Text>

      {/* ── ⋯ todo lo demás ── */}
      <DragSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={t('clients.programMenuTitle')}>
        <View style={styles.sheetBody}>
          <SheetRow label={t('clients.menuNewProgram')} onPress={menu(onNewProgram)} />
          {onUpload && <SheetRow label={t('clients.menuUpload')} onPress={menu(onUpload)} />}
          <SheetRow label={t('clients.menuImport')} onPress={menu(onImport)} />
          <SheetRow label={t('clients.menuShare')}  onPress={menu(onShare)} />
          <SheetRow label={t('clients.menuExport')} onPress={menu(onExport)} />
          {archivedCount > 0 && (
            <SheetRow
              label={`${t('clients.menuArchived')} · ${archivedCount}`}
              onPress={menu(onShowArchived)}
            />
          )}
          {onDeassign && <SheetRow label={t('clients.menuDeassign')} onPress={menu(onDeassign)} />}
          <SheetRow label={t('clients.menuDelete')} onPress={menu(onDelete)} danger />
        </View>
      </DragSheet>
    </>
  );
}

// Fila de hoja — mismo patrón que los dos editores: surface2, radius/sm,
// padding space/md, texto card-type y la flecha a la derecha.
function SheetRow({ label, onPress, danger }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.sheetRow} onPress={onPress} activeOpacity={0.75}>
      <Text style={[styles.sheetRowText, danger && { color: th.colors.red }]}>{label}</Text>
      <Text style={[styles.sheetRowArrow, danger && { color: th.colors.red }]}>›</Text>
    </TouchableOpacity>
  );
}

/**
 * ClientCodeBlock — el código de conexión del cliente.
 *
 * Vive en dos sitios: en el tab de Programa mientras el cliente NO se ha
 * conectado (es lo primero que hay que hacer con un cliente recién creado) y
 * siempre en Info, que es su casa definitiva.
 *
 * `onDismiss` solo lo pasa el tab de Programa: si nunca vas a conectar a ese
 * cliente, la tarjeta se queda ahí para siempre sin nada que hacer.
 */
function ClientCodeBlock({ client, showToast, onDismiss }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const connectClientToCloud = useStore((s) => s.connectClientToCloud);
  const [copied, setCopied]         = useState(false);
  const [connecting, setConnecting] = useState(false);

  if (!client.syncSlotId) {
    return (
      <View style={styles.codeCard}>
        <Text style={styles.codeTitle}>{t('clients.codeCard.title')}</Text>
        <Text style={styles.codeExplain}>{t('clients.keyTab.noSlot')}</Text>
        <TouchableOpacity
          style={[styles.apBtn, styles.codeConnectBtn, connecting && { opacity: 0.6 }]}
          disabled={connecting}
          activeOpacity={0.85}
          onPress={async () => {
            setConnecting(true);
            try {
              await connectClientToCloud(client.id);
            } catch (err) {
              Alert.alert('Error', err.message ?? t('clients.keyTab.connectError'));
            } finally {
              setConnecting(false);
            }
          }}
        >
          <Text style={styles.apBtnText}>
            {connecting ? t('clients.keyTab.connecting') : t('clients.keyTab.connect')}
          </Text>
        </TouchableOpacity>
      {onDismiss && (
        <TouchableOpacity style={styles.codeDismiss} onPress={onDismiss} activeOpacity={0.6}>
          <Text style={styles.codeDismissText}>{t('clients.codeCard.dismiss')}</Text>
        </TouchableOpacity>
      )}
      </View>
    );
  }

  if (!client.syncCode) {
    return (
      <View style={styles.codeCard}>
        <Text style={styles.codeTitle}>{t('clients.codeCard.title')}</Text>
        <Text style={styles.codeExplain}>{t('clients.keyTab.connectedNoCode')}</Text>
      {onDismiss && (
        <TouchableOpacity style={styles.codeDismiss} onPress={onDismiss} activeOpacity={0.6}>
          <Text style={styles.codeDismissText}>{t('clients.codeCard.dismiss')}</Text>
        </TouchableOpacity>
      )}
      </View>
    );
  }

  return (
    <View style={styles.codeCard}>
      <Text style={styles.codeTitle}>{t('clients.codeCard.title')}</Text>
      <Text style={styles.codeExplain}>{t('clients.codeCard.explain', { name: client.name })}</Text>
      <View style={styles.codeRow}>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{client.syncCode}</Text>
        </View>
        <TouchableOpacity
          style={styles.codeCopyBtn}
          activeOpacity={0.75}
          onPress={async () => {
            await Clipboard.setStringAsync(client.syncCode);
            setCopied(true);
            showToast(t('clients.keyTab.copied'), 2200, 'neutral');
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          <Svg viewBox="0 0 24 24" width={18} height={18} fill="none"
            stroke={copied ? th.colors.green : th.colors.accent}
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {copied
              ? <Path d="M20 6L9 17l-5-5" />
              : <Path d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.242a2 2 0 00-.602-1.43L16.083 2.57A2 2 0 0014.685 2H10a2 2 0 00-2 2zm0 0H6a2 2 0 00-2 2v12" />
            }
          </Svg>
        </TouchableOpacity>
      </View>
      {onDismiss && (
        <TouchableOpacity style={styles.codeDismiss} onPress={onDismiss} activeOpacity={0.6}>
          <Text style={styles.codeDismissText}>{t('clients.codeCard.dismiss')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Archived (previous) program row — compact ───────────────────────────────────

function ArchivedProgramRow({ program, lastActivity, sessionCount, onView, onExport, onReactivate, onDelete }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t, i18n } = useTranslation();
  const isEs = i18n.language?.startsWith('es');
  const [menuOpen, setMenuOpen] = useState(false);

  const lastStr = lastActivity
    ? new Date(lastActivity).toLocaleDateString(isEs ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const meta = [
    sessionCount > 0 ? t('clients.programSessions', { count: sessionCount }) : t('clients.noSessionsYet'),
    lastStr,
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.archRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.archName} numberOfLines={1}>{program.name}</Text>
        <Text style={styles.archMeta} numberOfLines={1}>{meta}</Text>
      </View>
      <TouchableOpacity onPress={onView} hitSlop={8} style={styles.archIcon} activeOpacity={0.6}>
        <EyeIcon size={17} color={th.colors.muted2} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onExport} hitSlop={8} style={styles.archIcon} activeOpacity={0.6}>
        <DownloadIcon size={17} color={th.colors.muted2} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.archIcon} activeOpacity={0.6}>
        <Text style={styles.archDots}>⋯</Text>
      </TouchableOpacity>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setMenuOpen(false)} />
        <View style={styles.contextMenu}>
          <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setMenuOpen(false); onReactivate(); }}>
            <Text style={[styles.contextMenuText, { color: th.colors.accent }]}>{t('clients.menuReactivate')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setMenuOpen(false); onExport(); }}>
            <Text style={styles.contextMenuText}>{t('clients.menuExport')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setMenuOpen(false); onDelete(); }}>
            <Text style={[styles.contextMenuText, { color: th.colors.red }]}>{t('clients.menuDelete')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ── New program modal ──────────────────────────────────────────────────────────

function NewProgramModal({ templatePrograms, onCreateBlank, onCreateFromTemplate, onClose }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const [tab,              setTab]              = useState(templatePrograms.length > 0 ? 'blank' : 'blank');
  const [name,             setName]             = useState('');
  const [numSessions,      setNumSessions]      = useState(3);
  // null = sin límite de ciclos (la etapa dura hasta que se añada la siguiente)
  const [durationWeeks,    setDurationWeeks]    = useState(4);
  const [fromTemplateId,   setFromTemplateId]   = useState('');
  const [fromTemplateName, setFromTemplateName] = useState('');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>NUEVO PROGRAMA</Text>

          {templatePrograms.length > 0 && (
            <View style={styles.tabRow}>
              {[{ id: 'blank', label: t('clients.newProgramModal.tabBlank') }, { id: 'template', label: t('clients.newProgramModal.tabTemplate') }].map(({ id, label }) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.tabBtn, tab === id && styles.tabBtnActive]}
                  onPress={() => setTab(id)}
                >
                  <Text style={[styles.tabBtnText, tab === id && styles.tabBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {tab === 'blank' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Nombre del programa"
                placeholderTextColor={th.colors.muted}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
              />
              <Text style={styles.fieldLabel}>SESIONES POR SEMANA</Text>
              <View style={styles.numRow}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.numBtn, numSessions === n && styles.numBtnActive]}
                    onPress={() => setNumSessions(n)}
                  >
                    <Text style={[styles.numBtnText, numSessions === n && styles.numBtnTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t('editor.cyclesQuestion').toUpperCase()}</Text>
              <Text style={styles.fieldHint}>{t('editor.cyclesExplain')}</Text>
              <View style={styles.numRow}>
                {[4, 6, 8, 12].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.numBtn, durationWeeks === n && styles.numBtnActive]}
                    onPress={() => setDurationWeeks(n)}
                  >
                    <Text style={[styles.numBtnText, durationWeeks === n && styles.numBtnTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.noLimitRow, durationWeeks === null && styles.noLimitRowActive]}
                onPress={() => setDurationWeeks(durationWeeks === null ? 4 : null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.noLimitText, durationWeeks === null && styles.noLimitTextActive]}>
                  {t('editor.cyclesNoLimit')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {tab === 'template' && (
            <>
              <Text style={styles.fieldLabel}>SELECCIONAR PLANTILLA</Text>
              <ScrollView style={{ maxHeight: 180, marginBottom: spacing.md }} showsVerticalScrollIndicator={false}>
                {templatePrograms.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.templateOption, fromTemplateId === p.id && styles.templateOptionActive]}
                    onPress={() => { setFromTemplateId(p.id); setFromTemplateName(p.name); }}
                  >
                    <Text style={[styles.templateOptionName, fromTemplateId === p.id && { color: th.colors.accent }]}>
                      {p.name}
                    </Text>
                    <Text style={styles.templateOptionMeta}>{p.days?.length ?? 0} sesiones</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={styles.input}
                placeholder={fromTemplateName || t('clients.newProgramModal.namePlaceholderOptional')}
                placeholderTextColor={th.colors.muted}
                value={fromTemplateName}
                onChangeText={setFromTemplateName}
              />
            </>
          )}

          <View style={styles.modalActions}>
            <GhostBtn label="Cancelar" onPress={onClose} />
            {tab === 'blank' ? (
              <AccentBtn label="CREAR" disabled={!name.trim()} onPress={() => name.trim() && onCreateBlank(name, numSessions, durationWeeks)} />
            ) : (
              <AccentBtn label="ASIGNAR" disabled={!fromTemplateId} onPress={() => fromTemplateId && onCreateFromTemplate(fromTemplateId, fromTemplateName)} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Global billing ─────────────────────────────────────────────────────────────

const billLocale = (lang) => (lang === 'en' ? 'en-US' : 'es-ES');

/** Date → 'AAAA-MM-DD' en hora LOCAL (`toISOString()` es UTC y adelanta el día). */
function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** '2026-07-14' → '14 jul' (con año si `withYear` o si no es el año en curso). */
function formatBillDate(iso, lang, withYear = false) {
  const [y, m, d] = (iso ?? '').split('-').map(Number);
  if (!y || !m || !d) return iso ?? '';
  return new Date(y, m - 1, d).toLocaleDateString(billLocale(lang), {
    day: 'numeric', month: 'short',
    ...((withYear || y !== new Date().getFullYear()) && { year: 'numeric' }),
  });
}

/**
 * Calendario de mes para elegir la fecha del cobro. Es propio, no el picker
 * nativo (`@react-native-community/datetimepicker`): en Android ese abre un
 * diálogo Material que no se puede estilar, justo lo que §9 de
 * `docs/UI-MIGRATION.md` prohíbe — y además es módulo nativo, o sea rebuild del
 * dev client. Aquí basta una rejilla y los tokens del tema.
 * Semana Lun→Dom, la misma convención que el selector semanal de Home.
 */
function BillDateSheet({ value, lang, onPick, onClose }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  const [y0, m0] = (value ?? '').split('-').map(Number);
  const [cursor, setCursor] = useState(() => new Date(y0 || new Date().getFullYear(), (m0 || 1) - 1, 1));

  const year   = cursor.getFullYear();
  const month  = cursor.getMonth();
  // getDay(): 0 = domingo. Rotamos para que el lunes sea la primera columna.
  const lead   = (new Date(year, month, 1).getDay() + 6) % 7;
  const days   = new Date(year, month + 1, 0).getDate();
  const today  = toIsoDate(new Date());

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) =>
    // 2024-01-01 fue lunes: sirve de semana de referencia para sacar las
    // iniciales en el idioma activo sin tabla hardcodeada.
    new Date(2024, 0, 1 + i).toLocaleDateString(billLocale(lang), { weekday: 'narrow' })
  ), [lang]);

  const monthLabel = cursor.toLocaleDateString(billLocale(lang), { month: 'long', year: 'numeric' });

  return (
    <DragSheet visible onClose={onClose} title={t('clients.billSheet.date')}>
      <View style={styles.calBody}>
        <View style={styles.calNav}>
          <TouchableOpacity style={styles.calNavBtn} onPress={() => setCursor(new Date(year, month - 1, 1))} activeOpacity={0.7}>
            <Svg viewBox="0 0 24 24" width={16} height={16} fill="none"
              stroke={th.colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18 9 12l6-6" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.calMonth}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</Text>
          <TouchableOpacity style={styles.calNavBtn} onPress={() => setCursor(new Date(year, month + 1, 1))} activeOpacity={0.7}>
            <Svg viewBox="0 0 24 24" width={16} height={16} fill="none"
              stroke={th.colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="m9 18 6-6-6-6" />
            </Svg>
          </TouchableOpacity>
        </View>

        <View style={styles.calGrid}>
          {weekDays.map((w, i) => (
            <View key={`w${i}`} style={styles.calCell}>
              <Text style={styles.calWeekDay}>{w.toUpperCase()}</Text>
            </View>
          ))}
          {Array.from({ length: lead }, (_, i) => <View key={`b${i}`} style={styles.calCell} />)}
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
            const iso     = toIsoDate(new Date(year, month, d));
            const sel     = iso === value;
            const isToday = iso === today;
            return (
              <TouchableOpacity key={d} style={styles.calCell} onPress={() => onPick(iso)} activeOpacity={0.7}>
                <View style={[styles.calDay, sel && styles.calDaySel, !sel && isToday && styles.calDayToday]}>
                  <Text style={[styles.calDayText, sel && styles.calDayTextSel]}>{d}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </DragSheet>
  );
}

/**
 * Hoja de alta de cobro. Antes era un `<Modal>` propio; pasa a `DragSheet`, que es
 * el único bottom-sheet de la app (§9 de docs/UI-MIGRATION.md). La salida vive en
 * el hueco derecho de la cabecera y abajo queda un solo botón, el que avanza.
 */
function GlobalAddBillingSheet({ clients, lang, onClose }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const addClientBilling = useStore((s) => s.addClientBilling);
  const showToast        = useStore((s) => s.showToast);

  const clientList = useMemo(
    () => Object.values(clients ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  const [clientId,  setClientId]  = useState('');
  const [date,      setDate]      = useState(() => toIsoDate(new Date()));
  const [concept,   setConcept]   = useState('');
  const [amount,    setAmount]    = useState('');
  const [status,    setStatus]    = useState('pending');
  const [dropOpen,     setDropOpen]     = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showCal,      setShowCal]      = useState(false);

  const selectedClient = clientList.find((c) => c.id === clientId);
  const matches = clientSearch.trim()
    ? clientList.filter((c) => c.name.toLowerCase().includes(clientSearch.trim().toLowerCase()))
    : clientList;

  const canAdd = clientId && concept.trim() && amount && date;

  function handleAdd() {
    if (!canAdd) return;
    addClientBilling(clientId, {
      date, concept: concept.trim(), amount: parseFloat(amount), status,
    });
    showToast(t('clients.billSheet.added'), 2200, 'success');
    onClose();
  }

  return (
    <>
    <DragSheet
      visible
      onClose={onClose}
      title={t('clients.billSheet.title')}
      action={{ label: t('common.cancel'), onPress: onClose }}
    >
      <View style={styles.billSheetBody}>

        {/* Cliente — dropdown con buscador, mismo patrón que el desplegable de
            ejercicios de Progress: ancla relativa + menú `position:absolute`
            colgando de `top:'100%'`, que FLOTA sobre los campos de abajo. */}
        <View style={styles.billDropField}>
          <Text style={styles.billSecLabel}>{t('clients.billSheet.client')}</Text>
          {clientList.length === 0 ? (
            <Text style={styles.billEmpty}>{t('clients.billSheet.noClients')}</Text>
          ) : (
            <View style={styles.billDropAnchor}>
              <TouchableOpacity
                style={[styles.billSelect, dropOpen && styles.billSelectOpen]}
                onPress={() => setDropOpen((o) => !o)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.billSelectText, !selectedClient && { color: th.colors.mutedLight }]}
                  numberOfLines={1}
                >
                  {selectedClient?.name ?? t('clients.billSheet.clientPlaceholder')}
                </Text>
                <ChevronDown size={12} color={th.colors.mutedLight} />
              </TouchableOpacity>

              {dropOpen && (
                <View style={styles.billDropList}>
                  <View style={styles.billDropSearch}>
                    <Svg viewBox="0 0 24 24" width={15} height={15} fill="none"
                      stroke={th.colors.mutedLight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35" />
                    </Svg>
                    <TextInput
                      style={styles.billDropSearchInput}
                      placeholder={t('clients.billSheet.searchClient')}
                      placeholderTextColor={th.colors.mutedLight}
                      value={clientSearch}
                      onChangeText={setClientSearch}
                      returnKeyType="search"
                    />
                  </View>
                  <ScrollView
                    style={{ maxHeight: 200 }}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {matches.length === 0 ? (
                      <Text style={styles.billDropEmpty}>{t('clients.billSheet.noMatches')}</Text>
                    ) : matches.map((c) => {
                      const sel = c.id === clientId;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.billDropItem, sel && styles.billDropItemSel]}
                          onPress={() => { setClientId(c.id); setDropOpen(false); setClientSearch(''); }}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.billDropItemText, sel && { color: th.colors.text }]} numberOfLines={1}>
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.billFieldRow}>
          {/* Fecha — fila + hoja, el mismo patrón que Progresión/Tempo en el
              editor de ejercicio. Abre el calendario, no un teclado. */}
          <View style={{ flex: 1 }}>
            <Text style={styles.billSecLabel}>{t('clients.billSheet.date')}</Text>
            <TouchableOpacity style={styles.billSelect} onPress={() => setShowCal(true)} activeOpacity={0.8}>
              <Text style={styles.billSelectText} numberOfLines={1}>{formatBillDate(date, lang, true)}</Text>
              <Svg viewBox="0 0 24 24" width={15} height={15} fill="none"
                stroke={th.colors.mutedLight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
              </Svg>
            </TouchableOpacity>
          </View>
          <View style={{ width: 120 }}>
            <Text style={styles.billSecLabel}>{t('clients.billSheet.amount')}</Text>
            <TextInput
              style={styles.billInput}
              placeholder="0,00 €"
              placeholderTextColor={th.colors.mutedLight}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              returnKeyType="next"
            />
          </View>
        </View>

        <View>
          <Text style={styles.billSecLabel}>{t('clients.billSheet.concept')}</Text>
          <TextInput
            style={styles.billInput}
            placeholder={t('clients.billConceptPlaceholder')}
            placeholderTextColor={th.colors.mutedLight}
            value={concept}
            onChangeText={setConcept}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
        </View>

        <View>
          <Text style={styles.billSecLabel}>{t('clients.billSheet.status')}</Text>
          <SegmentedControl
            options={[
              { id: 'pending', label: t('clients.billPending') },
              { id: 'paid',    label: t('clients.statusPaid')  },
            ]}
            value={status}
            onChange={setStatus}
          />
        </View>

        <TouchableOpacity
          style={[styles.billCta, !canAdd && { opacity: 0.4 }]}
          disabled={!canAdd}
          onPress={handleAdd}
          activeOpacity={0.85}
        >
          <Text style={styles.billCtaText}>{t('clients.billSheet.add')}</Text>
        </TouchableOpacity>

      </View>
    </DragSheet>

    {/* Hermana de la hoja, no hija: un `Modal` dentro del ScrollView de otro se
        monta igual, pero así el árbol dice lo que pasa en pantalla. */}
    {showCal && (
      <BillDateSheet
        value={date}
        lang={lang}
        onPick={(iso) => { setDate(iso); setShowCal(false); }}
        onClose={() => setShowCal(false)}
      />
    )}
    </>
  );
}

// ── Global billing view ────────────────────────────────────────────────────────

function GlobalBillingView({ clients, onClose, onSelectClient }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t, i18n } = useTranslation();
  const updateClientBillingStatus = useStore((s) => s.updateClientBillingStatus);
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [showAdd,      setShowAdd]      = useState(false);

  const lang = i18n.language?.startsWith('en') ? 'en' : 'es';

  const allEntries = useMemo(() => {
    const entries = [];
    Object.values(clients ?? {}).forEach((client) => {
      (client.billing ?? []).forEach((b) => {
        entries.push({ ...b, clientId: client.id, clientName: client.name });
      });
    });
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [clients]);

  const periodFiltered = useMemo(() => {
    if (periodFilter === 'all') return allEntries;
    const now = new Date();
    const months = periodFilter === '1m' ? 1 : 3;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1).toISOString().split('T')[0];
    return allEntries.filter((e) => e.date >= cutoff);
  }, [allEntries, periodFilter]);

  const statusCounts = useMemo(() => ({
    all:     periodFiltered.length,
    pending: periodFiltered.filter((e) => e.status !== 'paid').length,
    paid:    periodFiltered.filter((e) => e.status === 'paid').length,
  }), [periodFiltered]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return periodFiltered;
    return periodFiltered.filter((e) => e.status === statusFilter);
  }, [periodFiltered, statusFilter]);

  // Las 3 tarjetas resumen el PERIODO, no el filtro de estado: ese filtro es
  // justo lo que ellas desglosan, así que atarlas a él dejaba PENDIENTE en
  // 0,00 € cada vez que se miraba "Pagado".
  const total   = periodFiltered.reduce((a, b) => a + (b.amount ?? 0), 0);
  const paid    = periodFiltered.filter((e) => e.status === 'paid').reduce((a, b) => a + (b.amount ?? 0), 0);
  const pending = total - paid;

  return (
    <View style={{ flex: 1 }}>
      {/* Cabecera: ‹ + título hero + ＋ (convención de Docs / Entrenador / Drive) */}
      <View style={styles.billHeader}>
        <TouchableOpacity style={styles.hdrIconBox} onPress={onClose} activeOpacity={0.7}>
          <Svg viewBox="0 0 24 24" width={20} height={20} fill="none"
            stroke={th.colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18 9 12l6-6" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.billHeaderTitle} numberOfLines={1}>{t('clients.globalBilling')}</Text>
        <TouchableOpacity style={styles.tagAddBtn} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
          <Text style={styles.tagAddBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {showAdd && (
        <GlobalAddBillingSheet clients={clients} lang={lang} onClose={() => setShowAdd(false)} />
      )}

      <ScrollView contentContainerStyle={styles.billBody} showsVerticalScrollIndicator={false}>

        {/* Tarjetas resumen — mismo tratamiento que las de Progress (statTile),
            con el valor a `card-title` en vez de `hero`: caben más dígitos. */}
        <View style={styles.billTilesRow}>
          {[
            { label: t('clients.billedLabel'),   value: total,   color: th.colors.text },
            { label: t('clients.receivedLabel'), value: paid,    color: th.colors.green },
            { label: t('clients.pendingLabel'),  value: pending, color: pending > 0 ? th.colors.orange : th.colors.mutedLight },
          ].map(({ label, value, color }) => (
            <View key={label} style={styles.billTile}>
              <Text style={styles.billTileLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {label}
              </Text>
              <Text style={[styles.billTileValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {value.toFixed(2)}€
              </Text>
            </View>
          ))}
        </View>

        {/* Filtros — dos segmentados apilados. El contador va dentro del propio
            label: la primitiva no pinta badges y no hay variante así en Figma. */}
        <View style={styles.billFilters}>
          <SegmentedControl
            options={[
              { id: 'all',     label: `${t('clients.filterAll')} · ${statusCounts.all}`     },
              { id: 'pending', label: `${t('clients.billPending')} · ${statusCounts.pending}` },
              { id: 'paid',    label: `${t('clients.statusPaid')} · ${statusCounts.paid}`   },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <SegmentedControl
            options={[
              { id: 'all', label: t('clients.periodAll')         },
              { id: '1m',  label: t('clients.periodThisMonth')   },
              { id: '3m',  label: t('clients.periodLast3Months') },
            ]}
            value={periodFilter}
            onChange={setPeriodFilter}
          />
        </View>

        {/* Entradas — 2 líneas: importe arriba con el nombre, pill abajo con el
            concepto. Precio y estado en la misma línea competían entre sí. */}
        {filtered.length === 0 ? (
          <Text style={styles.billEmpty}>{t('clients.noBillingEntries')}</Text>
        ) : (
          <View style={styles.billList}>
            {filtered.map((entry) => {
              const isPaid = entry.status === 'paid';
              const c      = isPaid ? th.colors.green : th.colors.orange;
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.billCard}
                  onPress={() => onSelectClient(entry.clientId)}
                  activeOpacity={0.8}
                >
                  <View style={styles.billCardLine}>
                    <Text style={styles.billCardName} numberOfLines={1}>{entry.clientName}</Text>
                    <Text style={styles.billCardAmount}>{entry.amount?.toFixed(2)}€</Text>
                  </View>
                  <View style={styles.billCardLine}>
                    <Text style={styles.billCardMeta} numberOfLines={1}>
                      {entry.concept} · {formatBillDate(entry.date, lang)}
                    </Text>
                    <TouchableOpacity
                      style={[styles.billPill, { backgroundColor: withOpacity(c, 0.12) }]}
                      onPress={() => updateClientBillingStatus(entry.clientId, entry.id, isPaid ? 'pending' : 'paid')}
                      activeOpacity={0.75}
                      hitSlop={8}
                    >
                      <Text style={[styles.billPillText, { color: c }]}>
                        {isPaid ? t('clients.statusPaid') : t('clients.billPending')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Client info sheet (⋯ modal) ────────────────────────────────────────────────

function ClientInfoSheet({ client, onClose, onConnectCloud }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const showToast = useStore((s) => s.showToast);
  const [copied,  setCopied]  = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCopy() {
    if (!client.syncCode) return;
    await Clipboard.setStringAsync(client.syncCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    showToast('Código copiado', 2200, 'neutral');
  }

  async function handleConnect() {
    setLoading(true);
    try {
      await onConnectCloud();
      showToast('Cliente conectado', 2200, 'success');
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message ?? 'No se pudo conectar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.infoSheet}>
        <View style={styles.infoSheetHandle} />
        <Text style={styles.infoSheetName}>{client.name}</Text>

        {client.syncSlotId ? (
          client.syncCode ? (
            <View style={styles.infoCodeRow}>
              <View style={styles.infoCodeBox}>
                <Text style={styles.infoCodeLabel}>CÓDIGO CLIENTE</Text>
                <Text style={styles.infoCodeText}>{client.syncCode}</Text>
              </View>
              <TouchableOpacity style={styles.infoCopyBtn} onPress={handleCopy} activeOpacity={0.7}>
                <Text style={styles.infoCopyBtnText}>{copied ? '✓' : '📋'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.infoCodeBox}>
              <Text style={styles.infoCodeLabel}>SINCRONIZACIÓN EN LA NUBE</Text>
              <Text style={styles.infoCodeSub}>Conectado · sin código local</Text>
            </View>
          )
        ) : (
          <TouchableOpacity
            style={[styles.infoSheetBtnAccent, loading && { opacity: 0.6 }]}
            onPress={handleConnect}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.infoSheetBtnTextAccent}>
              {loading ? t('clients.connecting') : t('clients.connectCloud')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

// ── Action sheet icons ──────────────────────────────────────────────────────────

function ChartIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function TargetIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.8} />
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth={1.8} />
      <Circle cx="12" cy="12" r="1.6" fill={color} />
    </Svg>
  );
}
function PencilIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20h9" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
            stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function PersonIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
function CloudUpIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9.5a3.5 3.5 0 0 1-.5 8.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 21V12M9 14.5l3-3 3 3" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── ClientActionsSheet ──────────────────────────────────────────────────────────
// The "···" menu on a client card: keeps the frequent action one tap on the card
// and tucks the rest (next session, edit program, info) behind this sheet.

function ClientActionsSheet({ client, newSessionsCount = 0, onClose, onProgress, onNextSession, onEditProgram, onInfo }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const run = (fn) => () => { onClose(); fn(); };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.infoSheet}>
        <View style={styles.infoSheetHandle} />
        <Text style={styles.infoSheetName}>{client.name}</Text>

        <TouchableOpacity style={styles.actionRow} onPress={run(onProgress)} activeOpacity={0.7}>
          <ChartIcon color={th.colors.muted} />
          <Text style={styles.actionLabel}>{t('clients.actProgress')}</Text>
          {newSessionsCount > 0 && (
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>{newSessionsCount > 99 ? '99+' : newSessionsCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionRow, styles.actionRowNext]} onPress={run(onNextSession)} activeOpacity={0.7}>
          <TargetIcon color={th.colors.blue} />
          <Text style={[styles.actionLabel, { color: th.colors.blue }]}>{t('clients.actNextSession')}</Text>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={run(onEditProgram)} activeOpacity={0.7}>
          <PencilIcon color={th.colors.muted} />
          <Text style={styles.actionLabel}>{t('clients.actEditProgram')}</Text>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={run(onInfo)} activeOpacity={0.7}>
          <PersonIcon color={th.colors.muted} />
          <Text style={styles.actionLabel}>{t('clients.actInfo')}</Text>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Sync time helper ───────────────────────────────────────────────────────────

function syncAgo(isoStr) {
  if (!isoStr) return null;
  const ms = Date.now() - new Date(isoStr).getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

// ── Client list card ───────────────────────────────────────────────────────────

/** Ephemeral filter pill that doubles as an attention counter. */
function AttentionPill({ label, count, color, active, onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.attnPill, { backgroundColor: active ? color : withOpacity(color, 0.12) }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.attnPillText, { color: active ? th.colors.bg : color }]}>{label}</Text>
      <View style={[styles.attnPillBadge, {
        backgroundColor: active ? withOpacity(th.colors.bg, 0.25) : withOpacity(color, 0.2),
      }]}>
        <Text style={[styles.attnPillBadgeText, { color: active ? th.colors.bg : color }]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ClientListCard({
  client, activeProgram, lastActivityTs, isConnected,
  adherence, onPress, onOpenEditor, onUploadProgram, onViewProgress, onOpenActions,
  onSendOverrides, onUnlockStage, onPlanStages, newSessionsCount = 0,
}) {
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const programDirty = client.programDirty ?? false;
  const showDirty    = isConnected && programDirty;
  // Unsent next-session prescriptions (incl. a failed send) → blue upload button.
  const showOverrideDirty = isConnected && !showDirty && !!client.overridesDirty;

  // Last activity label
  let lastStr = t('clients.lastNever');
  if (lastActivityTs) {
    const diffDays = Math.floor((Date.now() - lastActivityTs) / 86400000);
    if (diffDays === 0)      lastStr = t('dayCard.today');
    else if (diffDays === 1) lastStr = t('dayCard.yesterday');
    else                     lastStr = t('dayCard.daysAgo', { count: diffDays });
  }

  // Program info — posición espejada del último envío del cliente (§3.1 de
  // `docs/specs/stage-locks.md`); la copia local sirve de respaldo para clientes
  // que nunca sincronizan.
  const mine           = progressFromBlob(client.progress, activeProgram?.id);
  const hasStages      = (activeProgram?.stages?.length ?? 0) > 0;
  const stageIdx       = clientStageIndex(client, activeProgram);
  const currentStage   = hasStages ? activeProgram.stages[stageIdx] : null;
  const currentDays    = hasStages
    ? (currentStage?.days ?? [])
    : (activeProgram?.days ?? []);
  const sessPerCycle   = Math.max(1, currentDays.length);
  const cycleDoneIds   = new Set(mine?.cycleCompletedIds ?? activeProgram?.cycleCompletedIds ?? []);
  // Parado, en cualquiera de sus dos formas — mismo cálculo que el hero, aquí
  // solo para encender el aviso en la fila. Esperando a que le abras la etapa
  // siguiente, o a que la montes porque no hay ninguna detrás.
  const stageEnded     = hasStages
    && (mine?.stageWeeksCompleted ?? activeProgram?.stageWeeksCompleted ?? 0) >= (currentStage?.durationWeeks ?? Infinity);
  const stageStuck     = stageEnded && !!activeProgram.stages[stageIdx + 1]?.locked;
  const blockStuck     = stageEnded && !activeProgram.stages[stageIdx + 1];
  const doneInCycle    = currentDays.filter((d) => cycleDoneIds.has(d.sessionTemplateId)).length;
  // "Ciclo NN" = vueltas COMPLETAS al ciclo + 1, el mismo contador que el banner
  // de Home (`totalWeeksCompleted`), espejado del blob del cliente. Antes aquí se
  // pintaban semanas de calendario desde el log, que es otro número.
  const cycleNum       = (mine?.totalWeeksCompleted ?? activeProgram?.totalWeeksCompleted ?? 0) + 1;

  // Real training pace (avg cycles/week) vs target — el objetivo ya no se pinta
  // (era ilegible en la tarjeta), pero sigue decidiendo el color.
  const paceTarget   = adherence?.weekTarget ?? sessPerCycle;
  const paceRaw      = adherence?.recentPerWeek ?? 0;
  const paceRounded  = Math.round(paceRaw * 2) / 2; // nearest 0.5
  const paceHasData  = adherence != null && adherence.status !== STATUS.NO_DATA && paceRaw > 0;
  const paceRateStr  = Number.isInteger(paceRounded)
    ? String(paceRounded)
    : paceRounded.toFixed(1).replace('.', i18n.language?.startsWith('es') ? ',' : '.');
  // Flag when the real pace falls below target so the trainer notices a slowdown
  // even before adherence flips to slipping/at-risk.
  const paceBehind   = paceHasData && paceRounded < paceTarget;
  const attnColor    = adherence && requiresAttention(adherence.status)
    ? adherenceColor(th, adherence.status)
    : null;

  // Una sola acción a la derecha, por urgencia. El botón constante de "Progreso"
  // desaparece: sin nada urgente el hueco lo ocupa la fecha o "N sin revisar".
  const cta = !activeProgram
    ? { label: t('clients.btnProgramShort'), bg: th.colors.accent, onPress: onOpenEditor }
    : showDirty
      ? { label: t('clients.btnUploadChanges'), upload: true, bg: th.colors.orange, onPress: onUploadProgram }
      : stageStuck
        ? { label: t('clients.stageUnlockShort'), bg: th.colors.orange, onPress: () => onUnlockStage(stageIdx + 1) }
        : blockStuck
          ? { label: t('clients.blockPlanShort'), bg: th.colors.orange, onPress: onPlanStages }
          : showOverrideDirty
            ? { label: t('clients.btnSendOverride'), upload: true, bg: th.colors.blue, onPress: onSendOverrides }
            : null;

  // Un cliente en pausa o inactivo ocupa el hueco de la última actividad: su
  // adherencia está silenciada, así que la fecha ahí no dice nada.
  const manualStatus = client.status ?? 'active';
  const statusLabel  = manualStatus === 'paused'   ? t('clients.statusPaused')
                     : manualStatus === 'inactive' ? t('clients.statusInactive')
                     : null;

  return (
    <TouchableOpacity
      style={styles.cCard}
      onPress={onPress}
      onLongPress={onOpenActions}
      delayLongPress={350}
      activeOpacity={0.75}
    >
      {/* ── Línea 1: nombre · racha · Ciclo NN ── */}
      <View style={styles.cTop}>
        <Text style={styles.cName} numberOfLines={1}>{client.name}</Text>
        {adherence?.streak >= 2 && (
          <Text style={styles.cStreak}>{t('clients.streakWeeks', { count: adherence.streak })}</Text>
        )}
        {activeProgram && (
          <Text style={styles.cCycle}>
            {t('clients.cycleLabel')}{' '}
            <Text style={styles.cCycleNum}>{String(cycleNum).padStart(2, '0')}</Text>
          </Text>
        )}
      </View>

      <View style={styles.cBody}>
        <View style={styles.cMain}>
          {!activeProgram ? (
            <View style={styles.cAvisoRow}>
              <View style={[styles.cAvisoDot, { backgroundColor: th.colors.muted }]} />
              <Text style={[styles.cAvisoText, { color: th.colors.mutedLight }]}>
                {t('clients.noActiveProgram')}
              </Text>
            </View>
          ) : (
            <>
              {/* El aviso ocupa el sitio de la línea de programa; cuando además
                  hay cambios sin enviar se pintan las dos. */}
              {(!(stageStuck || blockStuck) || showDirty) && (
                <Text
                  style={[styles.cProgLine, showDirty && { color: th.colors.orange }]}
                  numberOfLines={1}
                >
                  {activeProgram.name}
                  {currentStage?.name ? (
                    <Text style={[styles.cStageLine, showDirty && { color: th.colors.orange }]}>
                      {' · '}{currentStage.name}
                    </Text>
                  ) : null}
                </Text>
              )}

              {(stageStuck || blockStuck) && (
                <View style={styles.cAvisoRow}>
                  <View style={styles.cAvisoDot} />
                  <Text style={styles.cAvisoText}>
                    {t(stageStuck ? 'clients.stageLockedShort' : 'clients.blockDoneShort')}
                  </Text>
                </View>
              )}

              <View style={styles.cPaceRow}>
                <Text style={styles.cPace}>
                  {paceHasData ? (
                    <>
                      <Text style={[
                        styles.cPaceNum,
                        paceBehind && { color: th.colors.orange },
                        attnColor && { color: attnColor },
                      ]}>{paceRateStr}</Text>
                      <Text style={styles.cPaceUnit}> {t('clients.cyclesPerWeek')}</Text>
                    </>
                  ) : (
                    <Text style={styles.cPaceUnit}>{t('clients.noPaceShort')}</Text>
                  )}
                </Text>

                <View style={styles.cDots}>
                  {Array.from({ length: sessPerCycle }, (_, i) => (
                    <View key={i} style={[styles.cDot, i < doneInCycle ? styles.cDotFull : styles.cDotEmpty]} />
                  ))}
                </View>

                {/* Jerarquía del hueco derecho: CTA > sin revisar > estado > fecha */}
                {!cta && (newSessionsCount > 0 ? (
                  <TouchableOpacity
                    style={styles.cUnreviewed}
                    onPress={onViewProgress}
                    hitSlop={8}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cUnreviewedDot} />
                    <Text style={styles.cUnreviewedText}>
                      {t('clients.unreviewedSessions', { count: newSessionsCount })}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.cLast, !statusLabel && attnColor && { color: attnColor }]}>
                    {statusLabel ?? lastStr}
                  </Text>
                ))}
              </View>
            </>
          )}
        </View>

        {cta && (
          <TouchableOpacity
            style={[styles.cCta, { backgroundColor: cta.bg }]}
            onPress={cta.onPress}
            activeOpacity={0.85}
          >
            {cta.upload && <UploadIcon color={th.colors.onAccent} />}
            <Text style={styles.cCtaText}>{cta.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function ClientsScreen() {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();

  // ── Store ──────────────────────────────────────────────────────────────────
  const clients                = useStore((s) => s.clients);
  const programs               = useStore((s) => s.programs);
  const clientLogs             = useStore((s) => s.clientLogs);
  const exerciseLibrary        = useStore((s) => s.exerciseLibrary);
  const customExercises        = useStore((s) => s.customExercises);
  const sessionTemplates       = useStore((s) => s.sessionTemplates);
  const userPrograms           = useStore((s) => s.userPrograms);
  const profile                = useStore((s) => s.profile);

  const createClient           = useStore((s) => s.createClient);
  const deleteClient           = useStore((s) => s.deleteClient);
  const updateClientInfo       = useStore((s) => s.updateClientInfo);
  const createProgramForClient = useStore((s) => s.createProgramForClient);
  const cloneProgramFromTemplate = useStore((s) => s.cloneProgramFromTemplate);
  const deleteProgram          = useStore((s) => s.deleteProgram);
  const setEditingProgram      = useStore((s) => s.setEditingProgram);
  const setPrintingProgram     = useStore((s) => s.setPrintingProgram);
  const getEffectiveTemplate   = useStore((s) => s.getEffectiveTemplate);
  const exportSpecificProgram  = useStore((s) => s.exportSpecificProgram);
  const shareSpecificProgram   = useStore((s) => s.shareSpecificProgram);
  const setClientActiveProgram = useStore((s) => s.setClientActiveProgram);
  const addClientBilling       = useStore((s) => s.addClientBilling);
  const updateClientBillingStatus = useStore((s) => s.updateClientBillingStatus);
  const removeClientBilling    = useStore((s) => s.removeClientBilling);
  const addClientBodyWeight    = useStore((s) => s.addClientBodyWeight);
  const removeClientBodyWeight = useStore((s) => s.removeClientBodyWeight);
  const importForClient          = useStore((s) => s.importForClient);
  const deleteClientLogEntry     = useStore((s) => s.deleteClientLogEntry);
  const showToast                = useStore((s) => s.showToast);
  const uploadProgramToClient    = useStore((s) => s.uploadProgramToClient);
  const updateStage              = useStore((s) => s.updateStage);
  const sendOverrides            = useStore((s) => s.sendOverrides);
  const downloadClientHistory    = useStore((s) => s.downloadClientHistory);
  const connectClientToCloud     = useStore((s) => s.connectClientToCloud);
  const markHistoryViewed        = useStore((s) => s.markHistoryViewed);
  const refreshTrainerSlots      = useStore((s) => s.refreshTrainerSlots);

  // Tag registry
  const tagRegistry  = useStore((s) => s.tagRegistry ?? []);
  const createTag    = useStore((s) => s.createTag);
  const renameTag    = useStore((s) => s.renameTag);
  const deleteTag    = useStore((s) => s.deleteTag);

  const isPro        = profile.isPro ?? true;
  const setProfile   = useStore((s) => s.setProfile);
  const trainerSync  = useStore((s) => s.trainerSync);

  // Memoizado porque ahora alimenta los memos de carga: un objeto nuevo en cada
  // render recalculaba `sessionLoads` sobre todo el historial del cliente.
  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  const templatePrograms = useMemo(
    () => Object.values(programs ?? {})
      .filter((p) => p.mode === 'template')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [programs]
  );

  const clientCounts = useMemo(() => {
    const all      = Object.values(clients ?? {});
    const active   = all.filter((c) => (c.status ?? 'active') !== 'inactive').length;
    const inactive = all.filter((c) => (c.status ?? 'active') === 'inactive').length;
    return { active, inactive, total: all.length };
  }, [clients]);

  // ── UI State ───────────────────────────────────────────────────────────────
  const [showPaywall,      setShowPaywall]      = useState(false);
  const [view,             setView]             = useState('list'); // 'list' | 'detail' | 'billing'
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [activeTab,        setActiveTab]        = useState('programs');

  // List
  const [search,           setSearch]           = useState('');
  const [statusFilter,     setStatusFilter]     = useState('active'); // 'active'|'inactive'|'all'
  const [tagFilter,        setTagFilter]        = useState([]);    // active tag IDs (used in filter)
  const [showFilterSheet,  setShowFilterSheet]  = useState(false);
  const [sortMode,         setSortMode]         = useState('recent'); // 'recent'|'idle'|'name'
  const [adherenceFilter,  setAdherenceFilter]  = useState(null);   // null | 'at_risk' | 'unreviewed'

  function toggleTagFilter(id) {
    setTagFilter((p) => p.includes(id) ? p.filter((t) => t !== id) : [...p, id]);
  }
  function clearFilters() {
    setStatusFilter('active');
    setTagFilter([]);
    setSortMode('recent');
    setAdherenceFilter(null);
  }
  // Filters that diverge from the default view — drives the badge + applied row.
  const activeFilterCount = tagFilter.length + (statusFilter !== 'active' ? 1 : 0);
  const [showNewClient,    setShowNewClient]     = useState(false);
  const [newClientName,    setNewClientName]     = useState('');

  // Detail - tags input
  const [newTag,           setNewTag]           = useState('');

  // Tag management (inline in the filter sheet)
  const [tagRenameId,      setTagRenameId]      = useState(null);
  const [tagRenameText,    setTagRenameText]    = useState('');
  const [tagSearchText,    setTagSearchText]    = useState('');

  // Detail - programs tab
  const [showNewProgram,   setShowNewProgram]   = useState(false);
  const [showPrevious,     setShowPrevious]     = useState(false);

  // Detail - history / progress filters
  const [scopeFilter,   setScopeFilter]   = useState('active');
  const [periodFilter,  setPeriodFilter]  = useState('all');
  const [refreshingHistory, setRefreshingHistory] = useState(false);

  // List pull-to-refresh
  const [refreshingList, setRefreshingList] = useState(false);

  // Detail - info accordion
  const [openSections,  setOpenSections]  = useState({ status: false, personal: true, weight: false, billing: false });

  // Detail - body weight
  const [weightDate,  setWeightDate]  = useState(new Date().toISOString().split('T')[0]);
  const [weightValue, setWeightValue] = useState('');

  // Detail - billing
  const [billDate,    setBillDate]    = useState(new Date().toISOString().split('T')[0]);
  const [billConcept, setBillConcept] = useState('');
  const [billAmount,  setBillAmount]  = useState('');
  const [billStatus,  setBillStatus]  = useState('pending');

  // Detail - key tab

  // Import
  const [importState, setImportState] = useState(null); // { fileName, parsedData }

  // Sync mode modal — shown on first visit (mode === null) or from hamburger menu
  const [showSyncModal, setShowSyncModal] = useState(false);
  const isFirstTimeSync = trainerSync.mode === null;

  // Client info sheet (⋯ button on card)
  const [infoSheetClientId, setInfoSheetClientId] = useState(null);
  const [actionsClientId,   setActionsClientId]   = useState(null);

  // ── Derived data ───────────────────────────────────────────────────────────

  // Adherence (procedural) per client — drives the card colour + the pills.
  const adherenceByClient = useMemo(() => {
    const out = {};
    Object.values(clients ?? {}).forEach((c) => {
      out[c.id] = computeAdherence({
        sessions:         clientLogs[c.id] ?? [],
        sessionsPerCycle: weeklyTarget(programs[c.activeProgramId]),
        manualStatus:     c.status ?? 'active',
      });
    });
    return out;
  }, [clients, programs, clientLogs]);

  // Unreviewed sessions per client (remote count minus what the trainer last saw).
  const unreviewedByClient = useMemo(() => {
    const out = {};
    Object.values(clients ?? {}).forEach((c) => {
      out[c.id] = Math.max(0, (c.remoteSessionsCount ?? 0) - (trainerSync.lastSeenSessionsCount?.[c.id] ?? 0));
    });
    return out;
  }, [clients, trainerSync.lastSeenSessionsCount]);

  // Pill counters — global avisos, not scoped to search/tags.
  const atRiskCount     = useMemo(
    () => Object.values(clients ?? {}).filter((c) => adherenceByClient[c.id]?.status === STATUS.AT_RISK).length,
    [clients, adherenceByClient],
  );
  const unreviewedCount = useMemo(
    () => Object.values(unreviewedByClient).filter((n) => n > 0).length,
    [unreviewedByClient],
  );

  // Clients with unsent uploads (program changes and/or next-session prescriptions).
  const pendingClients = useMemo(
    () => Object.values(clients ?? {}).filter((c) => c.syncSlotId && (c.programDirty || c.overridesDirty)),
    [clients],
  );
  const pendingOverrideCount = pendingClients.filter((c) => c.overridesDirty).length;
  const pendingProgramCount  = pendingClients.filter((c) => c.programDirty).length;
  const [sendingAll, setSendingAll] = useState(false);

  async function sendAllPending() {
    if (sendingAll || !pendingClients.length) return;
    setSendingAll(true);
    let ok = 0, fail = 0;
    for (const c of pendingClients) {
      try {
        if (c.programDirty && c.activeProgramId) await uploadProgramToClient(c.id, c.activeProgramId);
        if (c.overridesDirty) await sendOverrides(c.id);
        ok += 1;
      } catch { fail += 1; }
    }
    setSendingAll(false);
    showToast(
      fail === 0 ? t('clients.sendAllDone') : t('clients.sendAllPartial', { ok, fail }),
      2400, fail === 0 ? 'success' : 'error',
    );
  }

  // If a filter's counter dropped to zero its pill is gone, so ignore it
  // (derived, not stored — avoids resetting state from an effect).
  const effectiveAdherenceFilter =
    (adherenceFilter === 'at_risk'    && atRiskCount === 0) ||
    (adherenceFilter === 'unreviewed' && unreviewedCount === 0)
      ? null : adherenceFilter;

  // An adherence pill, when active, overrides the manual status/tag filters and
  // jumps to its focused subset + order. Otherwise the list behaves as before.
  const clientList = useMemo(() => {
    let list = Object.values(clients ?? {})
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

    if (effectiveAdherenceFilter === 'at_risk') {
      list = list.filter((c) => adherenceByClient[c.id]?.status === STATUS.AT_RISK);
    } else if (effectiveAdherenceFilter === 'unreviewed') {
      list = list.filter((c) => (unreviewedByClient[c.id] ?? 0) > 0);
    } else {
      list = list
        .filter((c) => {
          const s = c.status ?? 'active';
          if (statusFilter === 'active')   return s !== 'inactive';
          if (statusFilter === 'inactive') return s === 'inactive';
          return true;
        })
        .filter((c) => tagFilter.length === 0 || tagFilter.some((t) => (c.tags ?? []).includes(t)));
    }

    const lastTs = {};
    list.forEach((c) => {
      const sessions = clientLogs[c.id] ?? [];
      lastTs[c.id] = sessions.length ? Math.max(...sessions.map((e) => e.timestamp)) : 0;
    });
    if (effectiveAdherenceFilter === 'at_risk') {
      list.sort((a, b) => (lastTs[a.id] ?? 0) - (lastTs[b.id] ?? 0)); // most idle first
    } else if (effectiveAdherenceFilter === 'unreviewed') {
      list.sort((a, b) => (lastTs[b.id] ?? 0) - (lastTs[a.id] ?? 0)); // most recent first
    } else if (sortMode === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === 'idle') {
      list.sort((a, b) => (lastTs[a.id] ?? 0) - (lastTs[b.id] ?? 0));
    } else {
      list.sort((a, b) => (lastTs[b.id] ?? 0) - (lastTs[a.id] ?? 0)); // recent first
    }
    return list;
  }, [clients, search, statusFilter, tagFilter, sortMode, clientLogs, effectiveAdherenceFilter, adherenceByClient, unreviewedByClient]);

  // tagRegistry is the source of truth — no useMemo needed
  const allTags = tagRegistry;

  const selectedClient = selectedClientId ? clients?.[selectedClientId] : null;

  const clientPrograms = useMemo(() => {
    if (!selectedClient) return [];
    return (selectedClient.programIds ?? [])
      .map((id) => programs[id])
      .filter(Boolean)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }, [selectedClient, programs]);

  const allClientTemplateIds = useMemo(() => {
    return new Set(clientPrograms.flatMap((p) => getAllProgramDays(p).map((d) => d.sessionTemplateId)));
  }, [clientPrograms]);

  const activeClientTemplateIds = useMemo(() => {
    if (!selectedClient?.activeProgramId) return new Set();
    const activeProg = programs[selectedClient.activeProgramId];
    if (!activeProg) return new Set();
    return new Set(getAllProgramDays(activeProg).map((d) => d.sessionTemplateId));
  }, [selectedClient, programs]);

  // All sessions for this client (no scope/period filter) — for ProgressTab.
  // Comes straight from the client's separated log, so it also includes
  // free sessions ('__free__') that template filtering used to hide.
  const clientBaseLog = useMemo(() => {
    return selectedClientId ? (clientLogs[selectedClientId] ?? []) : [];
  }, [clientLogs, selectedClientId]);

  // ── Los 3 datos de la tarjeta de programa ──────────────────────────────────
  // Adherencia: sesiones hechas vs esperadas en las últimas 4 semanas.
  const clientAdherencePct = useMemo(() => adherencePct({
    sessions:         clientBaseLog,
    sessionsPerCycle: adherenceByClient[selectedClientId]?.weekTarget ?? 0,
  }), [clientBaseLog, adherenceByClient, selectedClientId]);

  // Carga media: media de carga externa de los últimos 7 días frente a la de
  // los 28, en % — el mismo par de medias del que sale `loadState` en el panel
  // de Carga, aquí como número porque la tarjeta solo tiene sitio para uno.
  // Con menos de dos semanas de historial no hay contra qué comparar.
  const clientLoadPct = useMemo(() => {
    if (!selectedClientId || clientBaseLog.length < 2) return null;
    const days = dailySeries(sessionLoads(clientBaseLog, allExercises));
    if (days.length < 14) return null;
    const ext   = days.map((d) => d.external ?? 0);
    const avg   = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const m7    = avg(ext.slice(-7));
    const m28   = avg(ext.slice(-28));
    if (!m28) return null;
    return Math.round((m7 / m28 - 1) * 100);
  }, [clientBaseLog, allExercises, selectedClientId]);

  const filteredLog = useMemo(() => {
    let log = scopeFilter === 'active'
      ? clientBaseLog.filter((e) => activeClientTemplateIds.has(e.sessionTemplateId))
      : clientBaseLog;
    if (periodFilter !== 'all') {
      const days = periodFilter === '7d' ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      log = log.filter((e) => e.timestamp >= cutoff);
    }
    return [...log].sort((a, b) => b.timestamp - a.timestamp);
  }, [clientBaseLog, scopeFilter, periodFilter, activeClientTemplateIds]);

  // Delta de tonelaje por sesión — sobre el log completo del cliente, no sobre
  // `filteredLog`: el filtro de periodo no debe cambiar contra qué se compara.
  const clientDeltas = useMemo(() => volumeDeltas(clientBaseLog), [clientBaseLog]);

  const exercisesWithLogs = useMemo(() => {
    return [...new Set(
      filteredLog.flatMap((log) =>
        log.exercises
          .filter((e) => e.sets.some((s) => s.done || s.weight || s.reps || s.time))
          .map((e) => e.exerciseId)
      )
    )];
  }, [filteredLog]);

  // ── Tab press → reset to list ──────────────────────────────────────────────

  useEffect(() => {
    const unsub = navigation.addListener('tabPress', () => {
      setView('list');
      setSelectedClientId(null);
    });
    return unsub;
  }, [navigation]);

  // ── Auto-open sync modal on first visit ────────────────────────────────────

  useEffect(() => {
    if (isPro && trainerSync.mode === null) {
      setShowSyncModal(true);
    }
  }, [isPro]); // run once when screen mounts as PRO user

  // ── Auto-fetch slot session counts on mount ─────────────────────────────────

  useEffect(() => {
    if (trainerSync.mode && trainerSync.mode !== 'offline' && trainerSync.userId) {
      refreshTrainerSlots().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Badge count helper ──────────────────────────────────────────────────────

  function getNewSessionsCount(clientId) {
    const remote   = clients[clientId]?.remoteSessionsCount ?? 0;
    const lastSeen = trainerSync.lastSeenSessionsCount?.[clientId] ?? 0;
    return Math.max(0, remote - lastSeen);
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSelectClient(clientId) {
    setSelectedClientId(clientId);
    setActiveTab('programs');
    setScopeFilter('active');
    setPeriodFilter('all');
    setOpenSections({ status: false, personal: true, weight: false, billing: false });
    setView('detail');
  }

  function handleSelectClientInfo(clientId) {
    setSelectedClientId(clientId);
    setActiveTab('info');
    setScopeFilter('active');
    setPeriodFilter('all');
    setOpenSections({ status: false, personal: true, weight: false, billing: false });
    setView('detail');
  }

  /**
   * Abre el detalle de un cliente en la pestaña que lee su historial.
   *
   * Las sesiones "sin revisar" viven en el slot, no en `clientLogs`: entrar sin
   * descargarlas enseñaba el progreso viejo hasta que alguien tiraba del refresh.
   * Se marcan como vistas DESPUÉS de bajarlas — si la descarga falla, el aviso
   * tiene que seguir ahí.
   */
  function openClientHistoryTab(clientId, tab) {
    setSelectedClientId(clientId);
    setActiveTab(tab);
    setScopeFilter('active');
    setPeriodFilter('all');
    setOpenSections({ status: false, personal: true, weight: false, billing: false });
    setView('detail');
    (async () => {
      try {
        if (clients[clientId]?.syncSlotId) await downloadClientHistory(clientId);
        markHistoryViewed(clientId);
      } catch {
        // silencioso: lo ya cargado sigue siendo válido y el aviso se queda
      }
    })();
  }

  function handleSelectClientProgress(clientId) {
    openClientHistoryTab(clientId, 'progress');
  }

  /**
   * Abre la etapa `stageIdx` del programa activo del cliente y se la envía.
   * La usan la tarjeta de la lista y el hero del detalle — vive aquí para que
   * las dos compartan el rollback de abajo.
   */
  async function unlockClientStage(clientId, stageIdx) {
    const programId = clients[clientId]?.activeProgramId;
    const stage     = programId ? programs[programId]?.stages?.[stageIdx] : null;
    if (!stage) return;
    updateStage(programId, stageIdx, { locked: false });
    try {
      await uploadProgramToClient(clientId, programId);
      showToast(t('clients.toastStageUnlocked', { name: stage.name }), 2600, 'success');
    } catch (err) {
      // Si el envío falla hay que volver a cerrarla: el cliente sigue viéndola
      // bloqueada, y dejarla abierta aquí borraría el aviso que recuerda que ese
      // cliente está parado.
      updateStage(programId, stageIdx, { locked: true });
      Alert.alert('Error', err.message ?? t('clients.programUploadError'));
    }
  }

  async function handleRefreshList() {
    setRefreshingList(true);
    try {
      await refreshTrainerSlots();
    } catch {
      // silent — badge state is best-effort
    } finally {
      setRefreshingList(false);
    }
  }

  function handleSelectClientHistory(clientId) {
    openClientHistoryTab(clientId, 'history');
  }

  async function handleCreateClient() {
    if (!newClientName.trim()) return;
    setNewClientName('');
    setShowNewClient(false);
    await createClient(newClientName.trim());
  }

  function handleDeleteClient(clientId) {
    Alert.alert(
      t('clients.deleteClientTitle'),
      t('clients.deleteClientConfirm'),
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => {
          deleteClient(clientId);
          if (selectedClientId === clientId) { setSelectedClientId(null); setView('list'); }
        }},
      ]
    );
  }

  // The model keeps exactly one active program per client: assigning a new one
  // replaces and archives the current. Warn before that happens.
  function confirmReplaceActive(onConfirm) {
    const hasActive = selectedClient?.activeProgramId && programs[selectedClient.activeProgramId];
    if (!hasActive) { onConfirm(); return; }
    Alert.alert(
      t('clients.replaceActiveTitle'),
      t('clients.replaceActiveConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('clients.replaceActiveConfirmBtn'), onPress: onConfirm },
      ],
    );
  }

  function handleCreateProgram(programName, numSessions, durationWeeks) {
    if (!selectedClientId) return;
    setShowNewProgram(false);
    confirmReplaceActive(() => {
      const newId = createProgramForClient(selectedClientId, numSessions, programName, durationWeeks);
      if (newId) setClientActiveProgram(selectedClientId, newId);
    });
  }

  function handleCreateFromTemplate(templateId, customName) {
    if (!selectedClientId) return;
    setShowNewProgram(false);
    const srcName = templatePrograms.find((p) => p.id === templateId)?.name ?? t('clients.programFallback');
    confirmReplaceActive(() => {
      const newId = cloneProgramFromTemplate(templateId, {
        mode: 'managed',
        clientId: selectedClientId,
        name: customName.trim() || srcName,
      });
      if (newId) setClientActiveProgram(selectedClientId, newId);
    });
  }

  async function handleImportPick() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed = parseImportFile(raw);
      if (!parsed.ok) { Alert.alert('Archivo no válido', parsed.error); return; }
      setImportState({ fileName: result.assets[0].name, parsedData: parsed.data });
    } catch (err) {
      if (!err?.message?.includes('cancel')) {
        Alert.alert('Error', err?.message ?? 'No se pudo leer el archivo');
      }
    }
  }

  function handleImport(parsedData, mode) {
    importForClient(selectedClientId, parsedData, mode);
    setImportState(null);
  }

  async function handleRefreshHistory() {
    if (!selectedClientId || refreshingHistory) return;
    setRefreshingHistory(true);
    try {
      const { merged } = await downloadClientHistory(selectedClientId);
      markHistoryViewed(selectedClientId);
      showToast(merged > 0 ? `${merged} sesión${merged !== 1 ? 'es' : ''} nueva${merged !== 1 ? 's' : ''}` : 'Historial al día', 2200, 'success');
    } catch (err) {
      showToast(err?.message ?? t('clients.errorUpdateHistory'), 2200, 'error');
    } finally {
      setRefreshingHistory(false);
    }
  }

  function getSessionCount(program) {
    const ids = new Set(getAllProgramDays(program).map((d) => d.sessionTemplateId));
    return clientBaseLog.filter((e) => ids.has(e.sessionTemplateId)).length;
  }

  function getLastActivity(program) {
    const ids = new Set(getAllProgramDays(program).map((d) => d.sessionTemplateId));
    const sessions = clientBaseLog.filter((e) => ids.has(e.sessionTemplateId));
    return sessions.length ? Math.max(...sessions.map((e) => e.timestamp)) : null;
  }

  function getExerciseLogs(exerciseId) {
    return filteredLog
      .filter((log) => log.exercises.some((e) =>
        e.exerciseId === exerciseId && e.sets.some((s) => s.done || s.weight || s.reps || s.time)
      ))
      .slice(-12)
      .map((log) => ({ timestamp: log.timestamp, exercise: log.exercises.find((e) => e.exerciseId === exerciseId) }));
  }

  function handleAddWeight() {
    if (!weightValue || !weightDate) return;
    addClientBodyWeight(selectedClientId, weightDate, weightValue);
    setWeightValue('');
  }

  function handleAddBilling() {
    if (!billConcept.trim() || !billAmount || !billDate) return;
    addClientBilling(selectedClientId, {
      date: billDate, concept: billConcept.trim(),
      amount: parseFloat(billAmount), status: billStatus,
    });
    setBillConcept(''); setBillAmount(''); setBillStatus('pending');
  }

  // ── PRO gate ───────────────────────────────────────────────────────────────

  if (!isPro) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <AppHeader />
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>Gestión de clientes</Text>
          <Text style={styles.emptyBody}>
            Lleva el seguimiento de tus clientes, asígnales programas y controla su facturación.
          </Text>
          <TouchableOpacity
            style={styles.proBtn}
            onPress={() => setShowPaywall(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.proBtnText}>Ver planes PRO</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.hideTabBtn}
            onPress={() => {
              setProfile({ proTabsHidden: true });
              navigation.navigate('Home');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.hideTabBtnText}>Ocultar tab</Text>
          </TouchableOpacity>
        </View>
        {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
      </View>
    );
  }

  // ── Billing view ───────────────────────────────────────────────────────────

  if (view === 'billing') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <AppHeader />
        <GlobalBillingView
          clients={clients}
          onClose={() => setView('list')}
          onSelectClient={(id) => {
            setView('detail');
            handleSelectClient(id);
            setActiveTab('info');
            setOpenSections({ personal: false, weight: false, billing: true });
          }}
        />
      </View>
    );
  }

  // ── Client detail ──────────────────────────────────────────────────────────

  if (view === 'detail' && selectedClient) {
    const TABS = [
      { id: 'programs', label: t('clients.tabs.programs') },
      { id: 'history',  label: t('clients.tabs.history')  },
      { id: 'progress', label: t('clients.tabs.progress') },
      { id: 'info',     label: t('clients.tabs.info')     },
    ];
    // Línea de estado bajo el nombre: la semana en curso + cuándo entrenó por
    // última vez. Sin puntos — los del ciclo viven en la tarjeta de programa y
    // miden otra cosa (el ciclo, no la semana).
    // `daysSince` ya lo calcula `computeAdherence` dentro de su memo, así que
    // aquí no hace falta volver a mirar el reloj durante el render.
    const d = adherenceByClient[selectedClientId]?.daysSince;
    const detailLastStr = d == null ? null
      : d === 0 ? t('dayCard.today')
      : d === 1 ? t('dayCard.yesterday')
      : t('dayCard.daysAgo', { count: d });
    const PERIOD_OPTIONS = [
      { id: '7d',  label: t('clients.period.7d') },
      { id: '30d', label: t('clients.period.30d') },
      { id: 'all', label: t('clients.period.all') },
    ];

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <AppHeader />

        {/* ‹ · nombre · última actividad, todo en una línea */}
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setView('list')} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.detailName} numberOfLines={1}>{selectedClient.name}</Text>
          {detailLastStr && <Text style={styles.detailLast}>{detailLastStr}</Text>}
        </View>

        {/* Tabs */}
        <View style={styles.detailTabs}>
          <SegmentedControl options={TABS} value={activeTab} onChange={setActiveTab} />
        </View>

        {/* ── Tab: Programas ── */}
        {activeTab === 'programs' && (() => {
          const activeProgram    = clientPrograms.find((p) => p.id === selectedClient.activeProgramId) ?? null;
          const previousPrograms = clientPrograms.filter((p) => p.id !== selectedClient.activeProgramId);
          const syncEnabled      = trainerSync.mode !== 'offline' && trainerSync.mode !== null && selectedClient.syncSlotId;

          const uploadProgram = async (programId) => {
            try {
              await uploadProgramToClient(selectedClientId, programId);
              showToast(t('clients.programSent'), 2200, 'success');
            } catch (err) {
              Alert.alert('Error', err.message ?? t('clients.programUploadError'));
            }
          };
          // Abrir la etapa y enviarla en un solo toque: un desbloqueo que se
          // queda sin enviar no desbloquea nada. Arrastra las ediciones que
          // hubiera pendientes en ese programa, igual que "Enviar programa".
          const unlockStage = (stageIdx) => unlockClientStage(selectedClientId, stageIdx);
          const confirmDelete = (program) => Alert.alert(
            t('clients.deleteProgramTitle'),
            t('clients.deleteProgramConfirm', { name: program.name }),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('clients.menuDelete'), style: 'destructive', onPress: () => deleteProgram(program.id, false) },
            ],
          );
          // Reactivating an archived program replaces the active one (the model
          // keeps exactly one active) — confirm before the swap.
          const reactivate = (program) => Alert.alert(
            t('clients.reactivateTitle'),
            t('clients.reactivateConfirm', { name: program.name }),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('clients.menuReactivate'), onPress: async () => {
                  setClientActiveProgram(selectedClientId, program.id);
                  if (syncEnabled) await uploadProgram(program.id);
                } },
            ],
          );

          return (
            <ScrollView contentContainerStyle={[styles.programTabContent, { paddingBottom: insets.bottom + spacing.xxl }]}>
              {/* Cliente recién creado: lo primero es darle el código. Se retira
                  solo cuando el cliente lo ha canjeado (`syncLinked`), y a
                  partir de ahí el código vive únicamente en Info. */}
              {!selectedClient.syncLinked && !selectedClient.codeHintDismissed && (
                <View style={{ marginBottom: spacing.md }}>
                  <ClientCodeBlock
                    client={selectedClient}
                    showToast={showToast}
                    onDismiss={() => updateClientInfo(selectedClientId, { codeHintDismissed: true })}
                  />
                </View>
              )}

              {activeProgram ? (
                <AssignedProgramCard
                  program={activeProgram}
                  getEffectiveTemplate={getEffectiveTemplate}
                  allExercises={allExercises}
                  adherence={adherenceByClient[selectedClientId]}
                  adherence4w={clientAdherencePct}
                  loadPct={clientLoadPct}
                  dirty={selectedClient.programDirty ?? false}
                  progress={selectedClient.progress}
                  archivedCount={previousPrograms.length}
                  onView={() => setPrintingProgram(activeProgram.id)}
                  onEdit={() => setEditingProgram(activeProgram.id)}
                  onUpload={syncEnabled ? () => uploadProgram(activeProgram.id) : undefined}
                  onPrescribe={() => navigation.navigate('NextSession', { clientId: selectedClientId })}
                  onShare={() => shareSpecificProgram(activeProgram.id, true)}
                  onExport={() => exportSpecificProgram(activeProgram.id, true)}
                  onImport={handleImportPick}
                  onNewProgram={() => setShowNewProgram(true)}
                  onDeassign={() => setClientActiveProgram(selectedClientId, null)}
                  onDelete={() => confirmDelete(activeProgram)}
                  onUnlock={unlockStage}
                  onPlanStages={() => navigation.navigate('StagePlanner', { programId: activeProgram.id })}
                  // Dos `Modal` de RN no se relevan bien en el mismo tick: el
                  // segundo se monta mientras el primero aún se está cerrando y
                  // en Android se queda sin presentar. Se abre al terminar.
                  onShowArchived={() => setTimeout(() => setShowPrevious(true), 250)}
                />
              ) : (
                <View style={styles.noActiveBox}>
                  <Text style={styles.noActiveTitle}>{t('clients.noActiveProgram')}</Text>
                  <Text style={styles.noActiveSub}>
                    {clientPrograms.length === 0 ? t('clients.noProgramsHint') : t('clients.noActiveProgramHint')}
                  </Text>
                  <TouchableOpacity style={[styles.apBtn, { marginTop: spacing.sm }]} onPress={() => setShowNewProgram(true)} activeOpacity={0.85}>
                    <Text style={styles.apBtnGlyph}>+</Text>
                    <Text style={styles.apBtnText}>{t('clients.menuNewProgram')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Programas anteriores — fuera de la vista, en su propia hoja:
                  se consultan de higos a brevas y aquí solo estorbaban. */}
              <DragSheet
                visible={showPrevious}
                onClose={() => setShowPrevious(false)}
                title={t('clients.menuArchived')}
              >
                <View style={styles.sheetBody}>
                  {previousPrograms.length === 0 ? (
                    <Text style={styles.noActiveSub}>{t('clients.noArchivedPrograms')}</Text>
                  ) : previousPrograms.map((program) => (
                    <ArchivedProgramRow
                      key={program.id}
                      program={program}
                      lastActivity={getLastActivity(program)}
                      sessionCount={getSessionCount(program)}
                      onView={() => { setShowPrevious(false); setPrintingProgram(program.id); }}
                      onExport={() => exportSpecificProgram(program.id, true)}
                      onReactivate={() => { setShowPrevious(false); reactivate(program); }}
                      onDelete={() => { setShowPrevious(false); confirmDelete(program); }}
                    />
                  ))}
                </View>
              </DragSheet>
            </ScrollView>
          );
        })()}

        {/* ── Tab: Historial ── */}
        {activeTab === 'history' && (
          <ScrollView
            contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + spacing.xxl }]}
            refreshControl={selectedClient?.syncSlotId ? (
              <RefreshControl
                refreshing={refreshingHistory}
                onRefresh={handleRefreshHistory}
                tintColor={th.colors.accent}
                colors={[th.colors.accent]}
              />
            ) : undefined}
          >
            {/* Filtros — mismo control que el historial propio. Apilados y no en
                una fila: "Todos los programas" y "30 días" no caben a media
                anchura sin truncarse. */}
            <View style={styles.histFilterRow}>
              <SegmentedControl
                options={[
                  { id: 'active', label: t('clients.scope.active') },
                  { id: 'all',    label: t('clients.scope.all')    },
                ]}
                value={scopeFilter}
                onChange={setScopeFilter}
              />
              <SegmentedControl options={PERIOD_OPTIONS} value={periodFilter} onChange={setPeriodFilter} />
            </View>

            {filteredLog.length === 0 ? (
              <Text style={styles.emptyText}>{t('clients.noSessionsFilter')}</Text>
            ) : filteredLog.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onDelete={(id) => deleteClientLogEntry(selectedClientId, id)}
                volumeDelta={clientDeltas.get(session.id) ?? null}
              />
            ))}
          </ScrollView>
        )}

        {/* ── Tab: Progresión ── */}
        {activeTab === 'progress' && (
          <ProgressPanel
            baseLog={clientBaseLog}
            programTemplateIds={activeClientTemplateIds}
            allExercises={allExercises}
            onRefresh={selectedClient?.syncSlotId ? handleRefreshHistory : undefined}
            refreshing={refreshingHistory}
          />
        )}

        {/* ── Tab: Info ── */}
        {activeTab === 'info' && (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
              keyboardShouldPersistTaps="handled"
            >
              {/* El código de conexión vive aquí de forma permanente (en el tab
                  de Programa solo aparece mientras el cliente no lo ha canjeado). */}
              <View style={styles.infoCodeWrap}>
                <ClientCodeBlock client={selectedClient} showToast={showToast} />
              </View>

              {/* ── Estado ── */}
              <Accordion
                label="Estado"
                open={openSections.status}
                onToggle={() => setOpenSections((s) => ({ ...s, status: !s.status }))}
              >
                {/* Status buttons */}
                <View style={{ marginBottom: spacing.md }}>
                  <View style={styles.statusRow}>
                    {[
                      { id: 'active',   label: t('clients.statusActive'),   color: th.colors.green },
                      { id: 'paused',   label: t('clients.statusPaused'),   color: th.colors.orange },
                      { id: 'inactive', label: t('clients.statusInactive'), color: th.colors.red },
                    ].map(({ id, label, color }) => {
                      const isSel = (selectedClient.status ?? 'active') === id;
                      return (
                        <TouchableOpacity
                          key={id}
                          style={[styles.statusBtn, { borderColor: isSel ? color : th.colors.border, backgroundColor: isSel ? `${color}18` : th.colors.surface2 }]}
                          onPress={() => updateClientInfo(selectedClientId, { status: id })}
                        >
                          {isSel && <View style={[styles.statusDot, { backgroundColor: color }]} />}
                          <Text style={[styles.statusBtnText, { color: isSel ? color : th.colors.muted }]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Tags */}
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={styles.fieldLabel}>ETIQUETAS</Text>
                  {allTags.length > 0 && (
                    <View style={[styles.cTagRow, { marginBottom: spacing.sm }]}>
                      {allTags.map(({ id, name }) => {
                        const active = (selectedClient.tags ?? []).includes(id);
                        return (
                          <TouchableOpacity
                            key={id}
                            style={[styles.cTagSelectable, active && styles.cTagSelectableActive]}
                            onPress={() => {
                              const current = selectedClient.tags ?? [];
                              updateClientInfo(selectedClientId, {
                                tags: active ? current.filter((tid) => tid !== id) : [...current, id],
                              });
                            }}
                            activeOpacity={0.7}
                          >
                            {active && <Text style={styles.cTagSelectableTick}>✓ </Text>}
                            <Text style={[styles.cTagSelectableText, active && styles.cTagSelectableTextActive]}>
                              {name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  {/* Inline create (escape hatch) */}
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Crear nueva etiqueta…"
                      placeholderTextColor={th.colors.muted}
                      value={newTag}
                      onChangeText={setNewTag}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        const t = newTag.trim();
                        if (!t || allTags.some((tag) => tag.name.toLowerCase() === t.toLowerCase())) { setNewTag(''); return; }
                        const newId = createTag(t);
                        updateClientInfo(selectedClientId, { tags: [...(selectedClient.tags ?? []), newId] });
                        setNewTag('');
                      }}
                    />
                    <AccentBtn
                      label="＋"
                      small
                      disabled={!newTag.trim()}
                      onPress={() => {
                        const t = newTag.trim();
                        if (!t || allTags.some((tag) => tag.name.toLowerCase() === t.toLowerCase())) { setNewTag(''); return; }
                        const newId = createTag(t);
                        updateClientInfo(selectedClientId, { tags: [...(selectedClient.tags ?? []), newId] });
                        setNewTag('');
                      }}
                    />
                  </View>
                  <Text style={styles.fieldHint}>Toca para asignar · Escribe para crear nueva</Text>
                </View>
              </Accordion>

              {/* ── Personal data ── */}
              <Accordion
                label="Datos personales"
                open={openSections.personal}
                onToggle={() => setOpenSections((s) => ({ ...s, personal: !s.personal }))}
              >
                {/* Fields */}
                {[
                  { key: 'name',     label: t('clients.fieldNameAlias'),                       placeholder: 'Lucas' },
                  { key: 'fullName', label: t('clients.fieldFullName').toUpperCase(),          placeholder: 'Lucas García Martínez' },
                  { key: 'phone',    label: 'TELÉFONO',         placeholder: '+34 600 000 000' },
                  { key: 'email',    label: 'EMAIL',            placeholder: 'lucas@email.com' },
                ].map(({ key, label, placeholder }) => (
                  <View key={key} style={{ marginBottom: spacing.sm }}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={placeholder}
                      placeholderTextColor={th.colors.muted}
                      defaultValue={selectedClient[key] ?? ''}
                      onEndEditing={(e) => updateClientInfo(selectedClientId, { [key]: e.nativeEvent.text })}
                      returnKeyType="done"
                    />
                  </View>
                ))}

                {/* Notes */}
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={styles.fieldLabel}>NOTAS</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                    placeholder="Notas sobre el cliente…"
                    placeholderTextColor={th.colors.muted}
                    multiline
                    defaultValue={selectedClient.notes ?? ''}
                    onEndEditing={(e) => updateClientInfo(selectedClientId, { notes: e.nativeEvent.text })}
                  />
                  <Text style={styles.fieldHint}>Se guarda al perder el foco</Text>
                </View>
              </Accordion>

              {/* ── Body weight ── */}
              <Accordion
                label="Peso corporal"
                open={openSections.weight}
                onToggle={() => setOpenSections((s) => ({ ...s, weight: !s.weight }))}
              >
                <View style={styles.addRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Fecha (AAAA-MM-DD)"
                    placeholderTextColor={th.colors.muted}
                    value={weightDate}
                    onChangeText={setWeightDate}
                    returnKeyType="next"
                  />
                  <TextInput
                    style={[styles.input, { width: 80, textAlign: 'center' }]}
                    placeholder="Peso"
                    placeholderTextColor={th.colors.muted}
                    keyboardType="decimal-pad"
                    value={weightValue}
                    onChangeText={setWeightValue}
                    returnKeyType="done"
                    onSubmitEditing={handleAddWeight}
                  />
                  <AccentBtn label="＋" onPress={handleAddWeight} disabled={!weightValue} small />
                </View>
                {(selectedClient.bodyWeight ?? []).length === 0 ? (
                  <Text style={styles.emptyText}>Sin datos de peso</Text>
                ) : (
                  <View style={styles.weightList}>
                    {[...(selectedClient.bodyWeight ?? [])].reverse().map((entry) => (
                      <View key={entry.date} style={styles.weightRow}>
                        <Text style={styles.weightDate}>{entry.date}</Text>
                        <Text style={styles.weightVal}>{entry.weight} kg</Text>
                        <TouchableOpacity onPress={() => removeClientBodyWeight(selectedClientId, entry.date)} hitSlop={8}>
                          <Text style={styles.deleteIcon}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </Accordion>

              {/* ── Billing ── */}
              <Accordion
                label="Facturación"
                open={openSections.billing}
                onToggle={() => setOpenSections((s) => ({ ...s, billing: !s.billing }))}
              >
                {(selectedClient.billing ?? []).length > 0 && (() => {
                  const total   = (selectedClient.billing ?? []).reduce((a, b) => a + (b.amount ?? 0), 0);
                  const paid    = (selectedClient.billing ?? []).filter((b) => b.status === 'paid').reduce((a, b) => a + (b.amount ?? 0), 0);
                  return (
                    <View style={[styles.billingRow, { marginBottom: spacing.md }]}>
                      {[
                        { label: 'FACTURADO', value: `${total.toFixed(2)}€`,         color: th.colors.text },
                        { label: 'RECIBIDO',  value: `${paid.toFixed(2)}€`,          color: th.colors.green },
                        { label: 'PENDIENTE', value: `${(total - paid).toFixed(2)}€`, color: (total - paid) > 0 ? th.colors.orange : th.colors.muted },
                      ].map(({ label, value, color }) => (
                        <View key={label} style={styles.billingTile}>
                          <Text style={styles.billingTileLabel}>{label}</Text>
                          <Text style={[styles.billingTileValue, { color }]}>{value}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {/* Add entry */}
                <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Fecha (AAAA-MM-DD)"
                      placeholderTextColor={th.colors.muted}
                      value={billDate}
                      onChangeText={setBillDate}
                      returnKeyType="next"
                    />
                    <TextInput
                      style={[styles.input, { width: 90, textAlign: 'center' }]}
                      placeholder="0.00"
                      placeholderTextColor={th.colors.muted}
                      keyboardType="decimal-pad"
                      value={billAmount}
                      onChangeText={setBillAmount}
                      returnKeyType="next"
                    />
                  </View>
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Concepto"
                      placeholderTextColor={th.colors.muted}
                      value={billConcept}
                      onChangeText={setBillConcept}
                      returnKeyType="done"
                      onSubmitEditing={handleAddBilling}
                    />
                    <TouchableOpacity
                      style={[styles.billStatusBtnForm, billStatus === 'paid' && styles.billStatusBtnPaid]}
                      onPress={() => setBillStatus((s) => s === 'paid' ? 'pending' : 'paid')}
                    >
                      <Text style={[styles.billStatusText, billStatus === 'paid' && styles.billStatusTextPaid]}>
                        {billStatus === 'paid' ? t('clients.billPaid') : t('clients.billPending')}
                      </Text>
                    </TouchableOpacity>
                    <AccentBtn label="＋" onPress={handleAddBilling} disabled={!billConcept.trim() || !billAmount} small />
                  </View>
                </View>

                {(selectedClient.billing ?? []).length === 0 ? (
                  <Text style={styles.emptyText}>Sin entradas de facturación</Text>
                ) : (
                  <View style={styles.weightList}>
                    {(selectedClient.billing ?? []).map((entry) => (
                      <View key={entry.id} style={[styles.billEntry, { marginBottom: 0 }]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.billConcept} numberOfLines={1}>{entry.concept}</Text>
                          <Text style={styles.billDate}>{entry.date}</Text>
                        </View>
                        <Text style={styles.billAmount}>{entry.amount?.toFixed(2)}€</Text>
                        <TouchableOpacity
                          style={[styles.billStatusBtn, entry.status === 'paid' && styles.billStatusBtnPaid]}
                          onPress={() => updateClientBillingStatus(selectedClientId, entry.id, entry.status === 'paid' ? 'pending' : 'paid')}
                        >
                          <Text style={[styles.billStatusText, entry.status === 'paid' && styles.billStatusTextPaid]}>
                            {entry.status === 'paid' ? t('clients.billPaid') : t('clients.billPending')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => Alert.alert('Eliminar entrada', '¿Eliminar esta entrada de facturación?', [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Eliminar', style: 'destructive', onPress: () => removeClientBilling(selectedClientId, entry.id) },
                        ])} hitSlop={8}>
                          <Text style={styles.deleteIcon}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </Accordion>

              {/* ── Danger zone ── */}
              <TouchableOpacity
                style={styles.deleteClientBtn}
                onPress={() => handleDeleteClient(selectedClientId)}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteClientBtnText}>{t('clients.deleteClientTitle')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* New program modal */}
        {showNewProgram && (
          <NewProgramModal
            templatePrograms={templatePrograms}
            onCreateBlank={handleCreateProgram}
            onCreateFromTemplate={handleCreateFromTemplate}
            onClose={() => setShowNewProgram(false)}
          />
        )}

        {/* Import modal */}
        {importState && (
          <ClientImportModal
            fileName={importState.fileName}
            parsedData={importState.parsedData}
            onImport={handleImport}
            onClose={() => setImportState(null)}
          />
        )}
      </View>
    );
  }

  // ── Client list ────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />

      {/* ── List header ── */}
      <View style={styles.listHeader}>

        {/* Row 1: Title "CLIENTES N" · trainer tools (€ billing · cloud sync) · + Cliente */}
        <View style={styles.listTitleRow}>
          <Text style={styles.listTitle} numberOfLines={1}>
            CLIENTES <Text style={styles.listTitleDot}>·</Text> <Text style={styles.listTitleCount}>{clientCounts.total}</Text>
          </Text>
          <View style={styles.hdrRightCluster}>
            <View style={styles.hdrIconGroup}>
              {/* Billing (€) */}
              <TouchableOpacity style={styles.hdrIconBox} onPress={() => setView('billing')} activeOpacity={0.7}>
                {/* € dibujado, no el glifo: Figma pone aquí la "€" de Inter,
                    pero al lado de la nube (icono de trazo) cantaba. Mismo
                    tamaño y grosor que ella. */}
                <Svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke={th.colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M4 10h12M4 14h9M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2" />
                </Svg>
              </TouchableOpacity>
              {/* Connectivity — status dot: green = sync on, orange = not set up, grey = offline */}
              <TouchableOpacity style={styles.hdrIconBox} onPress={() => setShowSyncModal(true)} activeOpacity={0.7}>
                <Svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke={th.colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                </Svg>
                <View style={[
                  styles.syncStatusDot,
                  {
                    backgroundColor:
                      trainerSync.mode === 'google' || trainerSync.mode === 'code' ? th.colors.green
                      : trainerSync.mode === 'offline' ? th.colors.muted2
                      : th.colors.orange,
                  },
                ]} />
              </TouchableOpacity>
            </View>
            {/* New client */}
            <TouchableOpacity style={styles.hdrNewBtn} onPress={() => setShowNewClient(true)} activeOpacity={0.85}>
              <Text style={styles.hdrNewBtnText}>{t('clients.newBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2: Search + Filters */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Svg viewBox="0 0 24 24" width={17} height={17} fill="none"
              stroke={th.colors.mutedLight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35" />
            </Svg>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar cliente…"
              placeholderTextColor={th.colors.mutedLight}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8} style={styles.searchClearBtn}>
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filter sheet button — badge shows how many filters are applied */}
          <TouchableOpacity
            style={[styles.hdrIconBox, activeFilterCount > 0 && styles.searchSideBtnActive]}
            onPress={() => setShowFilterSheet(true)}
            activeOpacity={0.7}
          >
            <Svg viewBox="0 0 24 24" width={20} height={20} fill="none"
              stroke={activeFilterCount > 0 ? th.colors.accent : th.colors.text}
              strokeWidth={2} strokeLinecap="round">
              <Path d="M3 6h18M6 12h12M9 18h6" />
            </Svg>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Row 3 — conditional: attention pills + applied filters. Hidden when
            there's nothing to show, so the default state is two clean rows. */}
        {(atRiskCount > 0 || unreviewedCount > 0 || tagFilter.length > 0) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            keyboardShouldPersistTaps="handled"
          >
            {/* Attention pills — ephemeral: only when there's something to act on */}
            {atRiskCount > 0 && (
              <AttentionPill
                label={t('clients.atRiskPill')}
                count={atRiskCount}
                color={th.colors.red}
                active={adherenceFilter === 'at_risk'}
                onPress={() => setAdherenceFilter((f) => (f === 'at_risk' ? null : 'at_risk'))}
              />
            )}
            {unreviewedCount > 0 && (
              <AttentionPill
                label={t('clients.unreviewedPill')}
                count={unreviewedCount}
                color={th.colors.accent}
                active={adherenceFilter === 'unreviewed'}
                onPress={() => setAdherenceFilter((f) => (f === 'unreviewed' ? null : 'unreviewed'))}
              />
            )}

            {/* Applied tag filters. El estado (Todos/Inactivos) NO pinta pill:
                es una vista del segmentado, igual que el orden. */}
            {tagFilter.map((id) => {
              const tagName = allTags.find((tg) => tg.id === id)?.name;
              if (!tagName) return null;
              return (
                <View key={id} style={styles.tagRowPill}>
                  <Text style={styles.tagRowPillText}>{tagName}</Text>
                  <TouchableOpacity onPress={() => toggleTagFilter(id)} hitSlop={8} activeOpacity={0.7}>
                    <Text style={styles.tagRowPillX}>×</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}

      </View>

      {/* Global pending-uploads banner — between filters and the card list.
          Al enviarlo todo, `pendingClients` se vacía y el aviso se desmonta: sale
          hacia arriba y, cuando termina, el `layout` del bloque de la lista la
          sube deslizando en vez de dar el salto. */}
      {pendingClients.length > 0 && (
        <Reanimated.View style={styles.pendingBanner} exiting={FadeOutUp.duration(220)}>
          <CloudUpIcon size={19} color={th.colors.blue} />
          {/* Titular corto y fijo: la frase larga no cabía en la columna que deja
              el botón, y el detalle (a cuántos y de qué) se lee mejor abajo. */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.pendingTitle} numberOfLines={1}>
              {t('clients.pendingTitle')}
            </Text>
            <Text style={styles.pendingSub} numberOfLines={2}>
              {[
                t('clients.pendingClientsCount', { count: pendingClients.length }),
                pendingOverrideCount ? t('clients.pendingPrescriptions', { count: pendingOverrideCount }) : null,
                pendingProgramCount  ? t('clients.pendingPrograms',      { count: pendingProgramCount })  : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.pendingBtn, sendingAll && { opacity: 0.6 }]}
            onPress={sendAllPending}
            disabled={sendingAll}
            activeOpacity={0.85}
          >
            <Text style={styles.pendingBtnText}>{sendingAll ? t('clients.sending') : t('clients.sendAll')}</Text>
          </TouchableOpacity>
        </Reanimated.View>
      )}

      {/* Client list */}
      <Reanimated.View style={{ flex: 1 }} layout={LinearTransition.duration(240)}>
      {clientList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyBody}>
            {search ? t('clients.noResults') : t('clients.noClientsEmpty')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={clientList}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xxl + insets.bottom }}
          refreshControl={
            <RefreshControl
              refreshing={refreshingList}
              onRefresh={handleRefreshList}
              tintColor={th.colors.accent}
              colors={[th.colors.accent]}
            />
          }
          renderItem={({ item: client }) => {
            const activeProgram   = programs[client.activeProgramId];
            const isConnected     = trainerSync.mode !== 'offline' && trainerSync.mode !== null && !!client.syncSlotId;
            // Last activity across the client's separated history
            const clientSessions  = clientLogs[client.id] ?? [];
            const lastActivityTs  = clientSessions.length ? Math.max(...clientSessions.map((e) => e.timestamp)) : null;

            return (
              <>
                <ClientListCard
                  client={client}
                  activeProgram={activeProgram}
                  lastActivityTs={lastActivityTs}
                  isConnected={isConnected}
                  adherence={adherenceByClient[client.id]}
                  newSessionsCount={getNewSessionsCount(client.id)}
                  onPress={() => handleSelectClient(client.id)}
                  onOpenEditor={() => {
                    if (client.activeProgramId) setEditingProgram(client.activeProgramId);
                    else handleSelectClient(client.id);
                  }}
                  onViewProgress={() => handleSelectClientProgress(client.id)}
                  onUploadProgram={async () => {
                    if (!client.activeProgramId) return;
                    try {
                      await uploadProgramToClient(client.id, client.activeProgramId);
                      showToast('Programa enviado', 2200, 'success');
                    } catch (err) {
                      Alert.alert('Error', err.message ?? 'No se pudo subir el programa.');
                    }
                  }}
                  onOpenActions={() => setActionsClientId(client.id)}
                  onSendOverrides={async () => {
                    try {
                      await sendOverrides(client.id);
                      showToast(t('clients.overrideSent'), 2200, 'success');
                    } catch (err) {
                      Alert.alert('Error', err.message ?? t('clients.overrideSendFailed'));
                    }
                  }}
                  onUnlockStage={(stageIdx) => unlockClientStage(client.id, stageIdx)}
                  onPlanStages={() => navigation.navigate('StagePlanner', { programId: client.activeProgramId })}
                />
                {infoSheetClientId === client.id && (
                  <ClientInfoSheet
                    client={client}
                    onClose={() => setInfoSheetClientId(null)}
                    onConnectCloud={() => connectClientToCloud(client.id)}
                  />
                )}
              </>
            );
          }}
        />
      )}
      </Reanimated.View>

      {/* Client actions sheet (pulsación larga sobre la tarjeta) */}
      {actionsClientId && clients[actionsClientId] && (
        <ClientActionsSheet
          client={clients[actionsClientId]}
          newSessionsCount={getNewSessionsCount(actionsClientId)}
          onClose={() => setActionsClientId(null)}
          onProgress={() => handleSelectClientProgress(actionsClientId)}
          onNextSession={() => navigation.navigate('NextSession', { clientId: actionsClientId })}
          onEditProgram={() => {
            const c = clients[actionsClientId];
            if (c?.activeProgramId) setEditingProgram(c.activeProgramId);
            else handleSelectClient(actionsClientId);
          }}
          onInfo={() => handleSelectClientInfo(actionsClientId)}
        />
      )}

      {/* Trainer sync mode modal */}
      <TrainerSyncModal
        visible={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        isFirstTime={isFirstTimeSync}
      />

      {/* Unified filter sheet: status + sort + tags */}
      <DragSheet
        visible={showFilterSheet}
        onClose={() => { setShowFilterSheet(false); setTagSearchText(''); }}
        title={t('clients.filterSheet.title')}
      >
        <View style={styles.filterSheetBody}>

          {/* Estado — segmented control (mismo componente que el resto de la app) */}
          <View>
            <Text style={styles.filterSecTitle}>{t('clients.filterSheet.status')}</Text>
            <SegmentedControl
              options={[
                { id: 'all',      label: t('clients.filterSheet.statusAll') },
                { id: 'active',   label: t('clients.filterSheet.statusActive') },
                { id: 'inactive', label: t('clients.filterSheet.statusInactive') },
              ]}
              value={statusFilter}
              onChange={(id) => { setAdherenceFilter(null); setStatusFilter(id); }}
            />
          </View>

          {/* Orden — segmented control */}
          <View>
            <Text style={styles.filterSecTitle}>{t('clients.filterSheet.sort')}</Text>
            <SegmentedControl
              options={[
                { id: 'recent', label: t('clients.filterSheet.sortRecent') },
                { id: 'idle',   label: t('clients.filterSheet.sortIdle') },
                { id: 'name',   label: t('clients.filterSheet.sortName') },
              ]}
              value={sortMode}
              onChange={setSortMode}
            />
          </View>

          {/* Etiquetas — selección + gestión inline (crear, renombrar, borrar) */}
          <View>
            <Text style={styles.filterSecTitle}>{t('clients.filterSheet.tags')}</Text>

            {/* Buscador + botón "+" (mismo estilo que el buscador de la pantalla) */}
            <View style={styles.tagSearchRow}>
              <View style={styles.searchInputWrap}>
                <Svg viewBox="0 0 24 24" width={17} height={17} fill="none"
                  stroke={th.colors.mutedLight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35" />
                </Svg>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar etiqueta…"
                  placeholderTextColor={th.colors.mutedLight}
                  value={tagSearchText}
                  onChangeText={setTagSearchText}
                  returnKeyType="search"
                />
              </View>
              {(() => {
                const addDisabled =
                  !tagSearchText.trim() ||
                  allTags.some((tg) => tg.name.toLowerCase() === tagSearchText.trim().toLowerCase());
                return (
                  <TouchableOpacity
                    style={[styles.tagAddBtn, addDisabled && { opacity: 0.4 }]}
                    disabled={addDisabled}
                    activeOpacity={0.85}
                    onPress={() => {
                      const name = tagSearchText.trim();
                      if (!name) return;
                      const newId = createTag(name);
                      setTagFilter((prev) => [...prev, newId]);
                      setTagSearchText('');
                    }}
                  >
                    <Text style={styles.tagAddBtnText}>+</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>

            {/* Lista de etiquetas — mismo estilo de listed-items que el dropdown
                de "filtrar ejercicios" de Progress (sin ser un dropdown) */}
            {(() => {
              const filtered = tagSearchText.trim()
                ? allTags.filter((tg) => tg.name.toLowerCase().includes(tagSearchText.toLowerCase()))
                : allTags;
              if (filtered.length === 0) {
                return (
                  <Text style={styles.tagEmptyText}>
                    {tagSearchText.trim()
                      ? 'Sin resultados — crea la etiqueta con +'
                      : 'Sin etiquetas. Escribe un nombre y pulsa +'}
                  </Text>
                );
              }
              return (
                <View style={styles.tagListBox}>
                  {filtered.map(({ id, name }) => {
                    const selected   = tagFilter.includes(id);
                    const isRenaming = tagRenameId === id;
                    const usedBy = Object.values(clients ?? {}).filter((c) => (c.tags ?? []).includes(id)).length;

                    if (isRenaming) {
                      const commitRename = () => {
                        const trimmed = tagRenameText.trim();
                        if (trimmed) renameTag(id, trimmed);
                        setTagRenameId(null);
                      };
                      return (
                        <View key={id} style={styles.dropItem}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={tagRenameText}
                            onChangeText={setTagRenameText}
                            autoFocus
                            returnKeyType="done"
                            onSubmitEditing={commitRename}
                          />
                          <TouchableOpacity style={styles.tagActionBtn} onPress={commitRename} hitSlop={8}>
                            <Text style={[styles.tagActionText, { color: th.colors.accent }]}>✓</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.tagActionBtn} onPress={() => setTagRenameId(null)} hitSlop={8}>
                            <Text style={styles.tagActionText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    }

                    return (
                      <View key={id} style={[styles.dropItem, selected && styles.dropItemSel]}>
                        <TouchableOpacity
                          style={styles.tagSelectArea}
                          onPress={() => toggleTagFilter(id)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.dropCheck, selected && styles.dropCheckActive]}>
                            {selected && <Text style={styles.dropCheckMark}>✓</Text>}
                          </View>
                          <Text style={[styles.dropItemText, selected && styles.dropItemTextSel]} numberOfLines={1}>{name}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.tagActionBtn}
                          onPress={() => { setTagRenameId(id); setTagRenameText(name); }}
                          hitSlop={8}
                        >
                          <Text style={styles.tagActionText}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.tagActionBtn}
                          onPress={() => {
                            if (usedBy === 0) { deleteTag(id); return; }
                            Alert.alert(
                              t('clients.deleteTagTitle'),
                              t('clients.deleteTagConfirm', { name, count: usedBy }),
                              [
                                { text: t('common.cancel'), style: 'cancel' },
                                { text: t('common.delete'), style: 'destructive', onPress: () => deleteTag(id) },
                              ]
                            );
                          }}
                          hitSlop={8}
                        >
                          <Text style={[styles.tagActionText, { color: th.colors.red }]}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>

          {/* Limpiar — siempre presente (altura constante); deshabilitado cuando
              no hay nada que limpiar, para que el modal no cambie de tamaño */}
          {(() => {
            const canClear = activeFilterCount > 0 || sortMode !== 'recent';
            return (
              <TouchableOpacity
                style={[styles.filterClearBtn, !canClear && { opacity: 0.4 }]}
                disabled={!canClear}
                onPress={clearFilters}
                activeOpacity={0.7}
              >
                <Text style={styles.filterClearBtnText}>{t('clients.filterSheet.clear')}</Text>
              </TouchableOpacity>
            );
          })()}

        </View>
      </DragSheet>

      {/* New client modal */}
      <Modal visible={showNewClient} transparent animationType="fade" onRequestClose={() => setShowNewClient(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowNewClient(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>NUEVO CLIENTE</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del cliente"
              placeholderTextColor={th.colors.muted}
              value={newClientName}
              onChangeText={setNewClientName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateClient}
            />
            <View style={styles.modalActions}>
              <GhostBtn label="Cancelar" onPress={() => setShowNewClient(false)} />
              <AccentBtn label="CREAR" onPress={handleCreateClient} disabled={!newClientName.trim()} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },

  // ── List header ──
  // Figma: sin divisoria, gap space/sm entre las dos filas
  listHeader: {
    paddingTop: spacing.lg,
    gap:        spacing.sm,
  },

  // Row 1: "CLIENTES N" + cluster de acciones (justify-between)
  listTitleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
  },
  // "CLIENTES" en color texto, el contador en accent (mismo tamaño hero)
  listTitle: {
    ...textStyles.hero,
    color:      th.colors.text,
    flexShrink: 1,
  },
  listTitleDot: {
    color: th.colors.mutedLight,
  },
  listTitleCount: {
    color: th.colors.accent,
  },
  // Cluster derecho: [€ · cloud] (gap 6) --10-- [+ Cliente]
  hdrRightCluster: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  hdrIconGroup: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  // Caja de icono cuadrada: surface2, radius/sm, sin borde. 42×42 (a juego
  // con la altura de la caja de búsqueda, por petición del usuario — Figma
  // usaba 35, ampliado deliberadamente para uniformar todos los controles)
  hdrIconBox: {
    width:           42,
    height:          42,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  hdrNewBtn: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.md,
    height:            42,
    alignItems:        'center',
    justifyContent:    'center',
  },
  hdrNewBtnText: {
    ...textStyles.cardType,
    color: th.colors.onAccent,
  },
  // Connectivity status dot (on the cloud icon button)
  syncStatusDot: {
    position:     'absolute',
    top:          5,
    right:        5,
    width:        7,
    height:       7,
    borderRadius: 4,
    borderWidth:  1.5,
    borderColor:  th.colors.surface2,
  },
  // Filter button badge (nº of applied filters)
  filterBadge: {
    position:        'absolute',
    top:             3,
    right:           3,
    minWidth:        14,
    height:          14,
    borderRadius:    7,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontSize:   9,
    fontWeight: typography.heavy,
    color:      th.colors.onAccent,
  },
  // Unified filter sheet
  filterSheetBody: {
    gap:           spacing.lg,
    paddingBottom: spacing.sm,
  },
  filterSecTitle: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.mutedLight,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  tagSearchRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  // Botón "+" cuadrado a juego con la barra de búsqueda (42×42, accent)
  tagAddBtn: {
    width:           42,
    height:          42,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  tagAddBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize:   24,
    lineHeight: 26,
    color:      th.colors.onAccent,
  },
  // Lista de etiquetas — mismo listed-item que el dropdown de Progress, pero
  // sin fondo (más legible sobre la superficie del sheet)
  tagListBox: {
    marginTop:    spacing.sm,
    borderRadius: th.radius.sm,
    overflow:     'hidden',
  },
  dropItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    gap:               spacing.sm,
  },
  dropItemSel: { backgroundColor: withOpacity(th.colors.accent, 0.10) },
  dropCheck: {
    width: 18, height: 18, borderRadius: th.radius.xs,
    borderWidth: borders.thin, borderColor: th.colors.text,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dropCheckActive: { backgroundColor: th.colors.accent, borderColor: th.colors.accent },
  dropCheckMark:   { ...textStyles.tag, color: th.colors.onAccent, fontWeight: '900' },
  dropItemText:    { flex: 1, ...textStyles.subtitle, color: th.colors.text },
  dropItemTextSel: { color: th.colors.text },
  tagEmptyText: {
    ...textStyles.subtitle,
    color:     th.colors.mutedLight,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tagActionBtn: {
    padding: spacing.xs,
  },
  tagActionText: {
    fontSize: 14,
    color:    th.colors.mutedLight,
  },
  tagSelectArea: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  filterClearBtn: {
    paddingVertical: spacing.sm + 2,
    borderRadius:    th.radius.md,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    alignItems:      'center',
  },
  filterClearBtnText: {
    fontSize: typography.sm,
    color:    th.colors.muted,
  },
  // Row 2: Search + Filter (gap space/sm)
  searchRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop:         spacing.xs2, // ligero aire extra respecto a la fila de título (gap base = listHeader.gap)
  },
  // Estado activo del botón de filtro (funcionalidad app, no en Figma):
  // tinte accent sobre la caja surface2 base
  searchSideBtnActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.10),
  },
  // Search bar (Figma "Bars/Search"): surface2, radius/sm, px lg, sin borde.
  // Altura fija 42 = misma que las cajas de icono, para que todos los
  // controles del header queden a la misma altura.
  searchInputWrap: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.lg,
    height:            42,
  },
  searchInput: {
    flex:    1,
    padding: 0,
    ...textStyles.subtitle,
    color:   th.colors.text,
  },
  // Botón "✕" para limpiar el texto del buscador (aparece al escribir)
  searchClearBtn: {
    paddingLeft: spacing.xs2,
  },
  searchClearText: {
    ...textStyles.subtitle,
    color: th.colors.mutedLight,
  },

  // Row 3: Filter pills row. Sin marginTop negativo: el gap con el buscador
  // lo da el `gap` del listHeader (space/sm=6), igual que el que hay entre el
  // buscador y los botones de arriba.
  filterRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom:  spacing.xs,
  },
  // Attention pills (En riesgo / Sin revisar) — misma geometría y tipografía que
  // las pills de etiqueta; lo único propio es el color, que es semántico.
  attnPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      th.radius.sm,
    flexShrink:        0,
  },
  attnPillText: {
    ...textStyles.cardType,
  },
  attnPillBadge: {
    borderRadius:      th.radius.full,
    minWidth:          18,
    height:            18,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.xs2,
    flexShrink:        0,
  },
  attnPillBadgeText: {
    ...textStyles.tag,
    fontFamily: 'Inter_700Bold',
  },
  // Tag pills aplicadas — pill seleccionada del lenguaje nuevo: relleno accent
  // sólido, `radius/sm` y `text/card-type` (igual que las pills de la hoja de
  // filtros del buscador de ejercicios). Sin borde ni variante "inactiva": si
  // está en esta fila, está aplicada.
  tagRowPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      th.radius.sm,
    backgroundColor:   th.colors.accent,
    flexShrink:        0,
  },
  tagRowPillText: {
    ...textStyles.cardType,
    color: th.colors.onAccent,
  },
  tagRowPillX: {
    ...textStyles.cardType,
    color:      th.colors.onAccent,
    lineHeight: 14,
  },

  // Legacy — keep chip styles for compatibility with other views
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      th.radius.full,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    backgroundColor:   th.colors.surface2,
  },
  chipActive: {
    borderColor:     withOpacity(th.colors.accent, 0.4),
    backgroundColor: withOpacity(th.colors.accent, 0.08),
  },
  chipText: {
    fontSize:   typography.sm,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },
  chipTextActive: { color: th.colors.accent },
  chipCountBadge: {
    marginLeft:      4,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.full,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  chipCountText: { fontSize: typography.xs, color: th.colors.muted },
  chipCountBadgeActive: { backgroundColor: withOpacity(th.colors.accent, 0.15) },
  chipCountTextActive: { color: th.colors.accent },

  // ── Tag filter bottom sheet ──
  // ── Tag manager ──

  // (old client card styles removed — replaced by cCard* styles above)

  // ── Empty ──
  emptyState: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         spacing.xxl,
    gap:             spacing.sm,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: {
    fontSize:   typography.md,
    fontWeight: typography.semibold,
    color:      th.colors.text,
  },
  emptyBody: {
    fontSize:    typography.sm,
    color:       th.colors.muted,
    textAlign:   'center',
    lineHeight:  typography.sm * 1.6,
    marginBottom: spacing.lg,
  },
  proBtn: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.sm,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop:       spacing.xs,
  },
  proBtnText: {
    fontSize:   typography.base,
    fontWeight: typography.bold,
    color:      th.colors.bg,
  },
  hideTabBtn: {
    marginTop:         spacing.sm,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
  },
  hideTabBtnText: {
    fontSize:  typography.sm,
    color:     th.colors.muted,
    textAlign: 'center',
  },
  emptyText: {
    fontSize:  typography.sm,
    color:     th.colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },

  // ── Client info sheet ──
  infoSheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      th.colors.bg,
    borderTopLeftRadius:  th.radius.xl,
    borderTopRightRadius: th.radius.xl,
    borderTopWidth:       borders.thin,
    borderTopColor:       th.colors.borderCard,
    paddingHorizontal:    spacing.xl,
    paddingBottom:        spacing.xxl,
    paddingTop:           spacing.sm,
    gap:                  spacing.sm,
  },
  infoSheetHandle: {
    width:           36,
    height:          4,
    backgroundColor: th.colors.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    spacing.sm,
  },
  infoSheetName: {
    fontSize:   typography.md,
    fontWeight: typography.heavy,
    color:      th.colors.text,
    marginBottom: spacing.xs,
  },
  infoCodeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  infoCodeBox: {
    flex:              1,
    backgroundColor:   withOpacity(th.colors.accent, 0.06),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.accent, 0.2),
    borderRadius:      th.radius.md,
    padding:           spacing.md,
    gap:               3,
  },
  infoCodeLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.accent,
    letterSpacing: 1,
  },
  infoCodeText: {
    fontSize:      typography.md,
    fontWeight:    typography.heavy,
    color:         th.colors.text,
    letterSpacing: 3,
  },
  infoCodeSub: {
    fontSize: typography.xs,
    color:    th.colors.muted,
  },
  infoCopyBtn: {
    width:           44,
    height:          44,
    borderRadius:    th.radius.md,
    backgroundColor: withOpacity(th.colors.accent, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.accent, 0.2),
    alignItems:      'center',
    justifyContent:  'center',
  },
  infoCopyBtnText: { fontSize: 20 },
  infoSheetBtnAccent: {
    backgroundColor:   withOpacity(th.colors.accent, 0.08),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.accent, 0.25),
    borderRadius:      th.radius.md,
    alignItems:        'center',
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
  },
  infoSheetBtnTextAccent: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.accent,
  },

  // ── Key tab ───────────────────────────────────────────────────────────────────

  // ── Client list card ──────────────────────────────────────────────────────────
  // El aire va entre el nombre y el bloque de abajo, no dentro de él: la línea
  // de programa/aviso se lee pegada al ritmo, no colgando del nombre.
  cCard: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.md,
  },
  // Línea 1: nombre · racha · Ciclo NN (Figma: gap 6, alineado arriba)
  cTop: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           spacing.sm,
  },
  cName: {
    ...textStyles.cardTitle,
    color:    th.colors.text,
    flex:     1,
    minWidth: 0,
  },
  cStreak: {
    ...textStyles.tag,
    color:      th.colors.mutedLight,
    flexShrink: 0,
  },
  cCycle: {
    ...textStyles.subtitle,
    color:      th.colors.mutedLight,
    flexShrink: 0,
  },
  cCycleNum: {
    ...textStyles.cardType,
    color:       th.colors.text,
    fontVariant: ['tabular-nums'],
  },
  // Aviso global de envíos pendientes. Mismo ancho que el resto de la pantalla
  // (`space/lg`, no `space/xl`) y sin borde: en este tema el relleno tintado ya
  // marca la tarjeta (§4.6). Azul porque va de clientes/entrenador (§4.8).
  pendingBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    marginHorizontal:  spacing.lg,
    marginTop:         spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderRadius:      th.radius.md,
    backgroundColor:   withOpacity(th.colors.blue, 0.12),
  },
  pendingTitle: { ...textStyles.cardType, color: th.colors.text },
  pendingSub:   { ...textStyles.subtitle, color: th.colors.mutedLight, marginTop: spacing.xs },
  // Misma geometría que los CTA de la tarjeta de cliente
  pendingBtn: {
    backgroundColor: th.colors.blue,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    flexShrink:      0,
  },
  pendingBtnText: { ...textStyles.cardType, color: th.colors.onAccent },
  // Action sheet rows (··· menu)
  actionRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius:    th.radius.sm,
    gap:             spacing.sm,
  },
  actionRowNext: {
    backgroundColor: withOpacity(th.colors.blue, 0.08),
  },
  actionLabel: {
    flex:       1,
    fontSize:   typography.md,
    color:      th.colors.text,
    fontWeight: typography.medium,
  },
  actionChevron: {
    fontSize: 18,
    color:    th.colors.muted2,
  },
  actionBadge: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.full,
    minWidth:          20,
    height:            20,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 6,
  },
  actionBadgeText: {
    fontSize:   11,
    fontWeight: typography.bold,
    color:      th.colors.onAccent,
  },
  // Cuerpo: columna de datos + CTA. Figma alinea el botón arriba dentro de un
  // bloque fijo de 40px; aquí el bloque crece (2 avisos = 1 línea más), así que
  // el botón va centrado contra el alto real.
  cBody: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  cMain: {
    flex:     1,
    minWidth: 0,
  },
  // Línea de programa: nombre en card-type, etapa en subtitle, los dos mutedLight
  cProgLine: {
    ...textStyles.cardType,
    color: th.colors.mutedLight,
  },
  cStageLine: {
    ...textStyles.subtitle,
    color: th.colors.mutedLight,
  },
  // Línea de aviso (sustituye a la de programa) — punto + texto en naranja
  cAvisoRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  cAvisoDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: th.colors.orange,
    flexShrink:      0,
  },
  cAvisoText: {
    ...textStyles.cardType,
    color:      th.colors.orange,
    flexShrink: 1,
  },
  // Línea de ritmo: "1.2 cic/sem" · puntos de ciclo · fecha / sin revisar
  cPaceRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.lg,
  },
  cPace: {
    flexShrink: 0,
  },
  cPaceNum: {
    ...textStyles.cardType,
    color:       th.colors.text,
    fontVariant: ['tabular-nums'],
  },
  cPaceUnit: {
    ...textStyles.subtitle,
    color: th.colors.mutedLight,
  },
  cDots: {
    flex:          1,
    minWidth:      0,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  cDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  cDotFull:  { backgroundColor: th.colors.accent },
  cDotEmpty: { backgroundColor: th.colors.muted },
  cLast: {
    ...textStyles.tag,
    color:      th.colors.mutedLight,
    flexShrink: 0,
  },
  cUnreviewed: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flexShrink:    0,
  },
  cUnreviewedDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: th.colors.accent,
  },
  cUnreviewedText: {
    ...textStyles.cardType,
    color: th.colors.text,
  },
  // CTA — geometría del componente "Buttons" de Figma
  cCta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    padding:       spacing.md,
    borderRadius:  th.radius.md,
    flexShrink:    0,
  },
  cCtaText: {
    ...textStyles.cardType,
    color: th.colors.onAccent,
  },

  // Legacy stubs — kept so detail view still compiles
  cTagRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  // Selectable tags in info tab
  cTagSelectable: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    borderRadius:      th.radius.full,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    backgroundColor:   th.colors.surface2,
  },
  cTagSelectableActive: {
    backgroundColor: `${th.colors.accent}14`,
    borderColor:     `${th.colors.accent}40`,
  },
  cTagSelectableTick: {
    fontSize:   typography.xs,
    color:      th.colors.accent,
    fontWeight: typography.bold,
  },
  cTagSelectableText: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },
  cTagSelectableTextActive: { color: th.colors.accent },

  // Legacy action button stubs

  // ── Detail header ──
  detailHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    gap:               spacing.md,
  },
  backBtn: {
    width:           34,
    height:          34,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  backIcon: {
    fontSize:   20,
    fontWeight: '900',
    color:      th.colors.mutedLight,
    lineHeight: 22,
    marginTop:  -2,
  },
  detailName: {
    flex: 1,
    ...textStyles.hero,
    color: th.colors.text,
  },
  detailLast: {
    ...textStyles.subtitle,
    color:      th.colors.muted,
    flexShrink: 0,
  },
  // El aire bajo las pestañas lo pone el contenido de cada tab, no esta fila:
  // así el tab no arranca a dos dedos del control.
  detailTabs: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },

  // ── Tab content ──
  histFilterRow: {
    gap:          spacing.sm,
    marginBottom: spacing.sm,
  },

  tabContent: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.sm,
    // Mismo aire entre tarjetas que la lista del historial principal.
    gap:               spacing.md,
  },

  // ── Program card ──

  // Sin `gap`: dentro de este tab cada pieza pone su propio aire (la fila de
  // botones va pegada a la tarjeta, la sección de próxima sesión bien separada).
  programTabContent: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.sm,
  },

  // ── Tarjeta de programa asignado ─────────────────────────────────────────────
  // Dos colores como la tarjeta de ejercicio del workout: cabecera surface2,
  // cuerpo surface. Los 14/16 de padding son los de esa tarjeta (spec v6), no
  // hay token para ellos.
  apCard: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    overflow:        'hidden',
  },
  apHead: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               spacing.md,
    backgroundColor:   th.colors.surface2,
    paddingVertical:   14,
    paddingHorizontal: 16,
  },
  apHeadName:  { flex: 1, minWidth: 0 },
  apHeadCycle: { flexShrink: 0, alignItems: 'flex-end' },
  // Misma tipografía que el banner de Home (`bnEyebrow`/`bnProgName`/`bnCicloNum`):
  // es el mismo bloque de información, solo que sobre oscuro en vez de sobre lima.
  apEyebrow: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
  },
  // El tracking de `spacing-tag` deja un hueco DETRÁS de la última letra que RN
  // no mete en el ancho medido, así que alineado a la derecha se comía la "O"
  // de CICLO. El padding lo absorbe y el margen negativo devuelve la alineación.
  apEyebrowRight: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    paddingRight:  spacing.xs,
    marginRight:   -spacing.xs,
  },
  apName: {
    ...textStyles.hero,
    color:     th.colors.text,
    marginTop: -spacing.xs,
  },
  apCycleNum: {
    ...textStyles.hero,
    color:       th.colors.accent,
    marginTop:   -spacing.xs,
    fontVariant: ['tabular-nums'],
  },

  apBody: {
    paddingTop:        14,
    paddingHorizontal: 16,
    paddingBottom:     16,
  },
  apStage: { gap: spacing.sm },
  // Misma línea que `bnStageLabels` del banner: nombre trackeado a la izquierda,
  // posición pequeña empujada a la derecha.
  apStageRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           spacing.sm2,
  },
  apStageName: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    flexShrink:    1,
  },
  // "ETAPA 1" se queda de etiqueta; el nombre propio de la etapa es el dato.
  apStageOwnName: { color: th.colors.text },
  apStageMeta: {
    ...textStyles.subtitle,
    color:      th.colors.mutedLight,
    marginLeft: 'auto',
  },
  apStats: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.lg,
  },
  apStat: {
    flex:              1,
    minWidth:          0,
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
  },
  apStatVal: {
    ...textStyles.cardTitle,
    color:       th.colors.text,
    fontVariant: ['tabular-nums'],
  },
  apStatUnit: {
    ...textStyles.subtitle,
    color: th.colors.mutedLight,
  },
  apStatKey: {
    ...textStyles.spacingTag,
    color:     th.colors.muted,
    marginTop: 3,
  },

  // Botones Secondary (variante real de Figma: surface2 sólido, sin borde).
  apActions: {
    flexDirection: 'row',
    gap:           spacing.sm2,
    marginTop:     spacing.sm2,
  },
  apBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing.sm2,
    height:            44,
    borderRadius:      th.radius.md,
    backgroundColor:   th.colors.surface2,
    paddingHorizontal: spacing.lg,
  },
  apBtnText: {
    ...textStyles.cardType,
    color: th.colors.text,
  },
  apBtnGlyph: {
    ...textStyles.cardType,
    color: th.colors.accent,
  },
  // "Preparar" va dentro de una tarjeta `surface`, y sobre ella el `surface2`
  // del Secondary apenas se separa del fondo. Relleno accent al 10%, que es el
  // lenguaje que ya usa la app para "esto lleva a algo editable".
  apBtnAccent: { backgroundColor: th.tint.accent10 },
  apBtnIcon: {
    width:             44,
    paddingHorizontal: 0,
  },
  apBtnIconText: {
    fontSize:   16,
    fontWeight: '900',
    color:      th.colors.mutedLight,
    lineHeight: 18,
  },

  // ── Próxima sesión ──
  apSectionLabel: {
    ...textStyles.spacingTag,
    color:        th.colors.mutedLight,
    marginTop:    spacing.xl,
    marginBottom: spacing.sm2,
    marginLeft:   spacing.xs2,
  },
  apNext: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    padding:         16,
  },
  apNextLetter: {
    ...textStyles.cardTitle,
    color: th.colors.accent,
  },
  apNextName: {
    ...textStyles.cardTitle,
    color: th.colors.text,
  },
  apNextMeta: {
    ...textStyles.subtitle,
    color:     th.colors.mutedLight,
    marginTop: 2,
  },
  apNextHint: {
    ...textStyles.tag,
    color:      th.colors.muted,
    lineHeight: 15,
    marginLeft: spacing.xs2,
    marginTop:  spacing.sm2,
  },

  // ── Hoja de acciones ──
  sheetBody: {
    gap:           spacing.sm,
    paddingBottom: spacing.lg,
  },
  sheetRow: sheetRowBase(th),
  sheetRowText: {
    ...textStyles.cardType,
    flex:  1,
    color: th.colors.text,
  },
  sheetRowArrow: {
    ...textStyles.cardType,
    color: th.colors.mutedLight,
  },

  // ── Código de conexión ──
  codeCard: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    padding:         16,
    gap:             spacing.sm2,
  },
  codeTitle: {
    ...textStyles.spacingTag,
    color: th.colors.accent,
  },
  codeExplain: {
    ...textStyles.subtitle,
    color:      th.colors.mutedLight,
    lineHeight: 17,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm2,
    marginTop:     spacing.xs2,
  },
  codeBox: {
    flex:            1,
    backgroundColor: th.colors.bg,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  codeText: {
    ...textStyles.hero,
    color:         th.colors.text,
    letterSpacing: 3,
  },
  codeCopyBtn: {
    width:           44,
    height:          44,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  codeConnectBtn: { marginTop: spacing.xs2 },
  // Terciario: solo texto, sin caja. Descarta la tarjeta en el tab de Programa;
  // en Info sigue estando, que es donde vive el código de verdad.
  codeDismiss: {
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   -spacing.md,
  },
  codeDismissText: {
    ...textStyles.cardType,
    color: th.colors.mutedLight,
  },
  infoCodeWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },

  // ── Active program hero ──

  // Aviso de etapa bloqueada. Naranja como el resto de "requiere acción tuya"
  // del panel (programDirty, ritmo por debajo), no rojo: no hay nada roto.
  lockBox: {
    marginBottom:    spacing.sm2,
    backgroundColor: withOpacity(th.colors.orange, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.orange, 0.35),
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
    gap:             spacing.sm,
  },
  lockHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  lockTag: {
    ...textStyles.spacingTag,
    color: th.colors.orange,
  },
  lockText: {
    fontSize:   typography.sm,
    color:      th.colors.text,
    lineHeight: typography.sm * 1.45,
  },
  lockBtn: {
    backgroundColor:   th.colors.orange,
    borderRadius:      th.radius.sm,
    paddingVertical:   spacing.sm2,
    paddingHorizontal: spacing.md,
    alignItems:        'center',
  },
  lockBtnText: {
    ...textStyles.spacingTag,
    color: th.colors.bg,
  },

  // ── No active program ──
  noActiveBox: {
    padding:         spacing.lg,
    borderRadius:    th.radius.lg,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    backgroundColor: th.colors.surface,
    alignItems:      'center',
    gap:             spacing.xs,
  },
  noActiveTitle: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.muted,
  },
  noActiveSub: {
    fontSize: typography.xs,
    color:    th.colors.muted2,
  },

  // ── Previous (archived) programs ──
  archRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:    th.radius.md,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: `${th.colors.surface}80`,
  },
  archName: {
    fontSize: typography.base,
    color:    th.colors.muted,
  },
  archMeta: {
    fontSize:  typography.xs,
    color:     th.colors.muted2,
    marginTop: 2,
  },
  archIcon: {
    padding: spacing.xs,
  },
  archDots: {
    fontSize:  typography.base,
    color:     th.colors.muted2,
    width:     18,
    textAlign: 'center',
  },

  // ── Exercise mini card ──
  exMiniCard: {
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
    marginBottom:    spacing.xs,
  },
  exMiniHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        spacing.md,
  },
  exMiniName: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  exMiniLast: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 2,
  },
  exMiniArrow: {
    fontSize: typography.sm,
    color:    th.colors.muted,
  },
  exMiniBody: {
    paddingHorizontal: spacing.md,
    paddingBottom:     spacing.md,
    gap:               2,
    borderTopWidth:    borders.thin,
    borderTopColor:    th.colors.border,
  },
  exMiniRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  exMiniDate: { fontSize: typography.xs, color: th.colors.muted },
  exMiniVal:  { fontSize: typography.xs, color: th.colors.text, fontWeight: typography.medium },

  // ── Info tab ──
  accordion: {
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  accordionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  accordionLabel: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  accordionArrow: { fontSize: 16, color: th.colors.muted },
  accordionBody:  { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },

  fieldLabel: {
    fontSize:      typography.xs,
    color:         th.colors.muted,
    letterSpacing: 1,
    marginBottom:  spacing.xs,
    marginTop:     spacing.xs,
    fontWeight:    typography.bold,
  },
  fieldHint: {
    fontSize: typography.xs,
    color:    th.colors.muted,
    marginTop: 4,
  },
  input: {
    backgroundColor:   th.colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       th.colors.borderCard,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    color:             th.colors.text,
    fontSize:          typography.base,
  },
  statusRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  statusBtn: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    alignItems:      'center',
    flexDirection:   'row',
    justifyContent:  'center',
    gap:             4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBtnText: { fontSize: typography.xs, fontWeight: typography.medium },

  addRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    marginBottom:  spacing.xs,
  },

  // ── Weight list ──
  weightList: {
    borderRadius:  th.radius.sm,
    borderWidth:   borders.thin,
    borderColor:   th.colors.borderCard,
    overflow:      'hidden',
  },
  weightRow: {
    flexDirection:   'row',
    alignItems:      'center',
    padding:         spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
    gap:             spacing.sm,
  },
  weightDate: { flex: 1, fontSize: typography.sm, color: th.colors.muted },
  weightVal:  { fontSize: typography.base, fontWeight: typography.medium, color: th.colors.text },
  deleteIcon: { fontSize: typography.sm, color: th.colors.muted, padding: 4 },

  deleteClientBtn: {
    marginHorizontal: spacing.xl,
    marginTop:        spacing.xl,
    marginBottom:     spacing.md,
    paddingVertical:  spacing.md,
    borderRadius:     th.radius.sm,
    backgroundColor:  `${th.colors.red}15`,
    borderWidth:      borders.thin,
    borderColor:      `${th.colors.red}40`,
    alignItems:       'center',
  },
  deleteClientBtnText: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.red,
  },

  // ── Billing tiles ──
  billingRow: { flexDirection: 'row', gap: spacing.xs },
  billingTile: {
    flex:            1,
    backgroundColor: th.colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    borderRadius:    th.radius.sm,
    padding:         spacing.sm,
    alignItems:      'center',
  },
  billingTileLabel: {
    fontSize:      typography.xs,
    color:         th.colors.muted,
    letterSpacing: 1,
    marginBottom:  3,
  },
  billingTileValue: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
  },

  // ══ Facturación global — pantalla migrada ═══════════════════════════════════
  // Los estilos `billing*` / `billEntry` / `billStatus*` de arriba y abajo siguen
  // siendo los del detalle de cliente, que NO está migrado: no los toques aquí.

  // Cabecera: ‹ + título hero + ＋, misma geometría que el header de la lista.
  billHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.sm,
  },
  billHeaderTitle: {
    ...textStyles.hero,
    color:      th.colors.text,
    flex:       1,
  },
  billBody: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.xxl,
    gap:               spacing.lg,
  },

  // Tarjetas resumen — `statTile` de Progress con el valor a `card-title`
  // (Black 16) en vez de `hero` (Black 20): son importes, no contadores de 1-3
  // dígitos. `adjustsFontSizeToFit` cubre los que aun así no entren.
  billTilesRow: { flexDirection: 'row', gap: spacing.md },
  billTile: {
    flex:              1,
    height:            86,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.lg,
    paddingHorizontal: spacing.sm2,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing.sm,
    overflow:          'hidden',
  },
  billTileValue: {
    ...textStyles.cardTitle,
    textAlign:   'center',
    fontVariant: ['tabular-nums'],
  },
  // La etiqueta va ARRIBA de la cifra y en `mutedLight`: aquí nombra el dato,
  // no lo remata (al revés que en las cards de Progress).
  billTileLabel: {
    ...textStyles.spacingTag,
    textTransform: 'uppercase',
    color:         th.colors.mutedLight,
    textAlign:     'center',
  },

  billFilters: { gap: spacing.sm },

  // ── Entradas ──
  billList: { gap: spacing.sm },
  billCard: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm2,
  },
  billCardLine: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.md,
  },
  billCardName: {
    ...textStyles.cardTitle,
    color:      th.colors.text,
    flexShrink: 1,
  },
  // Importe a `card-type` (12) y no a `card-title` (16): es el mismo peso que el
  // número de "Ciclo NN" en la tarjeta de cliente, y deja el nombre de titular.
  billCardAmount: {
    ...textStyles.cardType,
    color:       th.colors.text,
    flexShrink:  0,
    fontVariant: ['tabular-nums'],
  },
  billCardMeta: {
    ...textStyles.subtitle,
    color:      th.colors.mutedLight,
    flexShrink: 1,
  },
  // Pill de estado: geometría de `attnPill` un escalón por debajo (radius/xs,
  // padding sm/xs2, `spacing-tag` en vez de `card-type`).
  billPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs2,
    borderRadius:      th.radius.xs,
    flexShrink:        0,
  },
  billPillText: { ...textStyles.spacingTag, textTransform: 'uppercase' },
  billEmpty: {
    ...textStyles.subtitle,
    color:           th.colors.mutedLight,
    textAlign:       'center',
    paddingVertical: spacing.xl,
  },

  // ── Hoja de alta de cobro ──
  billSheetBody: { gap: spacing.lg, paddingBottom: spacing.sm },
  billSecLabel: {
    ...textStyles.spacingTag,
    textTransform: 'uppercase',
    color:         th.colors.mutedLight,
    marginBottom:  spacing.sm,
  },
  // Selector de cliente (barra) + menú desplegable con buscador.
  billSelect: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               spacing.sm,
    height:            42,
    paddingHorizontal: spacing.md,
    borderRadius:      th.radius.sm,
    backgroundColor:   th.colors.surface2,
  },
  // Abierta: esquinas inferiores rectas para fundirse con el menú de debajo
  // (mismo recurso que el desplegable de ejercicios de Progress).
  billSelectOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  billSelectText: { ...textStyles.cardTitle, color: th.colors.text, flexShrink: 1 },
  // El grupo entero se eleva sobre los campos siguientes (hermanos dentro de
  // `billSheetBody`); el ancla da el contexto de posición al menú absoluto.
  billDropField:  { zIndex: 100 },
  billDropAnchor: { zIndex: 100 },
  billDropList: {
    position:                'absolute',
    top:                     '100%',
    left:                    0,
    right:                   0,
    zIndex:                  100,
    elevation:               12,   // en Android es esto, no zIndex, lo que lo pone encima
    backgroundColor:         th.colors.bg,
    borderBottomLeftRadius:  th.radius.sm,
    borderBottomRightRadius: th.radius.sm,
    overflow:                'hidden',
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius:  10,
  },
  billDropSearch: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    height:            42,
    paddingHorizontal: spacing.md,
  },
  // `padding: 0` obligatorio: si no, Android le añade el suyo y el campo deja
  // de casar con el alto de la fila (§8 de docs/UI-MIGRATION.md).
  billDropSearchInput: {
    flex:    1,
    padding: 0,
    ...textStyles.subtitle,
    color:   th.colors.text,
  },
  billDropItem: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
  },
  billDropItemSel:  { backgroundColor: th.tint.accent10 },
  billDropItemText: { ...textStyles.subtitle, color: th.colors.mutedLight },
  billDropEmpty: {
    ...textStyles.subtitle,
    color:           th.colors.mutedLight,
    textAlign:       'center',
    paddingVertical: spacing.lg,
  },

  billFieldRow: { flexDirection: 'row', gap: spacing.sm },
  // Alto fijo + `padding: 0`: con `paddingVertical` Android suma el suyo y los
  // dos campos de la fila (fecha / importe) salen con alturas distintas.
  billInput: {
    height:            42,
    paddingVertical:   0,
    paddingHorizontal: spacing.md,
    borderRadius:      th.radius.sm,
    backgroundColor:   th.colors.surface2,
    ...textStyles.cardTitle,
    color:             th.colors.text,
  },
  billCta: {
    height:          44,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       spacing.sm,
  },
  billCtaText: { ...textStyles.cardType, color: th.colors.onAccent },

  // ── Calendario (hoja de fecha) ──
  calBody: { paddingBottom: spacing.sm, gap: spacing.md },
  calNav:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calMonth: { ...textStyles.cardTitle, color: th.colors.text },
  calNavBtn: {
    width:           34,
    height:          34,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width:          `${100 / 7}%`,
    aspectRatio:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  calWeekDay: { ...textStyles.spacingTag, color: th.colors.mutedLight },
  calDay: {
    width:          34,
    height:         34,
    borderRadius:   th.radius.full,
    alignItems:     'center',
    justifyContent: 'center',
  },
  calDaySel:     { backgroundColor: th.colors.accent },
  calDayToday:   { borderWidth: borders.thin, borderColor: th.tint.accent50 },
  calDayText:    { ...textStyles.cardType, color: th.colors.text },
  calDayTextSel: { color: th.colors.onAccent },

  // ── Billing entries ──
  billEntry: {
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    marginBottom:    spacing.xs,
  },
  billConcept: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  billDate: { fontSize: typography.xs, color: th.colors.muted, marginTop: 1 },
  billAmount: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  // Pill style for existing entries (compact)
  billStatusBtn: {
    borderWidth:       borders.thin,
    borderColor:       `${th.colors.orange}50`,
    backgroundColor:   `${th.colors.orange}10`,
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
  },
  // Taller variant for the ADD form toggle (matches input height)
  billStatusBtnForm: {
    borderWidth:       borders.thin,
    borderColor:       `${th.colors.orange}50`,
    backgroundColor:   `${th.colors.orange}10`,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.sm,
  },
  billStatusBtnPaid: {
    borderColor:     `${th.colors.green}50`,
    backgroundColor: `${th.colors.green}10`,
  },
  billStatusText: {
    fontSize: typography.xs,
    color:    th.colors.orange,
  },
  billStatusTextPaid: { color: th.colors.green },

  // ── Buttons ──
  accentBtn: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
  },
  accentBtnSmall: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs + 2,
  },
  accentBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         th.colors.bg,
    letterSpacing: 1,
  },
  accentBtnTextSmall: { fontSize: typography.base, letterSpacing: 0.5 },
  ghostBtn: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    borderRadius:      th.radius.sm,
  },
  ghostBtnText: {
    fontSize: typography.base,
    color:    th.colors.muted,
  },

  // ── Modals ──
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  // Wrapper that centers modal card vertically (sits in normal flow above backdrop)
  importModalWrap: {
    position:       'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    pointerEvents:  'box-none',
  },
  modalCard: {
    backgroundColor:   th.colors.bg,
    borderWidth:       borders.thin,
    borderColor:       th.colors.borderCard,
    borderRadius:      th.radius.lg,
    padding:           spacing.xl,
    gap:               spacing.md,
  },
  modalTitle: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         th.colors.text,
    letterSpacing: 1,
  },
  modalSub: {
    fontSize: typography.sm,
    color:    th.colors.muted,
  },
  modalActions: {
    flexDirection: 'row',
    gap:           spacing.sm,
    justifyContent: 'flex-end',
    marginTop:     spacing.xs,
  },

  // ── Import options ──
  importOption: {
    backgroundColor: th.colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  importOptionLabel: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  importOptionDesc: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 2,
  },

  // ── New program modal ──
  tabRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  tabBtn: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
  },
  tabBtnActive: {
    borderColor:     `${th.colors.accent}50`,
    backgroundColor: `${th.colors.accent}12`,
  },
  tabBtnText: { fontSize: typography.sm, color: th.colors.muted },
  tabBtnTextActive: { color: th.colors.accent },

  numRow: { flexDirection: 'row', gap: spacing.xs },
  numBtn: {
    flex:            1,
    height:          44,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  numBtnActive: {
    borderColor:     `${th.colors.accent}50`,
    backgroundColor: `${th.colors.accent}12`,
  },
  numBtnText: { fontSize: typography.xl, color: th.colors.text, fontWeight: typography.heavy },
  numBtnTextActive: { color: th.colors.accent },

  // "Sin límite" — misma anatomía que numBtn pero a ancho completo, porque es
  // una opción de texto, no una cifra más de la fila.
  noLimitRow: {
    marginTop:       spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface2,
  },
  noLimitRowActive: {
    borderColor:     `${th.colors.accent}50`,
    backgroundColor: `${th.colors.accent}12`,
  },
  noLimitText:       { fontSize: typography.sm, color: th.colors.muted },
  noLimitTextActive: { color: th.colors.accent },

  templateOption: {
    padding:         spacing.md,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface2,
    marginBottom:    spacing.xs,
  },
  templateOptionActive: {
    borderColor:     `${th.colors.accent}50`,
    backgroundColor: `${th.colors.accent}12`,
  },
  templateOptionName: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  templateOptionMeta: { fontSize: typography.xs, color: th.colors.muted, marginTop: 2 },

  // ── Context menu ──
  contextMenu: {
    position:        'absolute',
    bottom:          spacing.xxl * 2,
    left:            spacing.xl,
    right:           spacing.xl,
    backgroundColor: th.colors.bg,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  contextMenuItem: {
    padding:           spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  contextMenuText: { fontSize: typography.base, color: th.colors.text },
});

