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
import Svg, { Path } from 'react-native-svg';
import { useStore } from '../../store/useStore';
import { useWeightUnit } from '../hooks/useWeightUnit';
import AppHeader from '../components/AppHeader';
import PaywallModal from '../components/PaywallModal';
import TrainerSyncModal from '../components/TrainerSyncModal';
import ProgressTab from '../components/stats/ProgressTab';
import { colors, spacing, typography, radius, borders, withOpacity, resolveColor } from '../theme';
import { summarizeSets } from '../../../src/utils/progression';
import { computeAdherence, requiresAttention, STATUS } from '../../../src/utils/adherence';

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
function adherenceColor(status) {
  if (status === STATUS.AT_RISK)  return colors.red;
  if (status === STATUS.SLIPPING) return colors.orange;
  if (status === STATUS.ON_TRACK) return colors.green;
  return colors.muted; // no_data / muted
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
  const stroke = active ? colors.accent : colors.muted;
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

function ShareIcon({ size = 18, color = colors.muted }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <Path
        d="M12 36V60C12 61.5913 12.6321 63.1174 13.7574 64.2426C14.8826 65.3679 16.4087 66 18 66H54C55.5913 66 57.1174 65.3679 58.2426 64.2426C59.3679 63.1174 60 61.5913 60 60V36M24 18L36 6L48 18M36 6L36 45"
        stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Filter chip ────────────────────────────────────────────────────────────────

function FilterChip({ label, active, onPress, count }) {
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
  return (
    <TouchableOpacity style={styles.ghostBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.ghostBtnText, danger && { color: colors.red }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Status dot ─────────────────────────────────────────────────────────────────

const STATUS_COLORS = { active: null, paused: colors.orange, inactive: colors.red };

// ── Accordion (for Info tab sections) ─────────────────────────────────────────

function Accordion({ label, open, onToggle, children }) {
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

// ── Session card (history tab) ─────────────────────────────────────────────────

// ── Session card helpers (mirror of HistoryScreen) ────────────────────────────

function buildSetLabel(s, i, fmtW) {
  const hasW = s.weight && Number(s.weight) > 0;
  const hasR = s.reps   && Number(s.reps)   > 0;
  const hasT = s.time   && Number(s.time)   > 0;
  const rpe  = s.rpe && Number(s.rpe) > 0 ? ` @${s.rpe}` : '';
  if (hasW && hasR) return `${fmtW(s.weight)}×${s.reps}${rpe}`;
  if (hasW && hasT) return `${fmtW(s.weight)}×${s.time}s${rpe}`;
  if (hasR)         return `${s.reps} reps${rpe}`;
  if (hasT)         return `${s.time}s${rpe}`;
  if (hasW)         return `${fmtW(s.weight)}${rpe}`;
  return `S${i + 1}`;
}

function getPillVariant(s, exConfig) {
  const hasData = (s.weight && Number(s.weight) > 0)
               || (s.reps   && Number(s.reps)   > 0)
               || (s.time   && Number(s.time)   > 0);
  if (!hasData)         return 'empty';
  if (s.done === false) return 'partial';
  if (exConfig) {
    const isTimeBased = exConfig.inputType === 'time' || exConfig.inputType === 'weight_time';
    if (isTimeBased  && exConfig.minTime && Number(s.time) < Number(exConfig.minTime)) return 'partial';
    if (!isTimeBased && exConfig.minReps && Number(s.reps) < Number(exConfig.minReps)) return 'partial';
  }
  return 'done';
}

function ClientSessionCard({ session, onDelete }) {
  const { i18n, t }   = useTranslation();
  const { fmt: fmtW } = useWeightUnit();
  const [open, setOpen] = useState(false);

  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  const allExercises = { ...exerciseLibrary, ...customExercises };

  const isFree     = session.sessionTemplateId === '__free__';
  const template   = isFree ? null : getEffectiveTemplate(session.sessionTemplateId);
  const label      = isFree ? '★' : (template?.label ?? '?');
  const name       = isFree
    ? (session.sessionName || t('freeSession.historyLabel'))
    : (template?.name ?? t('clients.sessionFallback'));
  const accent     = resolveColor(template?.color ?? 'var(--accent)');
  const durMin     = session.duration ? Math.round(session.duration / 60000) : null;
  const hasNotes   = !!session.notes?.trim()
                  || (session.exercises ?? []).some((e) => !!e.note);

  const date = new Date(session.timestamp).toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  const exConfigs = {};
  (template?.exercises ?? []).forEach((ec) => { exConfigs[ec.exerciseId] = ec; });

  return (
    <View style={styles.sesCard}>
      <TouchableOpacity
        style={[styles.sesCardHeader, { borderLeftColor: accent }]}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.75}
      >
        <View style={styles.sesCardLeft}>
          <Text style={[styles.sesTag, { color: accent }]} numberOfLines={1}>
            {t('workout.sessionLabel', { label })}
          </Text>
          <Text style={styles.sesName} numberOfLines={1}>{name}</Text>
          <View style={styles.sesMeta}>
            <Text style={styles.sesDate}>{date}</Text>
            {durMin ? <Text style={styles.sesMetaSep}>·</Text> : null}
            {durMin ? <Text style={styles.sesDate}>{durMin} min</Text> : null}
            {hasNotes && (
              <View style={styles.sesNoteTag}>
                <Text style={styles.sesNoteTagText}>NOTA</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.sesCardRight}>
          <TouchableOpacity
            onPress={() => Alert.alert(t('history.deleteTitle'), t('history.deleteConfirm'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(session.id) },
            ])}
            hitSlop={8}
            style={{ padding: spacing.xs }}
          >
            <Text style={styles.sesDelete}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.sesChevron, open && styles.sesChevronOpen]}>▾</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={styles.sesDetail}>
          {!!session.notes?.trim() && (
            <View style={styles.sesNoteSection}>
              <Text style={styles.sesNoteSectionText}>{session.notes}</Text>
            </View>
          )}
          {(session.exercises ?? []).map((ex) => {
            const def    = allExercises[ex.exerciseId];
            const exName = def
              ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
              : ex.exerciseId;
            const hasSets = (ex.sets ?? []).some((s) => s.done || s.weight || s.reps || s.time);
            if (!hasSets && !ex.note) return null;
            const exCfg = exConfigs[ex.exerciseId];
            return (
              <View key={ex.exerciseId} style={styles.sesExSection}>
                <Text style={styles.sesExName}>{exName}</Text>
                <View style={styles.sesPills}>
                  {(ex.sets ?? []).map((s, i) => {
                    const variant = getPillVariant(s, exCfg);
                    return (
                      <View key={i} style={[
                        styles.sesPill,
                        variant === 'done'    && styles.sesPillDone,
                        variant === 'partial' && styles.sesPillPartial,
                      ]}>
                        <Text style={[
                          styles.sesPillText,
                          variant === 'done'    && styles.sesPillTextDone,
                          variant === 'partial' && styles.sesPillTextPartial,
                        ]}>
                          {buildSetLabel(s, i, fmtW)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {!!ex.note && (
                  <Text style={styles.sesExNote}>📝 {ex.note}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Exercise mini-card (progress tab) ─────────────────────────────────────────

function ExerciseMiniCard({ exerciseId, logs }) {
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
              { mode: 'add_program', label: t('clients.importModal.addProgramLabel'),  desc: t('clients.importModal.addProgramDesc') },
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

// ── Program card (programs tab) ────────────────────────────────────────────────

function ProgramCard({ program, isActive, dirty, lastActivity, onAssign, onDeassign, onView, onEdit, onShare, onExport, onDelete, onUpload }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  const lastStr = lastActivity
    ? new Date(lastActivity).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : null;

  const dayCount   = getAllProgramDays(program).length;
  const stageCount = (program.stages?.length ?? 0) > 1 ? program.stages.length : null;

  const structureStr = stageCount
    ? `${stageCount} etapas · ${dayCount} días/ciclo`
    : dayCount > 0 ? `${dayCount} días/ciclo` : null;

  // 3rd button state machine
  // dirty = program assigned but not yet pushed to cloud → show "↑ Subir"
  // !dirty + active = already synced → show "✓ Asignado"
  const assignBtn = isActive
    ? dirty
      ? { label: '↑ Subir', extraStyle: styles.cBtnPrimary, extraTextStyle: styles.cBtnTextPrimary, onPress: onUpload }
      : { label: '✓ Asignado', extraStyle: styles.cBtnAssignActive, extraTextStyle: styles.cBtnTextAssignActive, onPress: null }
    : { label: t('clients.newProgramModal.assignBtn'), extraStyle: null, extraTextStyle: null, onPress: onAssign };

  return (
    <View style={[styles.progCard, isActive && styles.progCardActive]}>

      {/* Top: name + structure + share icon */}
      <View style={styles.progCardTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.progCardNameRow}>
            <Text style={styles.progCardName} numberOfLines={1}>{program.name}</Text>
            {isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVO</Text>
              </View>
            )}
          </View>
          {structureStr && (
            <Text style={styles.progCardStructure}>{structureStr}</Text>
          )}
          {lastStr && (
            <Text style={styles.progCardLastSession}>Última sesión: {lastStr}</Text>
          )}
        </View>
        {/* Share icon — top right, like 🔑 on client cards */}
        <TouchableOpacity style={styles.cIconBtn} onPress={onShare} hitSlop={8} activeOpacity={0.7}>
          <ShareIcon />
        </TouchableOpacity>
      </View>

      {/* Actions: Ver · Editar · [Asignar|✓ Asignado|↑ Subir] · ⋯ */}
      <View style={styles.progCardActions}>
        <TouchableOpacity style={styles.cBtnSecondary} onPress={onView} activeOpacity={0.85}>
          <Text style={styles.cBtnText}>Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cBtnSecondary} onPress={onEdit} activeOpacity={0.85}>
          <Text style={styles.cBtnText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cBtnSecondary, assignBtn.extraStyle]}
          onPress={assignBtn.onPress ?? undefined}
          activeOpacity={assignBtn.onPress ? 0.85 : 1}
        >
          <Text style={[styles.cBtnText, assignBtn.extraTextStyle]}>{assignBtn.label}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cBtnIcon} onPress={() => setMenuOpen(true)} activeOpacity={0.7}>
          <Text style={styles.cBtnIconText}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* ⋯ context menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setMenuOpen(false)} />
        <View style={styles.contextMenu}>
          {onUpload && (
            <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setMenuOpen(false); onUpload(); }}>
              <Text style={styles.contextMenuText}>📤 Subir a cliente</Text>
            </TouchableOpacity>
          )}
          {isActive && onDeassign && (
            <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setMenuOpen(false); onDeassign(); }}>
              <Text style={styles.contextMenuText}>Quitar asignación</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setMenuOpen(false); onExport(); }}>
            <Text style={styles.contextMenuText}>Exportar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setMenuOpen(false); onDelete(); }}>
            <Text style={[styles.contextMenuText, { color: colors.red }]}>Eliminar programa</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ── New program modal ──────────────────────────────────────────────────────────

function NewProgramModal({ templatePrograms, onCreateBlank, onCreateFromTemplate, onClose }) {
  const { t } = useTranslation();
  const [tab,              setTab]              = useState(templatePrograms.length > 0 ? 'blank' : 'blank');
  const [name,             setName]             = useState('');
  const [numSessions,      setNumSessions]      = useState(3);
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
                placeholderTextColor={colors.muted}
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
                    <Text style={[styles.templateOptionName, fromTemplateId === p.id && { color: colors.accent }]}>
                      {p.name}
                    </Text>
                    <Text style={styles.templateOptionMeta}>{p.days?.length ?? 0} sesiones</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={styles.input}
                placeholder={fromTemplateName || t('clients.newProgramModal.namePlaceholderOptional')}
                placeholderTextColor={colors.muted}
                value={fromTemplateName}
                onChangeText={setFromTemplateName}
              />
            </>
          )}

          <View style={styles.modalActions}>
            <GhostBtn label="Cancelar" onPress={onClose} />
            {tab === 'blank' ? (
              <AccentBtn label="CREAR" disabled={!name.trim()} onPress={() => name.trim() && onCreateBlank(name, numSessions)} />
            ) : (
              <AccentBtn label="ASIGNAR" disabled={!fromTemplateId} onPress={() => fromTemplateId && onCreateFromTemplate(fromTemplateId, fromTemplateName)} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Global add billing modal ──────────────────────────────────────────────────

function GlobalAddBillingModal({ clients, onClose }) {
  const { t } = useTranslation();
  const addClientBilling = useStore((s) => s.addClientBilling);
  const showToast        = useStore((s) => s.showToast);

  const clientList = useMemo(
    () => Object.values(clients ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  const [clientId,  setClientId]  = useState('');
  const [date,      setDate]      = useState(() => new Date().toISOString().split('T')[0]);
  const [concept,   setConcept]   = useState('');
  const [amount,    setAmount]    = useState('');
  const [status,    setStatus]    = useState('pending');

  function handleAdd() {
    if (!clientId || !concept.trim() || !amount || !date) return;
    addClientBilling(clientId, {
      date, concept: concept.trim(), amount: parseFloat(amount), status,
    });
    showToast('Cobro registrado', 2200, 'success');
    onClose();
  }

  const canAdd = clientId && concept.trim() && amount && date;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>NUEVA ENTRADA</Text>

          {/* Client selector */}
          <Text style={styles.fieldLabel}>CLIENTE</Text>
          <ScrollView style={{ maxHeight: 140, marginBottom: spacing.xs }} showsVerticalScrollIndicator={false}>
            {clientList.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.templateOption, clientId === c.id && styles.templateOptionActive]}
                onPress={() => setClientId(c.id)}
              >
                <Text style={[styles.templateOptionName, clientId === c.id && { color: colors.accent }]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Date + amount */}
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Fecha (AAAA-MM-DD)"
              placeholderTextColor={colors.muted}
              value={date}
              onChangeText={setDate}
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { width: 90, textAlign: 'center' }]}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              returnKeyType="next"
            />
          </View>

          {/* Concept + status */}
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Concepto"
              placeholderTextColor={colors.muted}
              value={concept}
              onChangeText={setConcept}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
            <TouchableOpacity
              style={[styles.billStatusBtnForm, status === 'paid' && styles.billStatusBtnPaid]}
              onPress={() => setStatus((s) => s === 'paid' ? 'pending' : 'paid')}
            >
              <Text style={[styles.billStatusText, status === 'paid' && styles.billStatusTextPaid]}>
                {status === 'paid' ? t('clients.billPaid') : t('clients.billPending')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalActions}>
            <GhostBtn label="Cancelar" onPress={onClose} />
            <AccentBtn label="AÑADIR" disabled={!canAdd} onPress={handleAdd} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Global billing view ────────────────────────────────────────────────────────

function GlobalBillingView({ clients, onClose, onSelectClient }) {
  const { t } = useTranslation();
  const updateClientBillingStatus = useStore((s) => s.updateClientBillingStatus);
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [showAdd,      setShowAdd]      = useState(false);

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

  const total   = filtered.reduce((a, b) => a + (b.amount ?? 0), 0);
  const paid    = filtered.filter((e) => e.status === 'paid').reduce((a, b) => a + (b.amount ?? 0), 0);
  const pending = total - paid;

  return (
    <View style={{ flex: 1 }}>
      {/* Back header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.detailName}>Facturación global</Text>
        <AccentBtn label="＋" onPress={() => setShowAdd(true)} small />
      </View>

      {showAdd && (
        <GlobalAddBillingModal clients={clients} onClose={() => setShowAdd(false)} />
      )}

      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xxl }}>
        {/* Summary tiles */}
        <View style={styles.billingRow}>
          {[
            { label: 'FACTURADO', value: `${total.toFixed(2)}€`,   color: colors.text },
            { label: 'RECIBIDO',  value: `${paid.toFixed(2)}€`,    color: colors.green },
            { label: 'PENDIENTE', value: `${pending.toFixed(2)}€`, color: pending > 0 ? colors.orange : colors.muted },
          ].map(({ label, value, color }) => (
            <View key={label} style={styles.billingTile}>
              <Text style={styles.billingTileLabel}>{label}</Text>
              <Text style={[styles.billingTileValue, { color }]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Filters */}
        <View style={{ gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md }}>
          {/* Status row */}
          <View style={styles.billFilterRow}>
            {[
              { id: 'all',     label: t('clients.filterAll')   },
              { id: 'pending', label: t('clients.billPending') },
              { id: 'paid',    label: t('clients.statusPaid')  },
            ].map(({ id, label }) => {
              const active = statusFilter === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.billFilterBtn, active && styles.billFilterBtnActive]}
                  onPress={() => setStatusFilter(id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.billFilterBtnText, active && styles.billFilterBtnTextActive]}>{label}</Text>
                  <Text style={[styles.billFilterBtnText, active && styles.billFilterBtnTextActive]}>{statusCounts[id]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {/* Period row */}
          <View style={styles.billFilterRow}>
            {[
              { id: 'all', label: t('clients.periodAll')        },
              { id: '1m',  label: t('clients.periodThisMonth')  },
              { id: '3m',  label: t('clients.periodLast3Months')},
            ].map(({ id, label }) => {
              const active = periodFilter === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.billFilterBtn, active && styles.billFilterBtnActive]}
                  onPress={() => setPeriodFilter(id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.billFilterBtnText, active && styles.billFilterBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Entries */}
        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>Sin entradas para este filtro</Text>
        ) : filtered.map((entry) => (
          <View key={entry.id} style={styles.billEntry}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <TouchableOpacity onPress={() => onSelectClient(entry.clientId)}>
                <Text style={styles.billClientLink}>{entry.clientName} ›</Text>
              </TouchableOpacity>
              <Text style={styles.billConcept} numberOfLines={1}>{entry.concept}</Text>
              <Text style={styles.billDate}>{entry.date}</Text>
            </View>
            <Text style={styles.billAmount}>{entry.amount?.toFixed(2)}€</Text>
            <TouchableOpacity
              style={[styles.billStatusBtn, entry.status === 'paid' && styles.billStatusBtnPaid]}
              onPress={() => updateClientBillingStatus(entry.clientId, entry.id, entry.status === 'paid' ? 'pending' : 'paid')}
            >
              <Text style={[styles.billStatusText, entry.status === 'paid' && styles.billStatusTextPaid]}>
                {entry.status === 'paid' ? t('clients.billPaid') : t('clients.billPending')}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Client info sheet (⋯ modal) ────────────────────────────────────────────────

function ClientInfoSheet({ client, onClose, onConnectCloud }) {
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
  return (
    <TouchableOpacity
      style={[styles.attnPill, { backgroundColor: active ? color : withOpacity(color, 0.12) }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.attnPillText, { color: active ? colors.bg : color }]}>{label}</Text>
      <View style={[styles.attnPillBadge, {
        backgroundColor: active ? withOpacity(colors.bg, 0.25) : withOpacity(color, 0.2),
      }]}>
        <Text style={[styles.attnPillBadgeText, { color: active ? colors.bg : color }]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ClientListCard({
  client, tagNames, activeProgram, lastActivityTs, isConnected, weeksTraining,
  adherence, onPress, onOpenEditor, onUploadProgram, onViewProgress, onGoInfo, newSessionsCount = 0,
}) {
  const { t } = useTranslation();
  const programDirty = client.programDirty ?? false;
  const showDirty    = isConnected && programDirty;

  // Last activity label
  let lastStr = 'Nunca';
  if (lastActivityTs) {
    const diffDays = Math.floor((Date.now() - lastActivityTs) / 86400000);
    if (diffDays === 0)      lastStr = t('dayCard.today');
    else if (diffDays === 1) lastStr = t('dayCard.yesterday');
    else                     lastStr = `Hace ${diffDays} días`;
  }

  // Program info
  const hasStages      = (activeProgram?.stages?.length ?? 0) > 0;
  const stageCount     = activeProgram?.stages?.length ?? 0;
  const stageIdx       = activeProgram?.currentStageIndex ?? 0;
  const currentStage   = hasStages ? activeProgram.stages[stageIdx] : null;
  const currentDays    = hasStages
    ? (currentStage?.days ?? [])
    : (activeProgram?.days ?? []);
  const sessPerCycle   = Math.max(1, currentDays.length);
  const doneInCycle    = activeProgram
    ? (activeProgram.stageSessionsCompleted ?? 0) % sessPerCycle
    : 0;
  const weekNum        = weeksTraining ?? 1;

  // Status dot color
  const dotColor = showDirty ? colors.orange : colors.green;

  return (
    <TouchableOpacity style={styles.cCard} onPress={onPress} activeOpacity={0.75}>

      {/* ── Row 1: Name · streak · date · Info → ── */}
      <View style={styles.cRow1}>
        <Text style={styles.cName} numberOfLines={1}>{client.name}</Text>
        {adherence?.streak >= 2 && (
          <Text style={styles.cStreak}>{t('clients.streakWeeks', { count: adherence.streak })}</Text>
        )}
        <Text style={[
          styles.cDate,
          adherence && requiresAttention(adherence.status) && { color: adherenceColor(adherence.status) },
        ]}>
          {lastStr}
        </Text>
        <TouchableOpacity onPress={onGoInfo} hitSlop={8} activeOpacity={0.7} style={styles.cInfoBtnWrap}>
          <Text style={styles.cInfoBtn}>Info →</Text>
        </TouchableOpacity>
      </View>

      {activeProgram ? (
        /* ── Program block: column layout so name spans full card width ── */
        <View style={styles.cProgramBlock}>
          {/* Row 2: Status dot · Program name (full width) */}
          <View style={styles.cRow2}>
            {showDirty ? (
              <View style={styles.cStatusBadge}>
                <Text style={styles.cStatusBadgeText}>↑</Text>
              </View>
            ) : (
              <View style={styles.cStatusDot} />
            )}
            <Text
              style={[styles.cProgName, showDirty && { color: colors.orange }]}
              numberOfLines={1}
            >
              {activeProgram.name}
              {currentStage?.name ? (
                <Text style={[styles.cStageName, showDirty && { color: colors.orange }]}>
                  {' · '}{currentStage.name}
                </Text>
              ) : null}
            </Text>
          </View>

          {/* Row 3: Weekly compliance (active clients) — falls back to program
              meta for paused/inactive or clients without history yet. */}
          {adherence && adherence.status !== STATUS.NO_DATA && adherence.status !== STATUS.MUTED ? (
            <Text style={[
              styles.cProgMeta,
              requiresAttention(adherence.status) && { color: adherenceColor(adherence.status) },
            ]}>
              {t('clients.weekCompliance', { done: adherence.weekDone, target: adherence.weekTarget })}
            </Text>
          ) : (
            <Text style={styles.cProgMeta}>
              {stageCount > 1 ? `${stageCount} etapas   ` : ''}{sessPerCycle} ses/ciclo
            </Text>
          )}

          {/* Row 4: Counters — paddingRight reserves space for the absolute button */}
          <View style={styles.cCounters}>
            <Text style={styles.cWeekNum}>{String(weekNum).padStart(2, '0')}</Text>
            <Text style={styles.cWeekLabel}> Semana</Text>
            <View style={styles.cDots}>
              {Array.from({ length: sessPerCycle }, (_, i) => (
                <View key={i} style={[styles.cDot, i < doneInCycle ? styles.cDotFull : styles.cDotEmpty]} />
              ))}
            </View>
          </View>

          {/* Button: absolute bottom-right of cProgramBlock — unaffected by tags below */}
          {showDirty ? (
            <TouchableOpacity style={styles.cBtnOrange} onPress={onUploadProgram} activeOpacity={0.85}>
              <Text style={styles.cBtnOrangeText}>↑ {t('clients.btnUploadChanges')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.cBtnOutline, newSessionsCount > 0 && styles.cBtnOutlineNew]}
              onPress={onViewProgress}
              activeOpacity={0.85}
            >
              {newSessionsCount > 0 ? (
                <View style={styles.sessionsBadge}>
                  <Text style={styles.sessionsBadgeText}>
                    {newSessionsCount > 99 ? '99+' : newSessionsCount}
                  </Text>
                </View>
              ) : (
                <Svg viewBox="0 0 24 24" width={13} height={13} fill="none"
                  stroke={colors.text} strokeWidth={2} strokeLinecap="round">
                  <Path d="M18 20V10M12 20V4M6 20v-6" />
                </Svg>
              )}
              <Text style={[styles.cBtnOutlineText, newSessionsCount > 0 && { color: colors.orange }]}>
                {t('clients.btnViewProgress')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* ── No program state ── */
        <View style={styles.cNoProgramRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.cNoProgramDot} />
              <Text style={styles.cNoProgramTitle}>Sin programa activo</Text>
            </View>
            <Text style={styles.cNoProgramSub}>Asigna un programa al cliente</Text>
          </View>
          <TouchableOpacity style={styles.cBtnAccent} onPress={onOpenEditor} activeOpacity={0.85}>
            <Text style={styles.cBtnAccentText}>+ Programa</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Tags row (no separator, just spacing) ── */}
      {(tagNames ?? []).length > 0 && (
        <View style={styles.cTagsRow}>
          {(tagNames ?? []).map((name) => (
            <View key={name} style={styles.cTagPill}>
              <Text style={styles.cTagPillText}>{name}</Text>
            </View>
          ))}
        </View>
      )}

    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function ClientsScreen() {
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

  const allExercises = { ...exerciseLibrary, ...customExercises };

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
  const [tagFilterRow,     setTagFilterRow]     = useState([]);    // all tag IDs shown in the row
  const [showTagSheet,     setShowTagSheet]     = useState(false);
  const [sortDir,          setSortDir]          = useState('desc'); // always sort by last session
  const [adherenceFilter,  setAdherenceFilter]  = useState(null);   // null | 'at_risk' | 'unreviewed'

  function cycleStatus() {
    setAdherenceFilter(null); // status cycle and adherence pills are exclusive modes
    setStatusFilter((s) => s === 'active' ? 'inactive' : s === 'inactive' ? 'all' : 'active');
  }
  function addTagToRow(id) {
    if (!tagFilterRow.includes(id)) setTagFilterRow((p) => [...p, id]);
    if (!tagFilter.includes(id))    setTagFilter((p) => [...p, id]);
  }
  function toggleTagActive(id) {
    setTagFilter((p) => p.includes(id) ? p.filter((t) => t !== id) : [...p, id]);
  }
  function removeTagFromRow(id) {
    setTagFilterRow((p) => p.filter((t) => t !== id));
    setTagFilter((p) => p.filter((t) => t !== id));
  }
  const [showNewClient,    setShowNewClient]     = useState(false);
  const [newClientName,    setNewClientName]     = useState('');

  // Detail - tags input
  const [newTag,           setNewTag]           = useState('');

  // Tag manager
  const [showTagManager,   setShowTagManager]   = useState(false);
  const [tagRenameId,      setTagRenameId]      = useState(null);
  const [tagRenameText,    setTagRenameText]    = useState('');
  const [tagCreateText,    setTagCreateText]    = useState('');
  const [tagSearchText,    setTagSearchText]    = useState('');

  // Detail - programs tab
  const [showNewProgram,   setShowNewProgram]   = useState(false);

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
  const [keyTabCopied,     setKeyTabCopied]     = useState(false);
  const [keyTabConnecting, setKeyTabConnecting] = useState(false);

  // Import
  const [importState, setImportState] = useState(null); // { fileName, parsedData }

  // Sync mode modal — shown on first visit (mode === null) or from hamburger menu
  const [showSyncModal, setShowSyncModal] = useState(false);
  const isFirstTimeSync = trainerSync.mode === null;

  // Client info sheet (⋯ button on card)
  const [infoSheetClientId, setInfoSheetClientId] = useState(null);

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
    } else {
      list.sort((a, b) => sortDir === 'desc'
        ? (lastTs[b.id] ?? 0) - (lastTs[a.id] ?? 0)
        : (lastTs[a.id] ?? 0) - (lastTs[b.id] ?? 0));
    }
    return list;
  }, [clients, search, statusFilter, tagFilter, sortDir, clientLogs, effectiveAdherenceFilter, adherenceByClient, unreviewedByClient]);

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

  function handleSelectClientProgress(clientId) {
    markHistoryViewed(clientId); // progress tab also shows history-derived data
    setSelectedClientId(clientId);
    setActiveTab('progress');
    setScopeFilter('active');
    setPeriodFilter('all');
    setOpenSections({ status: false, personal: true, weight: false, billing: false });
    setView('detail');
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
    markHistoryViewed(clientId);
    setSelectedClientId(clientId);
    setActiveTab('history');
    setScopeFilter('active');
    setPeriodFilter('all');
    setOpenSections({ status: false, personal: true, weight: false, billing: false });
    setView('detail');
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

  function handleCreateProgram(programName, numSessions) {
    if (!selectedClientId) return;
    createProgramForClient(selectedClientId, numSessions, programName);
    setShowNewProgram(false);
  }

  function handleCreateFromTemplate(templateId, customName) {
    if (!selectedClientId) return;
    const srcName = templatePrograms.find((p) => p.id === templateId)?.name ?? t('clients.programFallback');
    cloneProgramFromTemplate(templateId, {
      mode: 'managed',
      clientId: selectedClientId,
      name: customName.trim() || srcName,
    });
    setShowNewProgram(false);
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
      { id: 'programs',  label: t('clients.tabs.programs'),  icon: '🏋️' },
      { id: 'history',   label: t('clients.tabs.history'),   icon: '📋' },
      { id: 'progress',  label: t('clients.tabs.progress'),  icon: '📈' },
      { id: 'info',      label: t('clients.tabs.info'),      icon: '📝' },
      { id: 'key',       label: t('clients.tabs.key'),       icon: '🔑' },
    ];
    const PERIOD_OPTIONS = [
      { id: '7d',  label: t('clients.period.7d') },
      { id: '30d', label: t('clients.period.30d') },
      { id: 'all', label: t('clients.period.all') },
    ];

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <AppHeader />

        {/* Back + client name */}
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setView('list')} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.detailName} numberOfLines={1}>{selectedClient.name}</Text>
          <View style={styles.detailHeaderRight}>
            <TouchableOpacity onPress={handleImportPick} style={styles.detailHeaderBtn}>
              <Text style={styles.detailHeaderBtnText}>Importar</Text>
            </TouchableOpacity>
            <AccentBtn label="＋" onPress={() => setShowNewProgram(true)} small />
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {TABS.map(({ id, label, icon }) => {
            const active = activeTab === id;
            return (
              <TouchableOpacity key={id} style={styles.tabBarItem} onPress={() => setActiveTab(id)} activeOpacity={0.7}>
                <Text style={styles.tabBarIcon}>{icon}</Text>
                <Text style={[styles.tabBarLabel, active && styles.tabBarLabelActive]}>{label}</Text>
                <View style={[styles.tabBarUnderline, active && styles.tabBarUnderlineActive]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Tab: Programas ── */}
        {activeTab === 'programs' && (
          <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + spacing.xxl }]}>
            {clientPrograms.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyBody}>Sin programas. Pulsa ＋ para añadir uno.</Text>
              </View>
            ) : clientPrograms.map((program) => {
              const progIsActive = selectedClient.activeProgramId === program.id;
              const syncEnabled  = trainerSync.mode !== 'offline' && trainerSync.mode !== null && selectedClient.syncSlotId;
              const doUpload = async () => {
                try {
                  await uploadProgramToClient(selectedClientId, program.id);
                  showToast('Programa enviado', 2200, 'success');
                } catch (err) {
                  Alert.alert('Error', err.message ?? 'No se pudo subir el programa.');
                }
              };
              return (
              <ProgramCard
                key={program.id}
                program={program}
                isActive={progIsActive}
                dirty={progIsActive && (selectedClient.programDirty ?? false)}
                lastActivity={getLastActivity(program)}
                onAssign={async () => {
                  setClientActiveProgram(selectedClientId, program.id);
                  if (syncEnabled) await doUpload();
                }}
                onDeassign={() => setClientActiveProgram(selectedClientId, null)}
                onView={() => setPrintingProgram(program.id)}
                onEdit={() => setEditingProgram(program.id)}
                onShare={() => shareSpecificProgram(program.id, true)}
                onExport={() => exportSpecificProgram(program.id, true)}
                onUpload={syncEnabled ? doUpload : undefined}
                onDelete={() => Alert.alert('Eliminar programa', `¿Eliminar "${program.name}"?`, [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Eliminar', style: 'destructive', onPress: () => deleteProgram(program.id, false) },
                ])}
              />
              );
            })}
          </ScrollView>
        )}

        {/* ── Tab: Historial ── */}
        {activeTab === 'history' && (
          <ScrollView
            contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + spacing.xxl }]}
            refreshControl={selectedClient?.syncSlotId ? (
              <RefreshControl
                refreshing={refreshingHistory}
                onRefresh={handleRefreshHistory}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            ) : undefined}
          >
            {/* Filters */}
            <View style={styles.histFilterRow}>
              {PERIOD_OPTIONS.map(({ id, label }) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.histFilterBtn, periodFilter === id && styles.histFilterBtnActive]}
                  onPress={() => setPeriodFilter(id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.histFilterBtnText, periodFilter === id && styles.histFilterBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[styles.histFilterBtn, scopeFilter === 'active' && styles.histFilterBtnActive]}
                onPress={() => setScopeFilter((s) => s === 'active' ? 'all' : 'active')}
                activeOpacity={0.7}
              >
                <Text style={[styles.histFilterBtnText, scopeFilter === 'active' && styles.histFilterBtnTextActive]}>
                  {t('clients.scope.active')}
                </Text>
              </TouchableOpacity>
            </View>

            {filteredLog.length === 0 ? (
              <Text style={styles.emptyText}>Sin sesiones para este filtro</Text>
            ) : filteredLog.map((session) => (
              <ClientSessionCard
                key={session.id}
                session={session}
                onDelete={(id) => deleteClientLogEntry(selectedClientId, id)}
              />
            ))}
          </ScrollView>
        )}

        {/* ── Tab: Progresión ── */}
        {activeTab === 'progress' && (
          <ProgressTab
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
                      { id: 'active',   label: t('clients.statusActive'),   color: colors.green },
                      { id: 'paused',   label: t('clients.statusPaused'),   color: colors.orange },
                      { id: 'inactive', label: t('clients.statusInactive'), color: colors.red },
                    ].map(({ id, label, color }) => {
                      const isSel = (selectedClient.status ?? 'active') === id;
                      return (
                        <TouchableOpacity
                          key={id}
                          style={[styles.statusBtn, { borderColor: isSel ? color : colors.border, backgroundColor: isSel ? `${color}18` : colors.surface2 }]}
                          onPress={() => updateClientInfo(selectedClientId, { status: id })}
                        >
                          {isSel && <View style={[styles.statusDot, { backgroundColor: color }]} />}
                          <Text style={[styles.statusBtnText, { color: isSel ? color : colors.muted }]}>{label}</Text>
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
                      placeholderTextColor={colors.muted}
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
                      placeholderTextColor={colors.muted}
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
                    placeholderTextColor={colors.muted}
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
                    placeholderTextColor={colors.muted}
                    value={weightDate}
                    onChangeText={setWeightDate}
                    returnKeyType="next"
                  />
                  <TextInput
                    style={[styles.input, { width: 80, textAlign: 'center' }]}
                    placeholder="Peso"
                    placeholderTextColor={colors.muted}
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
                        { label: 'FACTURADO', value: `${total.toFixed(2)}€`,         color: colors.text },
                        { label: 'RECIBIDO',  value: `${paid.toFixed(2)}€`,          color: colors.green },
                        { label: 'PENDIENTE', value: `${(total - paid).toFixed(2)}€`, color: (total - paid) > 0 ? colors.orange : colors.muted },
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
                      placeholderTextColor={colors.muted}
                      value={billDate}
                      onChangeText={setBillDate}
                      returnKeyType="next"
                    />
                    <TextInput
                      style={[styles.input, { width: 90, textAlign: 'center' }]}
                      placeholder="0.00"
                      placeholderTextColor={colors.muted}
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
                      placeholderTextColor={colors.muted}
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

        {/* ── Tab: Clave ── */}
        {activeTab === 'key' && (
          <ScrollView
            contentContainerStyle={[styles.keyTabContent, { paddingBottom: insets.bottom + spacing.xxl }]}
          >
            {/* SVG llave grande */}
            <View style={styles.keyTabIcon}>
              <Svg viewBox="0 0 24 24" width={48} height={48} fill="none"
                stroke={withOpacity(colors.accent, 0.5)} strokeWidth={1.5}
                strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </Svg>
            </View>

            {selectedClient.syncSlotId ? (
              selectedClient.syncCode ? (
                /* ── Tiene código ── */
                <View style={styles.keyTabBlock}>
                  <Text style={styles.keyTabLabel}>{t('clients.keyTab.title')}</Text>
                  <View style={styles.keyTabCodeRow}>
                    <View style={styles.keyTabCodeBox}>
                      <Text style={styles.keyTabCodeText}>{selectedClient.syncCode}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.keyTabCopyBtn}
                      activeOpacity={0.7}
                      onPress={async () => {
                        await Clipboard.setStringAsync(selectedClient.syncCode);
                        setKeyTabCopied(true);
                        showToast(t('clients.keyTab.copied'), 2200, 'neutral');
                        setTimeout(() => setKeyTabCopied(false), 1800);
                      }}
                    >
                      <Svg viewBox="0 0 24 24" width={20} height={20} fill="none"
                        stroke={keyTabCopied ? colors.green : colors.accent}
                        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        {keyTabCopied
                          ? <Path d="M20 6L9 17l-5-5" />
                          : <Path d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.242a2 2 0 00-.602-1.43L16.083 2.57A2 2 0 0014.685 2H10a2 2 0 00-2 2zm0 0H6a2 2 0 00-2 2v12" />
                        }
                      </Svg>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.keyTabSubtitle}>{t('clients.keyTab.subtitle')}</Text>
                </View>
              ) : (
                /* ── Conectado pero sin código local ── */
                <View style={styles.keyTabBlock}>
                  <Text style={styles.keyTabLabel}>{t('clients.keyTab.connectedNoCode')}</Text>
                </View>
              )
            ) : (
              /* ── Sin slot — botón conectar ── */
              <View style={styles.keyTabBlock}>
                <Text style={styles.keyTabNoSlotText}>{t('clients.keyTab.noSlot')}</Text>
                <TouchableOpacity
                  style={[styles.keyTabConnectBtn, keyTabConnecting && { opacity: 0.6 }]}
                  disabled={keyTabConnecting}
                  activeOpacity={0.85}
                  onPress={async () => {
                    setKeyTabConnecting(true);
                    try {
                      await connectClientToCloud(selectedClientId);
                      showToast('Cliente conectado', 2200, 'success');
                    } catch (err) {
                      Alert.alert('Error', err.message ?? 'No se pudo conectar.');
                    } finally {
                      setKeyTabConnecting(false);
                    }
                  }}
                >
                  <Text style={styles.keyTabConnectBtnText}>
                    {keyTabConnecting ? t('clients.keyTab.connecting') : t('clients.keyTab.connect')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
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

        {/* Row 1: Title + icon + New client button */}
        <View style={styles.listTitleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.listTitle}>CLIENTES</Text>
            {/* Sync status below title */}
            <TouchableOpacity style={styles.syncInline} onPress={() => setShowSyncModal(true)} activeOpacity={0.7}>
              <View style={[
                styles.syncDotInline,
                (trainerSync.mode === 'google' || trainerSync.mode === 'code') && styles.syncDotInlineActive,
              ]} />
              <Text style={styles.syncLabelInline}>
                {trainerSync.mode === 'google' || trainerSync.mode === 'code'
                  ? `${t('clients.syncActive')}: ${trainerSync.mode === 'google' ? 'Google' : t('clients.syncModeCode')}`
                  : trainerSync.mode === 'offline'
                  ? t('clients.syncOff')
                  : t('clients.syncSetup')}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.billingBtn} onPress={() => setView('billing')} activeOpacity={0.7}>
            <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round">
              <Path d="M3 6h18M3 10h18M5 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2" />
            </Svg>
          </TouchableOpacity>
          <AccentBtn label={t('clients.newBtn')} onPress={() => setShowNewClient(true)} small />
        </View>

        {/* Row 2: Sort [↓↑] + Search + Filter [≡] */}
        <View style={styles.searchRow}>
          {/* Sort direction button */}
          <TouchableOpacity
            style={styles.searchSideBtn}
            onPress={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
            activeOpacity={0.7}
          >
            <Text style={styles.searchSideBtnIcon}>{sortDir === 'desc' ? '↓' : '↑'}</Text>
          </TouchableOpacity>

          {/* Search input */}
          <View style={styles.searchInputWrap}>
            <Svg viewBox="0 0 24 24" width={17} height={17} fill="none"
              stroke={withOpacity(colors.text, 0.55)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35" />
            </Svg>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar cliente…"
              placeholderTextColor={withOpacity(colors.text, 0.45)}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>

          {/* Filter / tag sheet button */}
          <TouchableOpacity
            style={[styles.searchSideBtn, tagFilterRow.length > 0 && styles.searchSideBtnActive]}
            onPress={() => setShowTagSheet(true)}
            activeOpacity={0.7}
          >
            <Svg viewBox="0 0 24 24" width={20} height={20} fill="none"
              stroke={tagFilterRow.length > 0 ? colors.accent : withOpacity(colors.text, 0.55)}
              strokeWidth={2} strokeLinecap="round">
              <Path d="M4 6h16M7 12h10M10 18h4" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Row 3: Status cycle + active tag pills */}
        <ScrollView
          style={styles.filterRowScroll}
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
              color={colors.red}
              active={adherenceFilter === 'at_risk'}
              onPress={() => setAdherenceFilter((f) => (f === 'at_risk' ? null : 'at_risk'))}
            />
          )}
          {unreviewedCount > 0 && (
            <AttentionPill
              label={t('clients.unreviewedPill')}
              count={unreviewedCount}
              color={colors.accent}
              active={adherenceFilter === 'unreviewed'}
              onPress={() => setAdherenceFilter((f) => (f === 'unreviewed' ? null : 'unreviewed'))}
            />
          )}

          {/* Status cycling pill */}
          <TouchableOpacity style={styles.statusPill} onPress={cycleStatus} activeOpacity={0.75}>
            <Text style={[styles.statusPillText, {
              color: statusFilter === 'active' ? colors.green
                   : statusFilter === 'inactive' ? colors.red
                   : colors.text,
            }]}>
              {statusFilter === 'active' ? 'Activos' : statusFilter === 'inactive' ? 'Inactivos' : 'Todos'}
            </Text>
            <View style={[styles.statusPillBadge, {
              backgroundColor: statusFilter === 'active'   ? withOpacity(colors.green, 0.15)
                             : statusFilter === 'inactive' ? withOpacity(colors.red,   0.15)
                             : withOpacity(colors.text,   0.1),
            }]}>
              <Text style={[styles.statusPillBadgeText, {
                color: statusFilter === 'active' ? colors.green
                     : statusFilter === 'inactive' ? colors.red
                     : colors.text,
              }]}>
                {statusFilter === 'active'
                  ? clientCounts.active
                  : statusFilter === 'inactive'
                  ? clientCounts.inactive
                  : clientCounts.total}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Active tag pills */}
          {tagFilterRow.map((id) => {
            const tagName = allTags.find((tg) => tg.id === id)?.name;
            if (!tagName) return null;
            const isActive = tagFilter.includes(id);
            return (
              <View key={id} style={[styles.tagRowPill, isActive && styles.tagRowPillActive]}>
                <TouchableOpacity onPress={() => toggleTagActive(id)} activeOpacity={0.7}>
                  <Text style={[styles.tagRowPillText, isActive && styles.tagRowPillTextActive]}>
                    {tagName}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeTagFromRow(id)} hitSlop={8} activeOpacity={0.7}>
                  <Text style={[styles.tagRowPillX, isActive && styles.tagRowPillXActive]}>×</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

      </View>

      {/* Client list */}
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
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl + insets.bottom }}
          refreshControl={
            <RefreshControl
              refreshing={refreshingList}
              onRefresh={handleRefreshList}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          renderItem={({ item: client }) => {
            const activeProgram   = programs[client.activeProgramId];
            const isConnected     = trainerSync.mode !== 'offline' && trainerSync.mode !== null && !!client.syncSlotId;
            // Last activity across the client's separated history
            const clientSessions  = clientLogs[client.id] ?? [];
            const lastActivityTs  = clientSessions.length ? Math.max(...clientSessions.map((e) => e.timestamp)) : null;
            // Weeks training on the active program (from first logged session)
            const activeTplIds    = activeProgram
              ? new Set(getAllProgramDays(activeProgram).map((d) => d.sessionTemplateId))
              : new Set();
            const activeSessions  = clientSessions.filter((e) => activeTplIds.has(e.sessionTemplateId));
            const firstActiveTs   = activeSessions.length ? Math.min(...activeSessions.map((e) => e.timestamp)) : null;
            const weeksTraining   = firstActiveTs
              ? Math.max(1, Math.ceil((Date.now() - firstActiveTs) / (7 * 24 * 60 * 60 * 1000)))
              : null;
            // Resolve tag IDs → names for display
            const clientTagNames = (client.tags ?? [])
              .map((id) => tagRegistry.find((t) => t.id === id)?.name)
              .filter(Boolean);

            return (
              <>
                <ClientListCard
                  client={client}
                  tagNames={clientTagNames}
                  activeProgram={activeProgram}
                  lastActivityTs={lastActivityTs}
                  isConnected={isConnected}
                  weeksTraining={weeksTraining}
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
                  onGoInfo={() => handleSelectClientInfo(client.id)}
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

      {/* Trainer sync mode modal */}
      <TrainerSyncModal
        visible={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        isFirstTime={isFirstTimeSync}
      />

      {/* Tag filter bottom sheet */}
      <Modal visible={showTagSheet} transparent animationType="slide" onRequestClose={() => setShowTagSheet(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowTagSheet(false)} />
        <View style={styles.tagSheet}>
          <View style={styles.infoSheetHandle} />
          <View style={styles.tagSheetHeader}>
            <Text style={styles.tagSheetTitle}>Etiquetas</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              {tagFilter.length > 0 && (
                <TouchableOpacity onPress={() => setTagFilter([])} hitSlop={8} activeOpacity={0.7}>
                  <Text style={styles.tagSheetClear}>Limpiar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { setShowTagSheet(false); setShowTagManager(true); }} hitSlop={8} activeOpacity={0.7}>
                <Text style={styles.tagSheetManage}>Gestionar ›</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search + inline create */}
          <View style={styles.tagSheetSearch}>
            <TextInput
              style={styles.tagSheetSearchInput}
              placeholder="Buscar etiqueta…"
              placeholderTextColor={colors.muted}
              value={tagSearchText}
              onChangeText={setTagSearchText}
              returnKeyType="search"
            />
          </View>

          <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
            {(() => {
              const filtered = tagSearchText.trim()
                ? allTags.filter((t) => t.name.toLowerCase().includes(tagSearchText.toLowerCase()))
                : allTags;
              const exactMatch = allTags.some(
                (t) => t.name.toLowerCase() === tagSearchText.trim().toLowerCase()
              );
              return (
                <>
                  {filtered.map(({ id, name }) => {
                    const selected = tagFilterRow.includes(id);
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[styles.tagSheetItem, selected && styles.tagSheetItemActive]}
                        onPress={() => selected ? removeTagFromRow(id) : addTagToRow(id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.tagSheetCheck, selected && styles.tagSheetCheckActive]}>
                          {selected && <Text style={styles.tagSheetCheckMark}>✓</Text>}
                        </View>
                        <Text style={[styles.tagSheetItemText, selected && { color: colors.accent }]}>{name}</Text>
                        {selected && <Text style={{ color: colors.accent, fontSize: typography.sm }}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                  {tagSearchText.trim() && !exactMatch && (
                    <TouchableOpacity
                      style={styles.tagSheetCreateRow}
                      onPress={() => {
                        const newId = createTag(tagSearchText.trim());
                        setTagFilter((prev) => [...prev, newId]);
                        setTagSearchText('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.tagSheetCreateText}>＋ Crear «{tagSearchText.trim()}»</Text>
                    </TouchableOpacity>
                  )}
                  {filtered.length === 0 && !tagSearchText.trim() && (
                    <Text style={[styles.emptyText, { paddingHorizontal: spacing.xl }]}>
                      Sin etiquetas. Créalas desde el perfil de un cliente.
                    </Text>
                  )}
                </>
              );
            })()}
          </ScrollView>

          <TouchableOpacity style={styles.tagSheetApply} onPress={() => { setShowTagSheet(false); setTagSearchText(''); }} activeOpacity={0.85}>
            <Text style={styles.tagSheetApplyText}>Aplicar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Tag manager bottom sheet */}
      <Modal visible={showTagManager} transparent animationType="slide" onRequestClose={() => setShowTagManager(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowTagManager(false)} />
        <View style={styles.tagSheet}>
          <View style={styles.infoSheetHandle} />
          <View style={styles.tagSheetHeader}>
            <Text style={styles.tagSheetTitle}>Gestionar etiquetas</Text>
          </View>

          {/* Create new tag */}
          <View style={styles.tagMgrCreateRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Nueva etiqueta…"
              placeholderTextColor={colors.muted}
              value={tagCreateText}
              onChangeText={setTagCreateText}
              returnKeyType="done"
              onSubmitEditing={() => {
                const t = tagCreateText.trim();
                if (!t || allTags.some((tag) => tag.name.toLowerCase() === t.toLowerCase())) return;
                createTag(t);
                setTagCreateText('');
              }}
            />
            <AccentBtn
              label="＋"
              small
              disabled={!tagCreateText.trim() || allTags.some((tag) => tag.name.toLowerCase() === tagCreateText.trim().toLowerCase())}
              onPress={() => {
                const t = tagCreateText.trim();
                if (!t) return;
                createTag(t);
                setTagCreateText('');
              }}
            />
          </View>

          <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
            {allTags.length === 0 ? (
              <Text style={[styles.emptyText, { paddingHorizontal: spacing.xl }]}>Sin etiquetas creadas aún</Text>
            ) : allTags.map(({ id, name }) => {
              const isRenaming = tagRenameId === id;
              const usedBy = Object.values(clients ?? {}).filter((c) => (c.tags ?? []).includes(id)).length;
              return (
                <View key={id} style={styles.tagMgrItem}>
                  {isRenaming ? (
                    <>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={tagRenameText}
                        onChangeText={setTagRenameText}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          const t = tagRenameText.trim();
                          if (t) renameTag(id, t);
                          setTagRenameId(null);
                        }}
                      />
                      <TouchableOpacity
                        style={styles.tagMgrActionBtn}
                        onPress={() => { const t = tagRenameText.trim(); if (t) renameTag(id, t); setTagRenameId(null); }}
                        hitSlop={8}
                      >
                        <Text style={[styles.tagMgrActionText, { color: colors.accent }]}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.tagMgrActionBtn} onPress={() => setTagRenameId(null)} hitSlop={8}>
                        <Text style={styles.tagMgrActionText}>✕</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tagMgrName}>{name}</Text>
                        {usedBy > 0 && (
                          <Text style={styles.tagMgrMeta}>{usedBy} cliente{usedBy > 1 ? 's' : ''}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.tagMgrActionBtn}
                        onPress={() => { setTagRenameId(id); setTagRenameText(name); }}
                        hitSlop={8}
                      >
                        <Text style={styles.tagMgrActionText}>✎</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.tagMgrActionBtn}
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
                        <Text style={[styles.tagMgrActionText, { color: colors.red }]}>✕</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* New client modal */}
      <Modal visible={showNewClient} transparent animationType="fade" onRequestClose={() => setShowNewClient(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowNewClient(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>NUEVO CLIENTE</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del cliente"
              placeholderTextColor={colors.muted}
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

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.bg,
  },

  // ── List header ──
  listHeader: {
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.xs,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
    gap:               spacing.md,   // more breathing room between header rows
  },

  // Row 1: Title + sync status + buttons
  listTitleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  listTitle: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.muted,
    letterSpacing: 2,
  },
  // Sync inline (below title)
  syncInline: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     2,
  },
  syncDotInline: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: colors.muted2,
  },
  syncDotInlineActive: { backgroundColor: colors.green },
  syncLabelInline: {
    fontSize: typography.xs,
    color:    colors.muted2,
  },

  billingBtn: {
    backgroundColor:   colors.surface,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.sm,
    width:             32,
    height:            32,
    alignItems:        'center',
    justifyContent:    'center',
  },
  billingBtnText: {
    fontSize:   16,
    lineHeight: 20,
  },

  // Row 2: Sort + Search + Filter
  searchRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  searchSideBtn: {
    width:           42,
    height:          42,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  searchSideBtnActive: {
    borderColor:     withOpacity(colors.accent, 0.4),
    backgroundColor: withOpacity(colors.accent, 0.08),
  },
  searchSideBtnIcon: {
    fontSize:   20,
    color:      withOpacity(colors.text, 0.55),
    lineHeight: 24,
  },
  searchInputWrap: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.surface,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.md,
    gap:               spacing.sm,
    height:            42,
  },
  searchInput: {
    flex:     1,
    color:    colors.text,
    fontSize: typography.base,
  },

  // Row 3: Filter pills row
  filterRowScroll: {
    marginTop: -spacing.sm,   // pull Row 3 up, reducing gap with search bar
  },
  filterRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop:     spacing.xs,
    paddingBottom:  spacing.xs,
  },
  // Attention pills (En riesgo / Sin revisar)
  attnPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingLeft:       spacing.lg,
    paddingRight:      spacing.sm + 2,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      radius.full,
    flexShrink:        0,
  },
  attnPillText: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
  },
  attnPillBadge: {
    borderRadius:      radius.full,
    minWidth:          20,
    height:            20,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 5,
    flexShrink:        0,
  },
  attnPillBadgeText: {
    fontSize:   11,
    fontWeight: typography.bold,
  },
  // Status cycle pill
  statusPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      radius.full,
    borderWidth:       1.5,
    borderColor:       colors.border,
    backgroundColor:   colors.surface,
    flexShrink:        0,
  },
  statusPillText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  statusPillBadge: {
    borderRadius:      radius.full,
    minWidth:          20,
    height:            20,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 5,
    flexShrink:        0,
  },
  statusPillBadgeText: {
    fontSize:   11,
    fontWeight: typography.bold,
    color:      colors.bg,
  },
  // Tag pills in filter row — same height as statusPill
  tagRowPill: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingLeft:       spacing.lg,
    paddingRight:      spacing.sm,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      radius.full,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    gap:               spacing.sm,   // more gap between text and ×
    flexShrink:        0,
  },
  tagRowPillActive: {
    borderColor:     colors.accent,
    backgroundColor: withOpacity(colors.accent, 0.06),
  },
  tagRowPillText: {
    fontSize:   typography.xs,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  tagRowPillTextActive: { color: colors.accent },
  tagRowPillX: {
    fontSize:   14,
    color:      colors.muted2,
    lineHeight: 16,
  },
  tagRowPillXActive: { color: colors.accent },

  // Legacy — keep chip styles for compatibility with other views
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.full,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
  },
  chipActive: {
    borderColor:     withOpacity(colors.accent, 0.4),
    backgroundColor: withOpacity(colors.accent, 0.08),
  },
  chipText: {
    fontSize:   typography.sm,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  chipTextActive: { color: colors.accent },
  chipCountBadge: {
    marginLeft:      4,
    backgroundColor: colors.surface,
    borderRadius:    radius.full,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  chipCountText: { fontSize: typography.xs, color: colors.muted },
  chipCountBadgeActive: { backgroundColor: withOpacity(colors.accent, 0.15) },
  chipCountTextActive: { color: colors.accent },
  syncIndicator: {},
  syncDot: {},
  syncDotActive: {},
  syncTextWrap: {},
  syncLabel: {},
  syncMode: {},
  sortTagRow: {},
  sortBtn: {},
  sortBtnActive: {},
  sortBtnText: {},
  sortBtnTextActive: {},
  sortTagClear: {},
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },

  // ── Tag filter bottom sheet ──
  tagSheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth:       borders.thin,
    borderTopColor:       colors.borderCard,
    paddingBottom:        spacing.xxl,
    paddingTop:           spacing.sm,
  },
  tagSheetHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.md,
  },
  tagSheetTitle: {
    fontSize:   typography.md,
    fontWeight: typography.semibold,
    color:      colors.text,
  },
  tagSheetManage: {
    fontSize:   typography.sm,
    color:      colors.accent,
    fontWeight: typography.medium,
  },
  tagSheetClear: {
    fontSize: typography.sm,
    color:    colors.red,
  },
  tagSheetSearch: {
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.sm,
  },
  tagSheetSearchInput: {
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    color:             colors.text,
    fontSize:          typography.base,
  },
  tagSheetCreateRow: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  tagSheetCreateText: {
    fontSize:   typography.base,
    color:      colors.accent,
    fontWeight: typography.medium,
  },
  tagSheetItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  tagSheetItemActive: {
    backgroundColor: `${colors.accent}08`,
  },
  tagSheetCheck: {
    width:           20,
    height:          20,
    borderRadius:    4,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  tagSheetCheckActive: {
    backgroundColor: colors.accent,
    borderColor:     colors.accent,
  },
  tagSheetCheckMark: {
    fontSize:   11,
    color:      colors.bg,
    fontWeight: typography.bold,
    lineHeight: 14,
  },
  tagSheetItemText: {
    fontSize: typography.base,
    color:    colors.muted,
  },
  tagSheetApply: {
    margin:          spacing.xl,
    marginBottom:    spacing.sm,
    backgroundColor: colors.accent,
    borderRadius:    radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  tagSheetApplyText: {
    fontSize:      typography.sm,
    fontWeight:    typography.heavy,
    color:         colors.bg,
    letterSpacing: 1,
  },

  // ── Tag manager ──
  tagMgrCreateRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  tagMgrItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  tagMgrName: {
    fontSize:   typography.base,
    color:      colors.text,
    fontWeight: typography.medium,
  },
  tagMgrMeta: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 2,
  },
  tagMgrActionBtn: {
    width:  32,
    height: 32,
    alignItems:     'center',
    justifyContent: 'center',
  },
  tagMgrActionText: {
    fontSize:   16,
    color:      colors.muted,
    lineHeight: 20,
  },

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
    color:      colors.text,
  },
  emptyBody: {
    fontSize:    typography.sm,
    color:       colors.muted,
    textAlign:   'center',
    lineHeight:  typography.sm * 1.6,
    marginBottom: spacing.lg,
  },
  proBtn: {
    backgroundColor: colors.accent,
    borderRadius:    radius.sm,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop:       spacing.xs,
  },
  proBtnText: {
    fontSize:   typography.base,
    fontWeight: typography.bold,
    color:      colors.bg,
  },
  hideTabBtn: {
    marginTop:         spacing.sm,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
  },
  hideTabBtnText: {
    fontSize:  typography.sm,
    color:     colors.muted,
    textAlign: 'center',
  },
  emptyText: {
    fontSize:  typography.sm,
    color:     colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },

  // ── Client info sheet ──
  infoSheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth:       borders.thin,
    borderTopColor:       colors.borderCard,
    paddingHorizontal:    spacing.xl,
    paddingBottom:        spacing.xxl,
    paddingTop:           spacing.sm,
    gap:                  spacing.sm,
  },
  infoSheetHandle: {
    width:           36,
    height:          4,
    backgroundColor: colors.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    spacing.sm,
  },
  infoSheetName: {
    fontSize:   typography.md,
    fontWeight: typography.heavy,
    color:      colors.text,
    marginBottom: spacing.xs,
  },
  infoCodeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  infoCodeBox: {
    flex:              1,
    backgroundColor:   withOpacity(colors.accent, 0.06),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(colors.accent, 0.2),
    borderRadius:      radius.md,
    padding:           spacing.md,
    gap:               3,
  },
  infoCodeLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 1,
  },
  infoCodeText: {
    fontSize:      typography.md,
    fontWeight:    typography.heavy,
    color:         colors.text,
    letterSpacing: 3,
  },
  infoCodeSub: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
  infoCopyBtn: {
    width:           44,
    height:          44,
    borderRadius:    radius.md,
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.2),
    alignItems:      'center',
    justifyContent:  'center',
  },
  infoCopyBtnText: { fontSize: 20 },
  infoSheetBtnAccent: {
    backgroundColor:   withOpacity(colors.accent, 0.08),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(colors.accent, 0.25),
    borderRadius:      radius.md,
    alignItems:        'center',
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
  },
  infoSheetBtnTextAccent: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.accent,
  },

  // ── Key tab ───────────────────────────────────────────────────────────────────
  keyTabContent: {
    flexGrow:          1,
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.xxl,
    alignItems:        'center',
    gap:               spacing.lg,
  },
  keyTabIcon: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: withOpacity(colors.accent, 0.06),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.15),
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.xs,
  },
  keyTabBlock: {
    width:         '100%',
    alignItems:    'center',
    gap:           spacing.md,
  },
  keyTabLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 1.2,
    textAlign:     'center',
  },
  keyTabCodeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    width:         '100%',
  },
  keyTabCodeBox: {
    flex:              1,
    backgroundColor:   withOpacity(colors.accent, 0.06),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(colors.accent, 0.2),
    borderRadius:      radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems:        'center',
  },
  keyTabCodeText: {
    fontSize:      22,
    fontWeight:    typography.heavy,
    color:         colors.text,
    letterSpacing: 4,
  },
  keyTabCopyBtn: {
    width:           52,
    height:          52,
    borderRadius:    radius.md,
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.2),
    alignItems:      'center',
    justifyContent:  'center',
  },
  keyTabSubtitle: {
    fontSize:   typography.sm,
    color:      colors.muted,
    textAlign:  'center',
    lineHeight: typography.sm * 1.5,
    paddingHorizontal: spacing.md,
  },
  keyTabNoSlotText: {
    fontSize:  typography.base,
    color:     colors.muted,
    textAlign: 'center',
  },
  keyTabConnectBtn: {
    backgroundColor:   withOpacity(colors.accent, 0.08),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(colors.accent, 0.25),
    borderRadius:      radius.md,
    alignItems:        'center',
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
  },
  keyTabConnectBtnText: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.accent,
  },

  // ── Client list card ──────────────────────────────────────────────────────────
  cCard: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    gap:             spacing.md,   // space between the three visual blocks
  },
  // Row 1: name · date · Info →
  cRow1: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           spacing.sm,
  },
  cName: {
    fontSize:   typography.lg,
    fontWeight: typography.medium,
    color:      colors.text,
    flexShrink: 1,
  },
  cDate: {
    fontSize:  typography.xs,
    color:     colors.muted,
    flexShrink: 0,
  },
  cStreak: {
    fontSize:   typography.xs,
    color:      colors.muted2,
    flexShrink: 0,
  },
  cInfoBtnWrap: {
    marginLeft: 'auto',
    flexShrink: 0,
  },
  cInfoBtn: {
    fontSize:   typography.sm,
    color:      colors.accent,
    fontWeight: typography.semibold,
  },
  // Program block — rows 2+3+4 grouped with tight gap
  cProgramBlock: {
    flexDirection: 'column',
    gap:           2,
  },
  // Row 2: status dot · program · stage
  cRow2: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  cStatusDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.green,
    flexShrink:      0,
  },
  cStatusBadge: {
    width:           18,
    height:          18,
    borderRadius:    5,
    backgroundColor: withOpacity(colors.orange, 0.18),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.orange, 0.5),
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  cStatusBadgeText: {
    fontSize:   10,
    fontWeight: typography.bold,
    color:      colors.orange,
    lineHeight: 12,
  },
  cStatusIcon: {
    fontSize:   12,
    fontWeight: typography.bold,
    lineHeight: 14,
    flexShrink: 0,
  },
  cProgName: {
    fontSize:   typography.base,
    fontWeight: typography.semibold,
    color:      colors.accent,
    flex:       1,
  },
  cStageName: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.accent,
  },
  // Row 3: meta
  cProgMeta: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
  // Row 4: counters + button
  cRow4: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  cCounters: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           3,
    paddingRight:  110,
  },
  cWeekNum: {
    fontSize:   typography.base,
    fontWeight: typography.semibold,
    color:      colors.muted,
    lineHeight: typography.base * 1.1,
  },
  cWeekLabel: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
    color:      colors.muted,
  },
  cDots: {
    flexDirection: 'row',
    gap:           5,
    alignItems:    'center',
    marginLeft:    spacing.xs,
  },
  cDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  cDotFull: {
    backgroundColor: colors.accent,
  },
  cDotEmpty: {
    backgroundColor: 'transparent',
    borderWidth:     1.5,
    borderColor:     colors.muted2,
  },
  // Contextual buttons — all share the same base dimensions
  cBtnOutline: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs + 3,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.muted2,
    backgroundColor:   'transparent',
    position:          'absolute',
    bottom:            0,
    right:             0,
  },
  cBtnOutlineText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  cBtnOutlineNew: {
    borderColor: colors.orange,
  },
  sessionsBadge: {
    width:           17,
    height:          17,
    borderRadius:    9,
    backgroundColor: colors.orange,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sessionsBadgeText: {
    fontSize:   9,
    fontWeight: typography.bold,
    color:      '#FFFFFF',
    lineHeight: 13,
  },
  cBtnOrange: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs + 3,
    borderRadius:      radius.sm,
    backgroundColor:   colors.orange,
    position:          'absolute',
    bottom:            0,
    right:             0,
  },
  cBtnOrangeText: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
    color:      colors.bg,
  },
  cBtnAccent: {
    paddingHorizontal: spacing.md + 4,
    paddingVertical:   spacing.xs + 3,
    borderRadius:      radius.sm,
    backgroundColor:   colors.accent,
    flexShrink:        0,
  },
  cBtnAccentText: {
    fontSize:   typography.sm,
    fontWeight: typography.bold,
    color:      colors.bg,
  },
  // No program state
  cNoProgramRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  cNoProgramDot: {
    width:        9,
    height:       9,
    borderRadius: 5,
    borderWidth:  1.5,
    borderColor:  colors.muted,
    flexShrink:   0,
  },
  cNoProgramTitle: {
    fontSize:   typography.sm,
    color:      colors.muted,
    fontStyle:  'italic',
  },
  cNoProgramSub: {
    fontSize:   typography.xs,
    color:      colors.muted2,
    marginTop:  2,
    marginLeft: 15,
  },
  // Tags at bottom of card — no separator, just spacing
  cTagsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  cTagPill: {
    borderWidth:       borders.thin,
    borderColor:       colors.muted2,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  cTagPillText: {
    fontSize:   typography.xs,
    color:      colors.muted,
    fontWeight: typography.medium,
  },

  // Legacy stubs — kept so detail view still compiles
  cTagInlineChip: {},
  cTagInlineChipText: {},
  cTagInlineMore: {},
  cCardMetaRow: {},
  cCardMetaDot: {},
  cCardMetaStatus: {},
  cCardMetaSep: {},
  cCardMeta: {},
  cIconBtn: {
    width:           32,
    height:          32,
    borderRadius:    radius.sm,
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cIconBtnText: {},
  cActivityBadge: {},
  cActivityDot: {},
  cActivityText: {},
  cSyncRow: {},
  cSyncError: {},
  cSyncStamp: {},
  cProgramSection: {},
  cProgramNameRow: {},
  cProgramWeeks: {},
  cProgramLabel: {},
  cProgramStatusIcon: {},
  cProgramName: {},
  cProgramMeta: {},
  cTagRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  cTagChip: {},
  cTagChipRemovable: {},
  cTagChipText: {},
  cTagChipRemove: {},
  cTagMore: {},
  // Selectable tags in info tab
  cTagSelectable: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.full,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
  },
  cTagSelectableActive: {
    backgroundColor: `${colors.accent}14`,
    borderColor:     `${colors.accent}40`,
  },
  cTagSelectableTick: {
    fontSize:   typography.xs,
    color:      colors.accent,
    fontWeight: typography.bold,
  },
  cTagSelectableText: {
    fontSize:   typography.xs,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  cTagSelectableTextActive: { color: colors.accent },

  // Legacy action button stubs
  cActions: {},
  cBtnFlat: {},
  cBtnFlatPrimary: {},
  cBtnFlatBlue:    {},
  cBtnFlatText: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
    color:      colors.muted,
  },
  cBtnFlatIcon: {
    width:           32,
    height:          32,
    alignItems:      'center',
    justifyContent:  'center',
    marginLeft:      'auto',
  },
  cBtnFlatIconText: {
    fontSize:   18,
    color:      colors.muted,
    lineHeight: 20,
  },
  cBtnSecondary: {
    flex:              1,
    height:            34,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.xs,
  },
  cBtnPrimary: {
    backgroundColor: withOpacity(colors.orange, 0.12),
    borderColor:     withOpacity(colors.orange, 0.4),
  },
  cBtnBlue:             {},
  cBtnText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.muted,
  },
  cBtnTextPrimary: { color: colors.orange },
  cBtnTextBlue:    { color: colors.blue   },
  cBtnAssignActive: {
    backgroundColor: withOpacity(colors.accent, 0.10),
    borderColor:     withOpacity(colors.accent, 0.35),
  },
  cBtnTextAssignActive: { color: colors.accent },
  cBtnIcon: {
    width:           34,
    height:          34,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cBtnIconText:         { color: colors.muted, fontSize: typography.base },

  // ── Detail header ──
  detailHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  backBtn: { padding: 4 },
  backIcon: {
    fontSize:   26,
    color:      colors.muted,
    lineHeight: 28,
  },
  detailName: {
    flex:       1,
    fontSize:   typography.md,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  detailHeaderRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  detailHeaderBtn: {
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs + 2,
  },
  detailHeaderBtnText: {
    fontSize: typography.base,
    color:    colors.muted,
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection:     'row',
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  tabBarItem: {
    flex:       1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap:        2,
  },
  tabBarIcon: { fontSize: 14 },
  tabBarLabel: {
    fontSize:  typography.xs,
    color:     colors.muted,
    letterSpacing: 0.3,
  },
  tabBarLabelActive: { color: colors.accent },
  tabBarUnderline: {
    position:      'absolute',
    bottom:        0,
    left:          0,
    right:         0,
    height:        2,
    backgroundColor: 'transparent',
  },
  tabBarUnderlineActive: { backgroundColor: colors.accent },

  // ── Tab content ──
  histFilterRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    marginTop:     spacing.xs,
    marginBottom:  spacing.sm,
  },
  histFilterBtn: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius:      5,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
  },
  histFilterBtnActive: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  histFilterBtnText:       { fontSize: typography.sm, color: colors.muted, fontWeight: typography.medium },
  histFilterBtnTextActive: { color: colors.accent },

  refreshHistoryBtn: {
    backgroundColor: `${colors.accent}18`,
    borderWidth:     1,
    borderColor:     `${colors.accent}40`,
    borderRadius:    radius.sm,
    paddingVertical:   spacing.sm + 2,
    paddingHorizontal: spacing.md,
    alignItems:        'center',
  },
  refreshHistoryBtnText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.accent,
  },
  tabContent: {
    padding: spacing.xl,
    gap:     spacing.sm,
  },

  // ── Program card ──
  progCard: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.lg,
    overflow:        'hidden',
    padding:         spacing.md,
    gap:             spacing.sm,
  },
  progCardActive: {
    borderColor: `${colors.accent}50`,
  },
  progCardHead: {
    flexDirection:     'row',
    alignItems:        'center',
    padding:           spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  progCardNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    flexWrap:      'wrap',
  },
  progCardName: {
    fontSize:   typography.base,
    fontWeight: typography.semibold,
    color:      '#b0b0b0',
  },
  progCardMeta: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 2,
  },
  progCardTop: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  progCardStructure: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 2,
  },
  progCardLastSession: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 1,
  },
  progShareIcon: {
    fontSize:   18,
    lineHeight: 22,
  },
  activeBadge: {
    backgroundColor: `${colors.accent}18`,
    borderWidth:     borders.thin,
    borderColor:     `${colors.accent}50`,
    borderRadius:    radius.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical:   1,
  },
  activeBadgeText: {
    fontSize:      7,
    fontWeight:    typography.heavy,
    color:         colors.accent,
    letterSpacing: 1,
  },
  starBtn: { padding: 4 },
  starIcon: {
    fontSize: 22,
    color:    colors.muted,
  },
  progCardActions: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  progCardActionBtn: {
    flex:            1,
    paddingVertical: spacing.sm,
    alignItems:      'center',
  },
  progCardActionText: {
    fontSize: typography.sm,
    color:    colors.muted,
  },
  progCardActionDivider: {
    width:           1,
    backgroundColor: colors.border,
  },

  // ── Session card ──
  sessionCard: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderLeftWidth: 3,
    borderRadius:    radius.md,
    overflow:        'hidden',
    marginBottom:    spacing.xs,
  },
  sessionCardTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        spacing.md,
  },
  sessionCardLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
    flex:          1,
  },
  sessionLabel: {
    fontSize:   20,
    fontWeight: '900',
    lineHeight: 20,
  },
  sessionName: {
    fontSize:   typography.base,
    fontWeight: typography.bold,
    color:      colors.text,
  },
  sessionDate: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 2,
  },
  sessionCardRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  sessionDelete: {
    fontSize: typography.sm,
    color:    colors.muted,
    padding:  4,
  },
  sessionChevron: {
    fontSize: typography.sm,
    color:    colors.muted,
  },
  sessionBody: {
    paddingHorizontal: spacing.md,
    paddingBottom:     spacing.md,
    gap:               spacing.xs,
    borderTopWidth:    borders.thin,
    borderTopColor:    colors.border,
  },
  sessionExRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    paddingTop:    spacing.xs,
  },
  sessionExName: {
    flex:       1,
    fontSize:   typography.sm,
    color:      colors.text,
    fontWeight: typography.medium,
  },
  sessionExSets: {
    fontSize: typography.sm,
    color:    colors.muted,
  },
  sessionNotes: {
    fontSize:   typography.xs,
    color:      colors.muted,
    fontStyle:  'italic',
    marginTop:  spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: borders.thin,
    borderTopColor: colors.border,
  },

  // ── Client SessionCard (same format as HistoryScreen) ──────────────────────
  sesCard: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.md,
    overflow:        'hidden',
  },
  sesCardHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    padding:         spacing.md,
    borderLeftWidth: 3,
    gap:             spacing.sm,
  },
  sesCardLeft: {
    flex: 1,
    gap:  2,
  },
  sesTag: {
    fontSize:      10,
    fontWeight:    typography.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  2,
  },
  sesName: {
    fontSize:   typography.base,
    fontWeight: typography.heavy,
    color:      colors.text,
  },
  sesMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    marginTop:     3,
  },
  sesDate:    { fontSize: typography.xs, color: colors.muted },
  sesMetaSep: { fontSize: typography.xs, color: colors.muted2 },
  sesNoteTag: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.25),
    borderRadius:    3,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  sesNoteTagText: {
    fontSize:      8,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 0.5,
  },
  sesCardRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flexShrink:    0,
  },
  sesDelete:      { fontSize: typography.base, color: colors.muted2 },
  sesChevron:     { fontSize: typography.base, color: colors.muted },
  sesChevronOpen: { transform: [{ rotate: '180deg' }] },
  sesDetail: {
    borderTopWidth: borders.thin,
    borderTopColor: colors.border,
  },
  sesNoteSection: {
    padding:         spacing.md,
    backgroundColor: withOpacity(colors.accent, 0.04),
    borderLeftWidth: 2,
    borderLeftColor: withOpacity(colors.accent, 0.3),
  },
  sesNoteSectionText: {
    fontSize:   typography.sm,
    color:      colors.text,
    lineHeight: typography.sm * 1.6,
  },
  sesExSection: {
    padding:        spacing.md,
    borderTopWidth: borders.thin,
    borderTopColor: colors.border,
    gap:            spacing.xs,
  },
  sesExName: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  sesExNote: {
    fontSize:   typography.xs,
    color:      colors.accent,
    fontStyle:  'italic',
    lineHeight: 16,
  },
  sesPills: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  sesPill: {
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  sesPillDone:        { backgroundColor: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.3)' },
  sesPillPartial:     { backgroundColor: 'rgba(251,146,60,0.10)', borderColor: 'rgba(251,146,60,0.35)' },
  sesPillText:        { fontSize: typography.xs, color: colors.muted },
  sesPillTextDone:    { color: colors.green },
  sesPillTextPartial: { color: '#fb923c' },

  // ── Exercise mini card ──
  exMiniCard: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.md,
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
    color:      colors.text,
  },
  exMiniLast: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 2,
  },
  exMiniArrow: {
    fontSize: typography.sm,
    color:    colors.muted,
  },
  exMiniBody: {
    paddingHorizontal: spacing.md,
    paddingBottom:     spacing.md,
    gap:               2,
    borderTopWidth:    borders.thin,
    borderTopColor:    colors.border,
  },
  exMiniRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  exMiniDate: { fontSize: typography.xs, color: colors.muted },
  exMiniVal:  { fontSize: typography.xs, color: colors.text, fontWeight: typography.medium },

  // ── Info tab ──
  accordion: {
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
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
    color:      colors.text,
  },
  accordionArrow: { fontSize: 16, color: colors.muted },
  accordionBody:  { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },

  fieldLabel: {
    fontSize:      typography.xs,
    color:         colors.muted,
    letterSpacing: 1,
    marginBottom:  spacing.xs,
    marginTop:     spacing.xs,
    fontWeight:    typography.bold,
  },
  fieldHint: {
    fontSize: typography.xs,
    color:    colors.muted,
    marginTop: 4,
  },
  input: {
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    color:             colors.text,
    fontSize:          typography.base,
  },
  statusRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  statusBtn: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    radius.sm,
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
    borderRadius:  radius.sm,
    borderWidth:   borders.thin,
    borderColor:   colors.borderCard,
    overflow:      'hidden',
  },
  weightRow: {
    flexDirection:   'row',
    alignItems:      'center',
    padding:         spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
    gap:             spacing.sm,
  },
  weightDate: { flex: 1, fontSize: typography.sm, color: colors.muted },
  weightVal:  { fontSize: typography.base, fontWeight: typography.medium, color: colors.text },
  deleteIcon: { fontSize: typography.sm, color: colors.muted, padding: 4 },

  deleteClientBtn: {
    marginHorizontal: spacing.xl,
    marginTop:        spacing.xl,
    marginBottom:     spacing.md,
    paddingVertical:  spacing.md,
    borderRadius:     radius.sm,
    backgroundColor:  `${colors.red}15`,
    borderWidth:      borders.thin,
    borderColor:      `${colors.red}40`,
    alignItems:       'center',
  },
  deleteClientBtnText: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.red,
  },

  // ── Billing tiles ──
  billingRow: { flexDirection: 'row', gap: spacing.xs },
  billingTile: {
    flex:            1,
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.sm,
    padding:         spacing.sm,
    alignItems:      'center',
  },
  billingTileLabel: {
    fontSize:      typography.xs,
    color:         colors.muted,
    letterSpacing: 1,
    marginBottom:  3,
  },
  billingTileValue: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
  },

  // ── Billing status filter row ──
  // ── Billing filter rows (status + period) ──
  billFilterRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  billFilterBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.xs,
    paddingVertical: spacing.xs + 1,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: withOpacity(colors.surface2, 0.35),
  },
  billFilterBtnActive: {
    borderColor:     withOpacity(colors.accent, 0.3),
    backgroundColor: withOpacity(colors.accent, 0.08),
  },
  billFilterBtnText: {
    fontSize:   typography.sm,
    fontWeight: typography.regular,
    color:      colors.muted,
  },
  billFilterBtnTextActive: { color: withOpacity(colors.accent, 0.9) },
  billFilterBadge: {
    backgroundColor:   'transparent',
    borderWidth:       1,
    borderColor:       colors.border,
    borderRadius:      999,
    minWidth:          22,
    height:            22,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 5,
  },
  billFilterBadgeActive: {
    backgroundColor: colors.accent,
    borderColor:     colors.accent,
  },
  billFilterBadgeText: {
    fontSize:   11,
    fontWeight: typography.bold,
    color:      colors.muted,
  },
  billFilterBadgeTextActive: { color: colors.bg },

  // ── Billing entries ──
  billEntry: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.md,
    padding:         spacing.md,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    marginBottom:    spacing.xs,
  },
  billClientLink: {
    fontSize:      typography.xs,
    color:         colors.accent,
    marginBottom:  2,
  },
  billConcept: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  billDate: { fontSize: typography.xs, color: colors.muted, marginTop: 1 },
  billAmount: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  // Pill style for existing entries (compact)
  billStatusBtn: {
    borderWidth:       borders.thin,
    borderColor:       `${colors.orange}50`,
    backgroundColor:   `${colors.orange}10`,
    borderRadius:      radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
  },
  // Taller variant for the ADD form toggle (matches input height)
  billStatusBtnForm: {
    borderWidth:       borders.thin,
    borderColor:       `${colors.orange}50`,
    backgroundColor:   `${colors.orange}10`,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.sm,
  },
  billStatusBtnPaid: {
    borderColor:     `${colors.green}50`,
    backgroundColor: `${colors.green}10`,
  },
  billStatusText: {
    fontSize: typography.xs,
    color:    colors.orange,
  },
  billStatusTextPaid: { color: colors.green },

  // ── Buttons ──
  accentBtn: {
    backgroundColor:   colors.accent,
    borderRadius:      radius.sm,
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
    color:         colors.bg,
    letterSpacing: 1,
  },
  accentBtnTextSmall: { fontSize: typography.base, letterSpacing: 0.5 },
  ghostBtn: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.sm,
  },
  ghostBtnText: {
    fontSize: typography.base,
    color:    colors.muted,
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
    backgroundColor:   colors.surface,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.lg,
    padding:           spacing.xl,
    gap:               spacing.md,
  },
  modalTitle: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         colors.text,
    letterSpacing: 1,
  },
  modalSub: {
    fontSize: typography.sm,
    color:    colors.muted,
  },
  modalActions: {
    flexDirection: 'row',
    gap:           spacing.sm,
    justifyContent: 'flex-end',
    marginTop:     spacing.xs,
  },

  // ── Import options ──
  importOption: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.sm,
    padding:         spacing.md,
  },
  importOptionLabel: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  importOptionDesc: {
    fontSize:  typography.xs,
    color:     colors.muted,
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
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface2,
    alignItems:      'center',
  },
  tabBtnActive: {
    borderColor:     `${colors.accent}50`,
    backgroundColor: `${colors.accent}12`,
  },
  tabBtnText: { fontSize: typography.sm, color: colors.muted },
  tabBtnTextActive: { color: colors.accent },

  numRow: { flexDirection: 'row', gap: spacing.xs },
  numBtn: {
    flex:            1,
    height:          44,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  numBtnActive: {
    borderColor:     `${colors.accent}50`,
    backgroundColor: `${colors.accent}12`,
  },
  numBtnText: { fontSize: typography.xl, color: colors.text, fontWeight: typography.heavy },
  numBtnTextActive: { color: colors.accent },

  templateOption: {
    padding:         spacing.md,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface2,
    marginBottom:    spacing.xs,
  },
  templateOptionActive: {
    borderColor:     `${colors.accent}50`,
    backgroundColor: `${colors.accent}12`,
  },
  templateOptionName: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  templateOptionMeta: { fontSize: typography.xs, color: colors.muted, marginTop: 2 },

  // ── Context menu ──
  contextMenu: {
    position:        'absolute',
    bottom:          spacing.xxl * 2,
    left:            spacing.xl,
    right:           spacing.xl,
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    overflow:        'hidden',
  },
  contextMenuItem: {
    padding:           spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  contextMenuText: { fontSize: typography.base, color: colors.text },
});
