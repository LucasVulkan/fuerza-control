/**
 * ClientsScreen — PRO feature. Port of web ClientsView.jsx.
 *
 * Views (managed with useState, no nested navigator):
 *   'list'    → client list + search + status filter
 *   'detail'  → single client (4 tabs: programs, history, progress, info)
 *   'billing' → global billing summary
 */

import { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, FlatList, TouchableOpacity, Modal, Alert, StyleSheet, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import * as Clipboard from 'expo-clipboard';
import Svg, { Path, Circle } from 'react-native-svg';
import Reanimated, { LinearTransition, FadeIn, FadeOutUp } from 'react-native-reanimated';
import { useStore } from '../../store/useStore';
import { useWeightUnit } from '../hooks/useWeightUnit';
import AppHeader from '../components/AppHeader';
import PaywallModal from '../components/PaywallModal';
import TrainerSyncModal from '../components/TrainerSyncModal';
import DragSheet from '../components/DragSheet';
import { ToggleRow } from '../components/ui/EditorRows';
import SegmentedControl from '../components/ui/SegmentedControl';
import StepField from '../components/ui/StepField';
import NameField from '../components/ui/NameField';
import NumberChips from '../components/ui/NumberChips';
import TabBar from '../components/ui/TabBar';
import ProgressPanel from '../components/stats/ProgressPanel';
import SessionCard from '../components/SessionCard';
import { spacing, textStyles, borders, withOpacity, sheetRowBase, getCardRadii, lh } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { summarizeSets } from '../utils/progression';
import { volumeDeltas } from '../utils/sessionRecap';
import { computeAdherence, requiresAttention, adherencePct, adherenceColor, STATUS } from '../utils/adherence';
import { progressFromBlob, clientStageIndex, stageDays, stageDaysAt, allProgramDays } from '../utils/stageProgress';
import { sessionLoads, dailySeries } from '../utils/trainingLoad';
import { sessionStats } from '../utils/sessionStats';
import { parseImportFile } from '../utils/importFile';
import { programsOf, templatesOf } from '../utils/programOwnership';
import { LockIcon, CheckIcon, ChevronDown, MenuIcon } from '../components/ui/EditorIcons';
import { collapseOut, FOLD_MS } from '../components/ui/collapseOut';
import ProgramCard from '../components/ui/ProgramCard';

// Sesiones por ciclo — el mismo rango que el alta manual del onboarding.
const SESSION_CHOICES = [1, 2, 3, 4, 5, 6, 7];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Expected sessions per week = days in the program's CURRENT cycle (active stage). */
function weeklyTarget(program) {
  if (!program) return 0;
  const days = stageDays(program);
  return days.length;
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

// ── Sección plegable de Info ──────────────────────────────────────────────────

/**
 * Categoría de la pestaña Info: una tarjeta `surface` con el título a la
 * izquierda y **su resumen a la derecha**.
 *
 * El resumen es lo que justifica el componente. El acordeón anterior eran
 * rótulos a sangre con separadores de 1px: con todo cerrado —que es como se
 * entra— la pantalla no decía nada, cuatro etiquetas y cuatro flechas. Aquí
 * cada cabecera lleva el dato que resume su sección (estado, nombre completo,
 * último peso, pendiente de cobro, conexión), así que Info se lee sin abrir
 * nada y solo se despliega lo que se va a tocar.
 *
 * El plegado es el mismo de las sesiones de la Home, y a propósito:
 * `LinearTransition` en la tarjeta y `collapseOut` en el cuerpo, que encoge
 * además de desvanecerse.
 */
function InfoSection({ title, summary, tone, open, onToggle, children }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const toneColor = tone === 'accent' ? th.colors.accent
    : tone === 'green'  ? th.colors.green
    : tone === 'orange' ? th.colors.orange
    : th.colors.mutedLight;
  return (
    <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.infoSec}>
      <TouchableOpacity
        style={styles.infoSecHead}
        onPress={onToggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.infoSecTitle}>{title}</Text>
        <Text style={[styles.infoSecSum, { color: toneColor }]} numberOfLines={1}>{summary ?? ''}</Text>
        <View style={open ? styles.infoSecChevOpen : null}>
          <ChevronDown size={12} color={open ? th.colors.accent : th.colors.muted} />
        </View>
      </TouchableOpacity>
      {open && (
        <Reanimated.View entering={FadeIn.duration(180)} exiting={collapseOut} style={styles.infoSecBody}>
          {/* Filete a sangre: separa cabecera y cuerpo sin meter una segunda
              superficie, el mismo recurso que la tarjeta de programa. */}
          <View style={styles.infoSecRule} />
          {children}
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

/**
 * Fila de la lista agrupada de Info (`getCardRadii`): el patrón denso que ya
 * usan Progreso y el menú principal. Sustituye a los campos con borde propio —
 * la etiqueta ocupa un ancho fijo a la izquierda y el valor escribe al lado,
 * sin caja dentro de la caja.
 */
function InfoRow({ isFirst, isLast, children }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.infoRow, getCardRadii(th, isFirst, isLast)]}>{children}</View>;
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
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
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
  const currentDays  = stageDaysAt(program, stageIdx);
  const weeksDone    = mine?.stageWeeksCompleted ?? program.stageWeeksCompleted ?? 0;

  // ── Next session in the rotation ── first one NOT done this cycle. By
  // template, not by position: an index breaks as soon as the client trains out
  // of rotation order.
  const doneIds     = new Set(mine?.cycleCompletedIds ?? program.cycleCompletedIds ?? []);
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

      {/* ── Tarjeta de programa ── la misma que la Home: las dos pantallas
          convergían sin saberlo (docs/specs/home-sessions.md §4). El pie de
          acciones va DENTRO, que es el único cambio real de la convergencia. */}
      <ProgramCard
        variant="client"
        name={program.name}
        cycleNum={cycleNum}
        stage={showStageBar && {
          label:       t('home.stageDefault', { n: stageIdx + 1 }),
          name:        currentStage?.name,
          weekInStage,
          totalWeeks:  stageWeeks,
        }}
        // La barra pinta el PROGRAMA: un tramo por etapa, de ancho proporcional
        // a sus ciclos. Los puntos de dentro de la etapa los saca la tarjeta de
        // `stage.weekInStage`/`totalWeeks`.
        stages={stages.map((s) => ({ cycles: s.durationWeeks }))}
        stageIdx={stageIdx}
        // Terminó la etapa y no ha avanzado. Puede ser decisión suya o tuya
        // ("hazme un ciclo más"), así que se informa sin alarmar — el naranja se
        // reserva para cuando NO puede avanzar.
        stageNote={stageDone && !nextLocked
          ? t('clients.stageFinishedStaying', { current: currentStage?.name ?? '' })
          : null}
        adherence={adherence4w}
        adherenceColor={attnColor}
        pace={paceHasData ? paceRaw : null}
        loadPct={loadPct}
        onEdit={onEdit}
        onView={onView}
        onMore={() => setMenuOpen(true)}
      />

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
function ClientCodeBlock({ client, showToast, onDismiss, flat }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const connectClientToCloud = useStore((s) => s.connectClientToCloud);
  const reissueClientCode    = useStore((s) => s.reissueClientCode);
  const [copied, setCopied]         = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [reissuing, setReissuing]   = useState(false);

  /**
   * Código nuevo + asiento liberado. Es la única salida de tres situaciones que
   * hasta ahora no tenían ninguna: el cliente reinstaló siendo anónimo y su
   * identidad se perdió, perdió el código, o el código se filtró.
   * Ver `docs/specs/client-connection.md` §4.4.
   */
  function handleReissue() {
    Alert.alert(
      t('clients.codeCard.reissueConfirmTitle'),
      t('clients.codeCard.reissueConfirmBody', { name: client.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('clients.codeCard.reissueConfirmCta'),
          style: 'destructive',
          onPress: async () => {
            setReissuing(true);
            try {
              await reissueClientCode(client.id);
              showToast(t('clients.codeCard.reissueDone'), 2200, 'success');
            } catch (err) {
              Alert.alert(t('clients.codeCard.reissueError'), err?.message ?? '');
            } finally {
              setReissuing(false);
            }
          },
        },
      ],
    );
  }

  if (!client.syncSlotId) {
    return (
      <View style={[styles.codeCard, flat && styles.codeCardFlat]}>
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
      <View style={[styles.codeCard, flat && styles.codeCardFlat]}>
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
    <View style={[styles.codeCard, flat && styles.codeCardFlat]}>
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
      <TouchableOpacity
        style={styles.codeDismiss}
        onPress={handleReissue}
        disabled={reissuing}
        activeOpacity={0.6}
      >
        <Text style={styles.codeDismissText}>
          {reissuing ? t('clients.keyTab.connecting') : t('clients.codeCard.reissue')}
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
        <MenuIcon horizontal color={th.colors.muted2} />
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

/**
 * Hoja de "nuevo programa" del cliente. Era un `<Modal>` centrado con pestañas,
 * rejillas de números y botones propios; pasa a `DragSheet`, el único
 * bottom-sheet de la app (§9 de docs/UI-MIGRATION.md), y a los controles que ya
 * existen: `SegmentedControl` para elegir origen, `StepField` para los dos
 * contadores y la fila de "sin límite" del editor de programa.
 *
 * Ojo con la etiqueta de las sesiones: el modal viejo decía "SESIONES POR
 * SEMANA", pero `createProgramForClient` usa ese número para crear las sesiones
 * distintas del ciclo (A, B, C…), no para repartirlas por semana. Es el mismo
 * concepto que el onboarding ya llama "sesiones por ciclo".
 */
function NewProgramSheet({ templatePrograms, onCreateBlank, onCreateFromTemplate, onClose }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  const hasTemplates = templatePrograms.length > 0;
  const [tab,              setTab]              = useState('blank');
  const [name,             setName]             = useState('');
  const [numSessions,      setNumSessions]      = useState(3);
  // null = sin límite de ciclos (la etapa dura hasta que se añada la siguiente)
  const [durationWeeks,    setDurationWeeks]    = useState(4);
  const [fromTemplateId,   setFromTemplateId]   = useState('');
  const [fromTemplateName, setFromTemplateName] = useState('');

  const canCreate = tab === 'blank' ? name.trim().length > 0 : Boolean(fromTemplateId);

  function handleSubmit() {
    if (!canCreate) return;
    if (tab === 'blank') onCreateBlank(name, numSessions, durationWeeks);
    else                 onCreateFromTemplate(fromTemplateId, fromTemplateName);
  }

  return (
    <DragSheet
      visible
      onClose={onClose}
      title={t('clients.newProgramModal.title')}
      action={{ label: t('common.cancel'), onPress: onClose }}
    >
      <View style={styles.formSheetBody}>

        {hasTemplates && (
          <SegmentedControl
            options={[
              { id: 'blank',    label: t('clients.newProgramModal.tabBlank')    },
              { id: 'template', label: t('clients.newProgramModal.tabTemplate') },
            ]}
            value={tab}
            onChange={setTab}
          />
        )}

        {tab === 'blank' ? (
          <>
            <View>
              <Text style={styles.sheetLabel}>{t('clients.newProgramModal.nameLabel')}</Text>
              <NameField
                style={styles.sheetInput}
                placeholder={t('clients.newProgramModal.namePlaceholder')}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View>
              <Text style={styles.sheetLabel}>{t('onboarding.sessionsPerCycle')}</Text>
              {/* Los mismos chips y el mismo rango que el alta manual del
                  onboarding: el rango es corto, así que se ve entero y se
                  acierta de un toque. */}
              <NumberChips values={SESSION_CHOICES} value={numSessions} onChange={setNumSessions} />
            </View>

            <View>
              <Text style={styles.sheetLabel}>{t('editor.cyclesQuestion')}</Text>
              <Text style={styles.sheetHint}>{t('editor.cyclesExplain')}</Text>
              {/* "Sin límite" (`durationWeeks: null`) es un booleano, así que
                  va en la fila de conmutador de la app (`ToggleRow`) y no en
                  una fila pintada a mano. Va SIEMPRE arriba y el contador
                  aparece debajo: si se intercambiaran, el conmutador saltaría
                  de sitio al activarlo. */}
              <View style={styles.cyclesGroup}>
                <ToggleRow
                  label={t('editor.cyclesOpen')}
                  hint={t('editor.cyclesNoLimit')}
                  value={durationWeeks == null}
                  onChange={(on) => setDurationWeeks(on ? null : 4)}
                />
                {durationWeeks != null && (
                  <StepField
                    horizontal
                    label={t('editor.stageWeeksUnit')}
                    value={durationWeeks}
                    onChange={setDurationWeeks}
                    min={1}
                    max={52}
                  />
                )}
              </View>
            </View>
          </>
        ) : (
          <>
            <View>
              <Text style={styles.sheetLabel}>{t('clients.newProgramModal.templateLabel')}</Text>
              <View style={styles.templateList}>
                {templatePrograms.map((p) => {
                  const on = fromTemplateId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.templateRow, on && styles.templateRowOn]}
                      onPress={() => { setFromTemplateId(p.id); setFromTemplateName(p.name); }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
                        <Text style={[styles.templateRowName, on && styles.templateRowNameOn]} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={styles.templateRowMeta}>
                          {t('common.session', { count: allProgramDays(p).length })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={styles.sheetLabel}>{t('clients.newProgramModal.nameLabel')}</Text>
              <NameField
                style={styles.sheetInput}
                placeholder={fromTemplateName || t('clients.newProgramModal.namePlaceholderOptional')}
                value={fromTemplateName}
                onChangeText={setFromTemplateName}
              />
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.sheetCta, !canCreate && { opacity: 0.4 }]}
          disabled={!canCreate}
          onPress={handleSubmit}
          activeOpacity={0.85}
        >
          <Text style={styles.sheetCtaText}>
            {tab === 'blank'
              ? t('clients.newProgramModal.createBtn')
              : t('clients.newProgramModal.assignBtn')}
          </Text>
        </TouchableOpacity>

      </View>
    </DragSheet>
  );
}

// ── Global billing ─────────────────────────────────────────────────────────────

const billLocale = (lang) => (lang === 'en' ? 'en-US' : 'es-ES');

/** Date → 'AAAA-MM-DD' en hora LOCAL (`toISOString()` es UTC y adelanta el día). */
function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Días completos desde una fecha `AAAA-MM-DD`. Vive fuera del componente a
 * propósito: mirar el reloj dentro de un render —aunque sea dentro de un
 * `useMemo`— es justo lo que prohíbe la regla de pureza de react-hooks.
 */
function daysSinceIso(iso) {
  const [y, m, d] = (iso ?? '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return Math.max(0, Math.round((Date.now() - new Date(y, m - 1, d)) / 86400000));
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
 *
 * Con `lockedClientId` es la misma hoja sin el selector de cliente: así la
 * pestaña Info del cliente da de alta un cobro con esta hoja en vez de con el
 * formulario propio que tenía —dos campos de fecha tecleados a mano y ningún
 * calendario—, que era la misma pantalla peor hecha.
 */
function GlobalAddBillingSheet({ clients, lang, lockedClientId, onClose }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const addClientBilling = useStore((s) => s.addClientBilling);
  const showToast        = useStore((s) => s.showToast);

  const clientList = useMemo(
    () => Object.values(clients ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  const [clientId,  setClientId]  = useState(lockedClientId ?? '');
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
      <View style={styles.formSheetBody}>

        {/* Cliente — dropdown con buscador, mismo patrón que el desplegable de
            ejercicios de Progress: ancla relativa + menú `position:absolute`
            colgando de `top:'100%'`, que FLOTA sobre los campos de abajo.
            Abierta desde la ficha de un cliente no hay nada que elegir. */}
        <View style={[styles.billDropField, !!lockedClientId && { display: 'none' }]}>
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
            con el valor a `itemTitle` en vez de `title`: caben más dígitos. */}
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
  const currentDays    = stageDaysAt(activeProgram, stageIdx);
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
  const { t, i18n } = useTranslation();
  const billLang = i18n.language?.startsWith('en') ? 'en' : 'es';
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();

  // ── Store ──────────────────────────────────────────────────────────────────
  const clients                = useStore((s) => s.clients);
  const programs               = useStore((s) => s.programs);
  const clientLogs             = useStore((s) => s.clientLogs);
  const exerciseLibrary        = useStore((s) => s.exerciseLibrary);
  const customExercises        = useStore((s) => s.customExercises);
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

  const isPro        = profile.isPro ?? false;
  const setProfile   = useStore((s) => s.setProfile);
  const trainerSync  = useStore((s) => s.trainerSync);

  // Memoizado porque ahora alimenta los memos de carga: un objeto nuevo en cada
  // render recalculaba `sessionLoads` sobre todo el historial del cliente.
  // Suscrito SOLO para que la ficha se repinte al editar una sesion del
  // programa: se leen con `getEffectiveTemplate`, que es estable.
  // eslint-disable-next-line no-unused-vars
  const sessionTemplates       = useStore((s) => s.sessionTemplates);

  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  const templatePrograms = useMemo(() => templatesOf(programs), [programs]);

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

  // Detail - secciones plegables de Info. Todas cerradas al entrar: con el
  // resumen en cada cabecera, la pantalla ya se lee sin abrir ninguna.
  const [openSections,  setOpenSections]  = useState({ status: false, personal: false, weight: false, billing: false, connection: false });
  // El campo de etiqueta nueva solo aparece al pedirlo, para que la fila de
  // pills no lleve siempre un input detrás sin usar.
  const [addingTag,     setAddingTag]     = useState(false);

  // Detail - body weight
  const [weightDate,   setWeightDate]   = useState(() => toIsoDate(new Date()));
  const [weightValue,  setWeightValue]  = useState('');
  const [showWeightCal, setShowWeightCal] = useState(false);

  // Detail - alta de cobro (la hoja de la facturación global, con el cliente puesto)
  const [addingBill,  setAddingBill]  = useState(false);

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

  // Derivada, no guardada: no puede contener ids muertos porque no contiene
  // ids. De ahí que se fuera el `filter(Boolean)` que había aquí.
  const clientPrograms = useMemo(
    () => (selectedClientId ? programsOf(programs, selectedClientId) : []),
    [selectedClientId, programs],
  );

  const allClientTemplateIds = useMemo(() => {
    return new Set(clientPrograms.flatMap((p) => allProgramDays(p).map((d) => d.sessionTemplateId)));
  }, [clientPrograms]);

  const activeClientTemplateIds = useMemo(() => {
    if (!selectedClient?.activeProgramId) return new Set();
    const activeProg = programs[selectedClient.activeProgramId];
    if (!activeProg) return new Set();
    return new Set(allProgramDays(activeProg).map((d) => d.sessionTemplateId));
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

  // ── Resúmenes de las cabeceras de Info ─────────────────────────────────────
  // Se entra a Info con todo cerrado, así que cada cabecera tiene que contar su
  // sección de un vistazo. Todo sale de datos ya guardados; va en un memo
  // porque el del peso mira el reloj, y eso no puede pasar en cada render.
  const infoSummaries = useMemo(() => {
    if (!selectedClient) return {};
    const status  = selectedClient.status ?? 'active';
    const tagged  = (selectedClient.tags ?? []).length;
    const weights = selectedClient.bodyWeight ?? [];       // ordenado por fecha
    const lastW   = weights[weights.length - 1];
    const bills   = selectedClient.billing ?? [];
    const pending = bills.reduce((a, b) => a + (b.status === 'paid' ? 0 : (b.amount ?? 0)), 0);

    let weight = null;
    if (lastW) {
      const days = daysSinceIso(lastW.date);
      const when = days == null ? null
        : days === 0 ? t('dayCard.today')
        : days === 1 ? t('dayCard.yesterday')
        : t('dayCard.daysAgo', { count: days });
      weight = [`${lastW.weight} kg`, when].filter(Boolean).join(' · ');
    }

    return {
      status: [
        t(`clients.status${status === 'paused' ? 'Paused' : status === 'inactive' ? 'Inactive' : 'Active'}`),
        tagged ? t('clients.filterTagsCount', { count: tagged }) : null,
      ].filter(Boolean).join(' · '),
      statusTone: status === 'active' ? 'green' : status === 'paused' ? 'orange' : null,
      personal:   selectedClient.fullName || selectedClient.phone || selectedClient.email || null,
      weight,
      billing:     bills.length === 0 ? null
        : pending > 0 ? `${pending.toFixed(2)}€ ${t('clients.pendingLabel').toLowerCase()}`
        : t('clients.info.upToDate'),
      billingTone: pending > 0 ? 'orange' : null,
      connection:     selectedClient.syncLinked ? t('clients.info.connected') : t('clients.info.notConnected'),
      connectionTone: selectedClient.syncLinked ? null : 'accent',
    };
  }, [selectedClient, t]);

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
        owner: selectedClientId,
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
      if (!parsed.ok) { Alert.alert(t('errors.invalidFile'), t(parsed.errorKey, parsed.errorParams)); return; }
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
    const ids = new Set(allProgramDays(program).map((d) => d.sessionTemplateId));
    return clientBaseLog.filter((e) => ids.has(e.sessionTemplateId)).length;
  }

  function getLastActivity(program) {
    const ids = new Set(allProgramDays(program).map((d) => d.sessionTemplateId));
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

  // Crear etiqueta y asignarla de una vez: se crea desde la ficha del cliente
  // al que se le va a poner, así que quedarse sin asignar nunca es lo que se
  // quería. Estaba duplicada en el `onSubmitEditing` y en el botón.
  function handleCreateTag() {
    const name = newTag.trim();
    setNewTag('');
    setAddingTag(false);
    if (!name || allTags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) return;
    const newId = createTag(name);
    updateClientInfo(selectedClientId, { tags: [...(selectedClient?.tags ?? []), newId] });
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
            setOpenSections({ status: false, personal: false, weight: false, billing: true, connection: false });
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

        {/* Sin banda: cabecera, pestañas y contenido van los tres sobre `bg`.
            Lo que distingue estas pestañas de los controles segmentados que
            filtran dentro de cada tab ya no es el fondo sobre el que flotan sino
            el color del highlight — la píldora lima es siempre el filtro
            (docs/specs/home-sessions.md §4.6). */}
        {/* ‹ · nombre · última actividad, todo en una línea */}
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setView('list')} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.detailName} numberOfLines={1}>{selectedClient.name}</Text>
          {detailLastStr && <Text style={styles.detailLast}>{detailLastStr}</Text>}
        </View>

        <View style={styles.detailTabs}>
          <TabBar options={TABS} value={activeTab} onChange={setActiveTab} />
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
        {/* Cinco categorías plegables, cada una con su resumen en la cabecera.
            El código de conexión pasa a ser una más: aquí es consulta, no
            trámite — el trámite lo lleva el tab de Programa mientras el cliente
            no ha canjeado el código. */}
        {activeTab === 'info' && (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={[styles.infoTabContent, { paddingBottom: insets.bottom + spacing.xxl }]}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Estado ── */}
              <InfoSection
                title={t('clients.statusLabel')}
                summary={infoSummaries.status}
                tone={infoSummaries.statusTone}
                open={openSections.status}
                onToggle={() => setOpenSections((s) => ({ ...s, status: !s.status }))}
              >
                <View style={styles.stRow}>
                  {[
                    // El activo se tiñe con el 10% de su propio color, no con un
                    // borde. Verde y no acento: es el mismo verde con el que
                    // `adherenceColor` pinta "al día" en la tarjeta de cliente.
                    { id: 'active',   label: t('clients.statusActive'),   color: th.colors.green,  tint: withOpacity(th.colors.green, 0.1) },
                    { id: 'paused',   label: t('clients.statusPaused'),   color: th.colors.orange, tint: withOpacity(th.colors.orange, 0.1) },
                    { id: 'inactive', label: t('clients.statusInactive'), color: th.colors.red,    tint: withOpacity(th.colors.red, 0.1) },
                  ].map(({ id, label, color, tint }) => {
                    const isSel = (selectedClient.status ?? 'active') === id;
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[styles.stBtn, isSel && { backgroundColor: tint }]}
                        onPress={() => updateClientInfo(selectedClientId, { status: id })}
                        activeOpacity={0.75}
                      >
                        {isSel && <View style={[styles.stDot, { backgroundColor: color }]} />}
                        <Text style={[styles.stBtnText, isSel && { color }]} numberOfLines={1}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>{t('clients.filterTags')}</Text>
                  <View style={styles.tagRow}>
                    {allTags.map(({ id, name }) => {
                      const active = (selectedClient.tags ?? []).includes(id);
                      return (
                        <TouchableOpacity
                          key={id}
                          style={[styles.tagPill, active && styles.tagPillOn]}
                          onPress={() => {
                            const current = selectedClient.tags ?? [];
                            updateClientInfo(selectedClientId, {
                              tags: active ? current.filter((tid) => tid !== id) : [...current, id],
                            });
                          }}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.tagPillText, active && styles.tagPillTextOn]}>{name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {!addingTag && (
                      <TouchableOpacity style={styles.tagPill} onPress={() => setAddingTag(true)} activeOpacity={0.75}>
                        <Text style={[styles.tagPillText, styles.tagPillTextOn]}>＋ {t('clients.info.newTag')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {addingTag && (
                    <View style={styles.addRow}>
                      <TextInput
                        style={[styles.fld, { flex: 1 }]}
                        placeholder={t('clients.info.newTagPlaceholder')}
                        placeholderTextColor={th.colors.muted}
                        value={newTag}
                        onChangeText={setNewTag}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={handleCreateTag}
                      />
                      <TouchableOpacity
                        style={[styles.plusBtn, !newTag.trim() && { opacity: 0.4 }]}
                        onPress={newTag.trim() ? handleCreateTag : undefined}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.plusBtnText}>＋</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <Text style={styles.infoHint}>{t('clients.info.tagsHint')}</Text>
                </View>
              </InfoSection>

              {/* ── Datos personales ── */}
              <InfoSection
                title={t('clients.personalData')}
                summary={infoSummaries.personal}
                open={openSections.personal}
                onToggle={() => setOpenSections((s) => ({ ...s, personal: !s.personal }))}
              >
                <View style={styles.group}>
                  {[
                    { key: 'name',     label: t('clients.fieldNameAlias'), placeholder: 'Lucas' },
                    { key: 'fullName', label: t('clients.fieldFullName'),  placeholder: 'Lucas García Martínez' },
                    { key: 'phone',    label: t('clients.fieldPhone'),     placeholder: '+34 600 000 000' },
                    { key: 'email',    label: t('clients.fieldEmail'),     placeholder: 'lucas@email.com' },
                  ].map(({ key, label, placeholder }, i, arr) => (
                    <InfoRow key={key} isFirst={i === 0} isLast={i === arr.length - 1}>
                      <Text style={styles.infoRowKey} numberOfLines={1}>{label}</Text>
                      <TextInput
                        style={styles.infoRowInput}
                        placeholder={placeholder}
                        placeholderTextColor={th.colors.muted}
                        defaultValue={selectedClient[key] ?? ''}
                        onEndEditing={(e) => updateClientInfo(selectedClientId, { [key]: e.nativeEvent.text })}
                        returnKeyType="done"
                      />
                    </InfoRow>
                  ))}
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>{t('clients.fieldNotes')}</Text>
                  <TextInput
                    style={styles.notesBox}
                    placeholder={t('clients.notesPlaceholder')}
                    placeholderTextColor={th.colors.muted}
                    multiline
                    defaultValue={selectedClient.notes ?? ''}
                    onEndEditing={(e) => updateClientInfo(selectedClientId, { notes: e.nativeEvent.text })}
                  />
                  <Text style={styles.infoHint}>{t('clients.notesSavedHint')}</Text>
                </View>
              </InfoSection>

              {/* ── Peso corporal ── */}
              <InfoSection
                title={t('clients.bodyWeight')}
                summary={infoSummaries.weight}
                open={openSections.weight}
                onToggle={() => setOpenSections((s) => ({ ...s, weight: !s.weight }))}
              >
                <View style={styles.addRow}>
                  {/* La fecha abre el calendario que ya usa el alta de cobro, no
                      un teclado para escribir AAAA-MM-DD a mano. */}
                  <TouchableOpacity
                    style={[styles.fldBtn, { flex: 1 }]}
                    onPress={() => setShowWeightCal(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.fldBtnText} numberOfLines={1}>{formatBillDate(weightDate, billLang, true)}</Text>
                    <Svg viewBox="0 0 24 24" width={15} height={15} fill="none"
                      stroke={th.colors.mutedLight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
                    </Svg>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.fld, { width: 86, textAlign: 'center' }]}
                    placeholder="kg"
                    placeholderTextColor={th.colors.muted}
                    keyboardType="decimal-pad"
                    value={weightValue}
                    onChangeText={setWeightValue}
                    returnKeyType="done"
                    onSubmitEditing={handleAddWeight}
                  />
                  <TouchableOpacity
                    style={[styles.plusBtn, !weightValue && { opacity: 0.4 }]}
                    onPress={weightValue ? handleAddWeight : undefined}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.plusBtnText}>＋</Text>
                  </TouchableOpacity>
                </View>

                {(selectedClient.bodyWeight ?? []).length === 0 ? (
                  <Text style={styles.infoEmpty}>{t('clients.noWeightData')}</Text>
                ) : (
                  <View style={styles.group}>
                    {[...(selectedClient.bodyWeight ?? [])].reverse().map((entry, i, arr) => (
                      <InfoRow key={entry.date} isFirst={i === 0} isLast={i === arr.length - 1}>
                        <Text style={styles.rowDate}>{formatBillDate(entry.date, billLang, true)}</Text>
                        <Text style={styles.rowValue}>{entry.weight} kg</Text>
                        <TouchableOpacity onPress={() => removeClientBodyWeight(selectedClientId, entry.date)} hitSlop={8}>
                          <Text style={styles.rowDelete}>✕</Text>
                        </TouchableOpacity>
                      </InfoRow>
                    ))}
                  </View>
                )}
              </InfoSection>

              {/* ── Facturación ── */}
              <InfoSection
                title={t('clients.billing')}
                summary={infoSummaries.billing}
                tone={infoSummaries.billingTone}
                open={openSections.billing}
                onToggle={() => setOpenSections((s) => ({ ...s, billing: !s.billing }))}
              >
                {(selectedClient.billing ?? []).length > 0 && (() => {
                  const bills = selectedClient.billing ?? [];
                  const total = bills.reduce((a, b) => a + (b.amount ?? 0), 0);
                  const paid  = bills.filter((b) => b.status === 'paid').reduce((a, b) => a + (b.amount ?? 0), 0);
                  return (
                    // Las mismas tres tarjetas que la facturación global, en
                    // `bg`: aquí el contenedor ya es `surface` y en `surface`
                    // no se verían.
                    <View style={styles.billTilesRow}>
                      {[
                        { label: t('clients.billedLabel'),   value: total,        color: th.colors.text },
                        { label: t('clients.receivedLabel'), value: paid,         color: th.colors.green },
                        { label: t('clients.pendingLabel'),  value: total - paid, color: (total - paid) > 0 ? th.colors.orange : th.colors.mutedLight },
                      ].map(({ label, value, color }) => (
                        <View key={label} style={[styles.billTile, { backgroundColor: th.colors.bg }]}>
                          <Text style={styles.billTileLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                            {label}
                          </Text>
                          <Text style={[styles.billTileValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                            {value.toFixed(2)}€
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {/* El alta es la MISMA hoja que la facturación global, con el
                    cliente ya puesto: allí ya hay calendario, importe, concepto
                    y estado. El formulario que había aquí era esa hoja peor
                    hecha, con las dos fechas tecleadas a mano. */}
                <TouchableOpacity style={styles.apBtn} onPress={() => setAddingBill(true)} activeOpacity={0.85}>
                  <Text style={styles.apBtnGlyph}>+</Text>
                  <Text style={styles.apBtnText}>{t('clients.billSheet.title')}</Text>
                </TouchableOpacity>

                {(selectedClient.billing ?? []).length === 0 ? (
                  <Text style={styles.infoEmpty}>{t('clients.noBillingData')}</Text>
                ) : (
                  <>
                    <View style={styles.group}>
                      {(selectedClient.billing ?? []).map((entry, i, arr) => {
                        const paid = entry.status === 'paid';
                        // Mismo verde y mismas etiquetas que la pill de la
                        // facturación global: es el mismo dato en dos sitios.
                        const c = paid ? th.colors.green : th.colors.orange;
                        return (
                          <InfoRow key={entry.id} isFirst={i === 0} isLast={i === arr.length - 1}>
                            {/* Borrar es pulsación larga sobre la fila: con la
                                pill de estado ya puesta, un ✕ al lado dejaba dos
                                dianas pegadas de 20px y la mitad de las veces se
                                pulsaba la que no era. */}
                            <TouchableOpacity
                              style={styles.billMain}
                              activeOpacity={1}
                              onLongPress={() => Alert.alert(
                                t('clients.menuDelete'),
                                t('clients.billDeleteConfirm'),
                                [
                                  { text: t('common.cancel'), style: 'cancel' },
                                  { text: t('clients.menuDelete'), style: 'destructive', onPress: () => removeClientBilling(selectedClientId, entry.id) },
                                ],
                              )}
                            >
                              <Text style={styles.rowValue} numberOfLines={1}>{entry.concept}</Text>
                              <Text style={styles.billMainDate}>{formatBillDate(entry.date, billLang)}</Text>
                            </TouchableOpacity>
                            <Text style={styles.billAmount}>{entry.amount?.toFixed(2)}€</Text>
                            <TouchableOpacity
                              style={[styles.billPill, { backgroundColor: withOpacity(c, 0.12) }]}
                              onPress={() => updateClientBillingStatus(selectedClientId, entry.id, paid ? 'pending' : 'paid')}
                              activeOpacity={0.75}
                              hitSlop={8}
                            >
                              <Text style={[styles.billPillText, { color: c }]}>
                                {paid ? t('clients.statusPaid') : t('clients.billPending')}
                              </Text>
                            </TouchableOpacity>
                          </InfoRow>
                        );
                      })}
                    </View>
                    <Text style={styles.infoHint}>{t('clients.info.billHint')}</Text>
                  </>
                )}
              </InfoSection>

              {/* ── Conexión ── */}
              <InfoSection
                title={t('clients.info.connection')}
                summary={infoSummaries.connection}
                tone={infoSummaries.connectionTone}
                open={openSections.connection}
                onToggle={() => setOpenSections((s) => ({ ...s, connection: !s.connection }))}
              >
                <ClientCodeBlock client={selectedClient} showToast={showToast} flat />
              </InfoSection>

              {/* Eliminar cliente: terciario, como el resto de salidas que no se
                  pulsan a diario. La caja roja de antes pesaba más en la
                  pantalla que cualquiera de las secciones que tiene encima. */}
              <TouchableOpacity
                style={styles.infoDanger}
                onPress={() => handleDeleteClient(selectedClientId)}
                activeOpacity={0.6}
              >
                <Text style={styles.infoDangerText}>{t('clients.deleteClientTitle')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* New program modal */}
        {showNewProgram && (
          <NewProgramSheet
            templatePrograms={templatePrograms}
            onCreateBlank={handleCreateProgram}
            onCreateFromTemplate={handleCreateFromTemplate}
            onClose={() => setShowNewProgram(false)}
          />
        )}

        {/* Calendario del peso y alta de cobro — las dos hojas que la pestaña
            Info comparte con la facturación global. */}
        {showWeightCal && (
          <BillDateSheet
            value={weightDate}
            lang={billLang}
            onPick={(iso) => { setWeightDate(iso); setShowWeightCal(false); }}
            onClose={() => setShowWeightCal(false)}
          />
        )}
        {addingBill && (
          <GlobalAddBillingSheet
            clients={clients}
            lang={billLang}
            lockedClientId={selectedClientId}
            onClose={() => setAddingBill(false)}
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
                      trainerSync.mode === 'google' || trainerSync.mode === 'apple' || trainerSync.mode === 'code' ? th.colors.green
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

      {/* Alta de cliente. Era un `<Modal>` centrado con sus propios botones;
          pasa a `DragSheet` como el resto de la app — la salida vive en el
          hueco derecho de la cabecera y abajo queda un solo botón, el que
          avanza. */}
      <DragSheet
        visible={showNewClient}
        onClose={() => setShowNewClient(false)}
        title={t('clients.newClientModal.title')}
        action={{ label: t('common.cancel'), onPress: () => setShowNewClient(false) }}
      >
        <View style={styles.formSheetBody}>
          <View>
            <Text style={styles.sheetLabel}>{t('clients.newClientModal.nameLabel')}</Text>
            <TextInput
              style={styles.sheetInput}
              placeholder={t('clients.newClientModal.namePlaceholder')}
              placeholderTextColor={th.colors.mutedLight}
              value={newClientName}
              onChangeText={setNewClientName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateClient}
            />
          </View>
          <TouchableOpacity
            style={[styles.sheetCta, !newClientName.trim() && { opacity: 0.4 }]}
            disabled={!newClientName.trim()}
            onPress={handleCreateClient}
            activeOpacity={0.85}
          >
            <Text style={styles.sheetCtaText}>{t('clients.newClientModal.createBtn')}</Text>
          </TouchableOpacity>
        </View>
      </DragSheet>
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
    ...textStyles.title,
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
  hdrNewBtnText: { ...textStyles.button, color: th.colors.onAccent },
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
  filterBadgeText: { ...textStyles.caps, color: th.colors.onAccent },
  // Unified filter sheet
  filterSheetBody: {
    gap:           spacing.lg,
    paddingBottom: spacing.sm,
  },
  filterSecTitle: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
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
  tagAddBtnText: { ...textStyles.title, lineHeight: 26, color: th.colors.onAccent },
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
  dropCheckMark:   { ...textStyles.label, fontFamily: 'Inter_900Black', color: th.colors.onAccent },
  dropItemText:    { flex: 1, ...textStyles.body, color: th.colors.text },
  dropItemTextSel: { color: th.colors.text },
  tagEmptyText: {
    ...textStyles.body,
    color:     th.colors.mutedLight,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tagActionBtn: {
    padding: spacing.xs,
  },
  tagActionText: { ...textStyles.body, color: th.colors.mutedLight },
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
  filterClearBtnText: { ...textStyles.label, color: th.colors.muted },
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
    ...textStyles.body,
    color:   th.colors.text,
  },
  // Botón "✕" para limpiar el texto del buscador (aparece al escribir)
  searchClearBtn: {
    paddingLeft: spacing.xs2,
  },
  searchClearText: {
    ...textStyles.body,
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
    ...textStyles.labelStrong,
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
    ...textStyles.label,
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
    ...textStyles.labelStrong,
    color: th.colors.onAccent,
  },
  tagRowPillX: {
    ...textStyles.labelStrong,
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
  chipText: { ...textStyles.label, color: th.colors.muted },
  chipTextActive: { color: th.colors.accent },
  chipCountBadge: {
    marginLeft:      4,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.full,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  chipCountText: { ...textStyles.label, color: th.colors.muted },
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
  emptyTitle: { ...textStyles.bodyStrong, color: th.colors.text },
  emptyBody: {
    ...textStyles.body,
    color:        th.colors.muted,
    textAlign:    'center',
    lineHeight:   lh(textStyles.body.fontSize),
    marginBottom: spacing.lg,
  },
  proBtn: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.sm,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop:       spacing.xs,
  },
  proBtnText: { ...textStyles.button, color: th.colors.bg },
  hideTabBtn: {
    marginTop:         spacing.sm,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
  },
  hideTabBtnText: { ...textStyles.label, color: th.colors.muted, textAlign: 'center' },
  emptyText: {
    ...textStyles.label,
    color:           th.colors.muted,
    textAlign:       'center',
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
  infoSheetName: { ...textStyles.itemTitle, color: th.colors.text, marginBottom: spacing.xs },
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
  infoCodeLabel: { ...textStyles.caps, color: th.colors.accent },
  // Un codigo de emparejamiento: se lee caracter a caracter, asi que el aire es
  // funcional. A 16 y no a los 22 de `code` porque comparte fila con el boton
  // de copiar.
  infoCodeText: { ...textStyles.code, fontSize: 16, color: th.colors.text },
  infoCodeSub:  { ...textStyles.label, color: th.colors.muted },
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
  infoCopyBtnText: { fontSize: 18 },
  infoSheetBtnAccent: {
    backgroundColor:   withOpacity(th.colors.accent, 0.08),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.accent, 0.25),
    borderRadius:      th.radius.md,
    alignItems:        'center',
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
  },
  infoSheetBtnTextAccent: { ...textStyles.body, color: th.colors.accent },

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
    ...textStyles.itemTitle,
    color:    th.colors.text,
    flex:     1,
    minWidth: 0,
  },
  cStreak: {
    ...textStyles.label,
    color:      th.colors.mutedLight,
    flexShrink: 0,
  },
  cCycle: {
    ...textStyles.label,
    color:      th.colors.mutedLight,
    flexShrink: 0,
  },
  cCycleNum: {
    ...textStyles.labelStrong,
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
  pendingTitle: { ...textStyles.labelStrong, color: th.colors.text },
  pendingSub:   { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.xs },
  // Misma geometría que los CTA de la tarjeta de cliente
  pendingBtn: {
    backgroundColor: th.colors.blue,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    flexShrink:      0,
  },
  pendingBtnText: { ...textStyles.button, color: th.colors.onAccent },
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
  actionLabel:   { ...textStyles.body, flex: 1, color: th.colors.text },
  actionChevron: { ...textStyles.heading, color: th.colors.muted2 },
  actionBadge: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.full,
    minWidth:          20,
    height:            20,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 6,
  },
  actionBadgeText: { ...textStyles.labelStrong, color: th.colors.onAccent },
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
  // Línea de programa: nombre y etapa a 14, los dos mutedLight. El nombre manda
  // por PESO (Bold contra Medium) y no por cuerpo — antes iba a 12 y acababa
  // siendo más pequeño que la etapa que cuelga de él.
  cProgLine: {
    ...textStyles.bodyStrong,
    color: th.colors.mutedLight,
  },
  cStageLine: {
    ...textStyles.label,
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
  // Sustituye a la línea de programa, así que va a su mismo rango.
  cAvisoText: {
    ...textStyles.bodyStrong,
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
    ...textStyles.labelStrong,
    color:       th.colors.text,
    fontVariant: ['tabular-nums'],
  },
  cPaceUnit: {
    ...textStyles.label,
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
    ...textStyles.label,
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
    ...textStyles.labelStrong,
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
    ...textStyles.labelStrong,
    color: th.colors.onAccent,
  },


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
    ...textStyles.title,
    color:      th.colors.mutedLight,
    lineHeight: 22,
    marginTop:  -2,
  },
  detailName: {
    flex: 1,
    ...textStyles.title,
    color: th.colors.text,
  },
  detailLast: {
    ...textStyles.body,
    color:      th.colors.muted,
    flexShrink: 0,
  },
  detailTabs: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
  },

  // ── Tab content ──
  histFilterRow: {
    gap:          spacing.sm,
    marginBottom: spacing.sm,
  },

  tabContent: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.lg,
    // Mismo aire entre tarjetas que la lista del historial principal.
    gap:               spacing.md,
  },

  // ── Program card ──

  // Sin `gap`: dentro de este tab cada pieza pone su propio aire (la fila de
  // botones va pegada a la tarjeta, la sección de próxima sesión bien separada).
  programTabContent: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.lg,
  },

  // Botones Secondary (variante real de Figma: surface2 sólido, sin borde).
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
  apBtnText:  { ...textStyles.button, color: th.colors.text },
  apBtnGlyph: { ...textStyles.button, color: th.colors.accent },
  // "Preparar" va dentro de una tarjeta `surface`, y sobre ella el `surface2`
  // del Secondary apenas se separa del fondo. Relleno accent al 10%, que es el
  // lenguaje que ya usa la app para "esto lleva a algo editable".
  apBtnAccent: { backgroundColor: th.tint.accent10 },

  // ── Próxima sesión ──
  apSectionLabel: {
    ...textStyles.caps,
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
    ...textStyles.itemTitle,
    color: th.colors.accent,
  },
  apNextName: {
    ...textStyles.itemTitle,
    color: th.colors.text,
  },
  apNextMeta: {
    ...textStyles.body,
    color:     th.colors.mutedLight,
    marginTop: 2,
  },
  apNextHint: {
    ...textStyles.label,
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
  // Misma voz que las filas de `MenuRow` (la hoja del "⋯" del visualizador):
  // una opción de hoja es una opción de hoja, mida lo que mida la pantalla que
  // la abre. A `labelStrong` (12) se leían por debajo del contenido.
  sheetRowText: {
    ...textStyles.bodyStrong,
    fontFamily: 'Inter_800ExtraBold',
    flex:       1,
    color:      th.colors.text,
  },
  sheetRowArrow: {
    ...textStyles.labelStrong,
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
    ...textStyles.caps,
    color: th.colors.accent,
  },
  // Dentro de la sección Conexión de Info la tarjeta ya está dentro de otra
  // `surface`: se queda con su contenido y suelta fondo, radio y padding, que
  // los pone la sección.
  codeCardFlat: { backgroundColor: 'transparent', borderRadius: 0, padding: 0 },
  codeExplain: {
    ...textStyles.body,
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
  codeText: { ...textStyles.code, color: th.colors.text },
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
    ...textStyles.labelStrong,
    color: th.colors.mutedLight,
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
    ...textStyles.caps,
    color: th.colors.orange,
  },
  lockText: {
    ...textStyles.body,
    color:      th.colors.text,
    lineHeight: lh(textStyles.body.fontSize),
  },
  lockBtn: {
    backgroundColor:   th.colors.orange,
    borderRadius:      th.radius.sm,
    paddingVertical:   spacing.sm2,
    paddingHorizontal: spacing.md,
    alignItems:        'center',
  },
  lockBtnText: {
    ...textStyles.caps,
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
  noActiveTitle: { ...textStyles.body,  color: th.colors.muted },
  noActiveSub:   { ...textStyles.label, color: th.colors.muted2 },

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
  archName: { ...textStyles.body,  color: th.colors.muted },
  archMeta: { ...textStyles.label, color: th.colors.muted2, marginTop: 2 },
  archIcon: {
    padding: spacing.xs,
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
  exMiniName:  { ...textStyles.label, color: th.colors.text },
  exMiniLast:  { ...textStyles.label, color: th.colors.muted, marginTop: 2 },
  exMiniArrow: { ...textStyles.label, color: th.colors.muted },
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
  exMiniDate: { ...textStyles.label, color: th.colors.muted },
  exMiniVal:  { ...textStyles.label, color: th.colors.text },

  // El único `input` que queda del estilo antiguo: el renombrado de etiqueta
  // del filtro de la lista, que no es parte de esta migración.
  input: {
    backgroundColor:   th.colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       th.colors.borderCard,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    ...textStyles.body,
    color:             th.colors.text,
  },

  // ══ Info — categorías plegables ═════════════════════════════════════════════
  // Cinco tarjetas `surface` con resumen en la cabecera. Dentro no hay ni un
  // borde: los campos son la lista agrupada, las etiquetas y los estados son
  // pills tintadas y las cifras van en cajas `bg`.

  infoTabContent: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.lg,
    gap:               spacing.md,
  },
  infoSec: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    overflow:        'hidden',
  },
  infoSecHead: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    minHeight:         52,
    paddingHorizontal: spacing.lg,
  },
  infoSecTitle: {
    ...textStyles.labelStrong,
    textTransform: 'uppercase',
    color:         th.colors.text,
  },
  // Ocupa el hueco que deja el título aunque esté vacío: si no, el galón se
  // pega al rótulo en las secciones sin resumen y las cabeceras no casan.
  infoSecSum: {
    ...textStyles.body,
    flex:      1,
    textAlign: 'right',
  },
  infoSecChevOpen: { transform: [{ rotate: '180deg' }] },
  infoSecBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.lg,
    gap:               spacing.lg,
    overflow:          'hidden',
  },
  // Filete a sangre: sale del padding de la tarjeta por los dos lados.
  infoSecRule: {
    height:           borders.thin,
    backgroundColor:  th.colors.border,
    marginHorizontal: -spacing.lg,
  },

  infoBlock: { gap: spacing.sm },
  infoLabel: {
    ...textStyles.caps,
    textTransform: 'uppercase',
    color:         th.colors.mutedLight,
  },
  infoHint:  { ...textStyles.label, color: th.colors.muted, lineHeight: 14 },
  infoEmpty: { ...textStyles.body, color: th.colors.muted },

  // ── Estado: tres botones sin borde, el activo tintado con su propio color ──
  stRow: { flexDirection: 'row', gap: spacing.sm },
  stBtn: {
    flex:            1,
    height:          38,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
  },
  stDot:     { width: 6, height: 6, borderRadius: 3 },
  stBtnText: { ...textStyles.labelStrong, textTransform: 'uppercase', color: th.colors.mutedLight },

  // ── Etiquetas ──
  tagRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tagPill: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm2,
    borderRadius:      th.radius.full,
    backgroundColor:   th.colors.surface2,
  },
  tagPillOn:     { backgroundColor: th.tint.accent10 },
  // Mismo cuerpo y mismo peso encendida o apagada: si cambiara, la pill
  // cambiaría de ancho al asignarla y la fila entera daría un salto.
  tagPillText:   { ...textStyles.labelStrong, color: th.colors.mutedLight },
  tagPillTextOn: { color: th.colors.accent },

  // ── Lista agrupada (campos, pesos, facturas) ──
  group:   { gap: spacing.xs },
  infoRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    minHeight:         44,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    backgroundColor:   th.colors.surface2,
  },
  infoRowKey: {
    ...textStyles.caps,
    textTransform: 'uppercase',
    color:         th.colors.mutedLight,
    width:         74,
  },
  // El campo ES la fila: sin caja propia, sin padding y sin altura mínima
  // propia, que la pone la fila.
  infoRowInput: {
    ...textStyles.labelStrong,
    flex:    1,
    color:   th.colors.text,
    padding: 0,
  },
  rowDate:   { ...textStyles.label, color: th.colors.mutedLight, flex: 1 },
  rowValue:  { ...textStyles.labelStrong, color: th.colors.text },
  rowDelete: { ...textStyles.labelStrong, color: th.colors.muted },

  // ── Fila de alta (peso, etiqueta nueva) ──
  addRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fld: {
    ...textStyles.labelStrong,
    height:            44,
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    color:             th.colors.text,
  },
  // Mismo campo, pero abre una hoja en vez de un teclado (la fecha del peso).
  // Repite la caja de `fld` en vez de componerse con ella: `fld` lleva estilos
  // de texto y esto es una `View`, que no los admite.
  fldBtn: {
    height:            44,
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               spacing.sm,
  },
  fldBtnText: { ...textStyles.labelStrong, color: th.colors.text, flex: 1 },
  plusBtn: {
    width:           44,
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  plusBtnText: { ...textStyles.itemTitle, color: th.colors.onAccent },

  notesBox: {
    ...textStyles.body,
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.md,
    padding:           spacing.md,
    minHeight:         88,
    textAlignVertical: 'top',
    color:             th.colors.text,
    lineHeight:        18,
  },

  // Las cifras de facturación reutilizan `billTilesRow`/`billTile*` de la
  // facturación global, solo repintadas en `bg`.

  billMain:     { flex: 1, minWidth: 0 },
  billMainDate: { ...textStyles.label, color: th.colors.muted, marginTop: spacing.xs },
  billAmount:   { ...textStyles.labelStrong, color: th.colors.text },
  // La pill de estado es la de la facturación global (`billPill`, más abajo).

  infoDanger: {
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      spacing.sm,
  },
  infoDangerText: { ...textStyles.labelStrong, color: th.colors.red },

  // ══ Facturación global — pantalla migrada ═══════════════════════════════════

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
    ...textStyles.title,
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
  // (`itemTitle`, Black 16) en vez de `title` (Black 22): son importes, no contadores de 1-3
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
    ...textStyles.itemTitle,
    textAlign:   'center',
    fontVariant: ['tabular-nums'],
  },
  // La etiqueta va ARRIBA de la cifra y en `mutedLight`: aquí nombra el dato,
  // no lo remata (al revés que en las cards de Progress).
  billTileLabel: {
    ...textStyles.caps,
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
    ...textStyles.itemTitle,
    color:      th.colors.text,
    flexShrink: 1,
  },
  // Importe a `card-type` (12) y no a `card-title` (16): es el mismo peso que el
  // número de "Ciclo NN" en la tarjeta de cliente, y deja el nombre de titular.
  billCardAmount: {
    ...textStyles.labelStrong,
    color:       th.colors.text,
    flexShrink:  0,
    fontVariant: ['tabular-nums'],
  },
  billCardMeta: {
    ...textStyles.body,
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
  billPillText: { ...textStyles.caps, textTransform: 'uppercase' },
  billEmpty: {
    ...textStyles.body,
    color:           th.colors.mutedLight,
    textAlign:       'center',
    paddingVertical: spacing.xl,
  },

  // ── Piezas comunes de hoja (alta de cliente / nuevo programa) ──
  // Mismos nombres y valores que las hojas del editor de programa: cuerpo con
  // gap `space/lg`, etiqueta `spacing-tag` mutedLight en mayúsculas, y campos
  // sobre `surface` porque el fondo de la hoja YA es `bg`.
  formSheetBody: { gap: spacing.lg, paddingBottom: spacing.sm },
  sheetLabel: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  sheetHint: {
    ...textStyles.body,
    color:        th.colors.mutedLight,
    lineHeight:   17,
    marginBottom: spacing.sm,
  },
  sheetInput: {
    ...textStyles.labelStrong,
    color:             th.colors.text,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
  },
  // Botón que avanza, al final del cuerpo — mismo que el de la hoja de cobro.
  sheetCta: {
    height:          44,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       spacing.sm,
  },
  sheetCtaText: { ...textStyles.button, color: th.colors.onAccent },
  cyclesGroup: { gap: spacing.sm },
  // Lista de plantillas: filas de hoja (`sheetRowBase`) con el tinte accent de
  // seleccionado que ya usan las tarjetas del onboarding y las filas activas
  // del planificador.
  templateList: { gap: spacing.sm },
  templateRow:  { ...sheetRowBase(th), backgroundColor: th.colors.surface },
  templateRowOn: {
    backgroundColor: th.tint.accent10,
    borderWidth:     borders.thin,
    borderColor:     th.tint.accent50,
  },
  templateRowName:   { ...textStyles.labelStrong, color: th.colors.text },
  templateRowNameOn: { color: th.colors.accent },
  templateRowMeta:   { ...textStyles.label, color: th.colors.mutedLight },

  // ── Hoja de alta de cobro ──
  billSecLabel: {
    ...textStyles.caps,
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
  billSelectText: { ...textStyles.itemTitle, color: th.colors.text, flexShrink: 1 },
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
    ...textStyles.body,
    color:   th.colors.text,
  },
  billDropItem: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
  },
  billDropItemSel:  { backgroundColor: th.tint.accent10 },
  billDropItemText: { ...textStyles.body, color: th.colors.mutedLight },
  billDropEmpty: {
    ...textStyles.body,
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
    ...textStyles.itemTitle,
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
  billCtaText: { ...textStyles.button, color: th.colors.onAccent },

  // ── Calendario (hoja de fecha) ──
  calBody: { paddingBottom: spacing.sm, gap: spacing.md },
  calNav:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calMonth: { ...textStyles.itemTitle, color: th.colors.text },
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
  calWeekDay: { ...textStyles.caps, color: th.colors.mutedLight },
  calDay: {
    width:          34,
    height:         34,
    borderRadius:   th.radius.full,
    alignItems:     'center',
    justifyContent: 'center',
  },
  calDaySel:     { backgroundColor: th.colors.accent },
  calDayToday:   { borderWidth: borders.thin, borderColor: th.tint.accent50 },
  calDayText:    { ...textStyles.labelStrong, color: th.colors.text },
  calDayTextSel: { color: th.colors.onAccent },

  // ── Buttons ──
  ghostBtn: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    borderRadius:      th.radius.sm,
  },
  ghostBtnText: { ...textStyles.body, color: th.colors.muted },

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
  modalTitle: { ...textStyles.heading, color: th.colors.text },
  modalSub:   { ...textStyles.label, color: th.colors.muted },
  // ── Import options ──
  importOption: {
    backgroundColor: th.colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  importOptionLabel: { ...textStyles.body,  color: th.colors.text },
  importOptionDesc:  { ...textStyles.label, color: th.colors.muted, marginTop: 2 },

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
  contextMenuText: { ...textStyles.body, color: th.colors.text },
});

