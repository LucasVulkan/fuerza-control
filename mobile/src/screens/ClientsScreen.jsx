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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useStore } from '../../store/useStore';
import { useWeightUnit } from '../hooks/useWeightUnit';
import AppHeader from '../components/AppHeader';
import PaywallModal from '../components/PaywallModal';
import { colors, spacing, typography, radius, borders, withOpacity, resolveColor } from '../theme';
import { summarizeSets } from '../../../src/utils/progression';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getAllProgramDays(p) {
  if (p?.stages?.length > 0) return p.stages.flatMap((st) => st.days ?? []);
  return p?.days ?? [];
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

function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
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

function ClientSessionCard({ session, onDelete }) {
  const { i18n }       = useTranslation();
  const { fmt: fmtW }  = useWeightUnit();
  const [open, setOpen] = useState(false);

  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  const allExercises = { ...exerciseLibrary, ...customExercises };

  const template = getEffectiveTemplate(session.sessionTemplateId);
  const label    = template?.label ?? '?';
  const name     = template?.name  ?? 'Sesión';
  const accent   = resolveColor(template?.color ?? 'var(--accent)');

  const date    = new Date(session.timestamp).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const durMin  = session.duration ? Math.round(session.duration / 60000) : null;

  return (
    <View style={[styles.sessionCard, { borderLeftColor: accent }]}>
      <TouchableOpacity style={styles.sessionCardTop} onPress={() => setOpen((v) => !v)} activeOpacity={0.75}>
        <View style={styles.sessionCardLeft}>
          <Text style={[styles.sessionLabel, { color: accent }]}>{label}</Text>
          <View>
            <Text style={styles.sessionName}>{name}</Text>
            <Text style={styles.sessionDate}>{date}{durMin ? ` · ${durMin} min` : ''}</Text>
          </View>
        </View>
        <View style={styles.sessionCardRight}>
          <TouchableOpacity onPress={() => Alert.alert('Eliminar sesión', '¿Eliminar esta sesión del historial?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(session.id) },
          ])} hitSlop={8}>
            <Text style={styles.sessionDelete}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.sessionChevron}>{open ? '▴' : '▾'}</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={styles.sessionBody}>
          {session.exercises?.map((ex) => {
            const def = allExercises[ex.exerciseId];
            const exName = def
              ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
              : ex.exerciseId;
            const doneSets = ex.sets?.filter((s) => s.done || s.weight || s.reps || s.time) ?? [];
            if (!doneSets.length) return null;
            return (
              <View key={ex.exerciseId} style={styles.sessionExRow}>
                <Text style={styles.sessionExName}>{exName}</Text>
                <Text style={styles.sessionExSets}>
                  {doneSets.map((s, i) => {
                    if (s.time)               return `${s.time}s`;
                    if (s.weight && s.reps)   return `${fmtW(s.weight)}×${s.reps}`;
                    if (s.reps)               return `${s.reps}r`;
                    if (s.weight)             return fmtW(s.weight);
                    return `S${i + 1}`;
                  }).join('  ')}
                </Text>
              </View>
            );
          })}
          {session.notes?.trim() ? (
            <Text style={styles.sessionNotes}>{session.notes}</Text>
          ) : null}
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
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.importModalWrap}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>IMPORTAR PROGRAMA</Text>
          <Text style={styles.modalSub} numberOfLines={1}>{fileName}</Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {[
              { mode: 'replace',     label: 'Reemplazar',         desc: 'Sustituye programa e historial existentes' },
              { mode: 'add_program', label: 'Añadir programa',    desc: 'Añade el programa sin tocar el historial' },
              { mode: 'merge_log',   label: 'Fusionar historial', desc: 'Solo importa las sesiones' },
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

function ProgramCard({ program, isActive, sessionCount, lastActivity, onToggleActive, onView, onEdit, onShare, onExport, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const locale = 'es-ES';
  const lastStr = lastActivity
    ? new Date(lastActivity).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    : null;

  return (
    <View style={[styles.progCard, isActive && styles.progCardActive]}>
      {/* Header */}
      <View style={styles.progCardHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.progCardNameRow}>
            <Text style={styles.progCardName} numberOfLines={1}>{program.name}</Text>
            {isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVO</Text>
              </View>
            )}
          </View>
          <Text style={styles.progCardMeta}>
            {sessionCount} sesiones{lastStr ? ` · última: ${lastStr}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.starBtn}
          onPress={onToggleActive}
          hitSlop={8}
        >
          <Text style={[styles.starIcon, isActive && { color: colors.accent }]}>
            {isActive ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.progCardActions}>
        <TouchableOpacity style={styles.progCardActionBtn} onPress={onView} activeOpacity={0.6}>
          <Text style={styles.progCardActionText}>Ver</Text>
        </TouchableOpacity>
        <View style={styles.progCardActionDivider} />
        <TouchableOpacity style={styles.progCardActionBtn} onPress={onEdit} activeOpacity={0.6}>
          <Text style={styles.progCardActionText}>Editar</Text>
        </TouchableOpacity>
        <View style={styles.progCardActionDivider} />
        <TouchableOpacity style={styles.progCardActionBtn} onPress={onShare} activeOpacity={0.6}>
          <Text style={styles.progCardActionText}>Compartir</Text>
        </TouchableOpacity>
        <View style={styles.progCardActionDivider} />
        <TouchableOpacity style={styles.progCardActionBtn} onPress={() => setMenuOpen(true)} activeOpacity={0.6}>
          <Text style={styles.progCardActionText}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Context menu modal */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setMenuOpen(false)} />
        <View style={styles.contextMenu}>
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
              {[{ id: 'blank', label: 'En blanco' }, { id: 'template', label: 'Desde plantilla' }].map(({ id, label }) => (
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
                placeholder={fromTemplateName || 'Nombre (opcional)'}
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
    showToast('✓ Entrada añadida');
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
                {status === 'paid' ? 'Pagado' : 'Pendiente'}
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

  const filtered = useMemo(() => {
    let list = allEntries;
    if (statusFilter !== 'all') list = list.filter((e) => e.status === statusFilter);
    if (periodFilter !== 'all') {
      const now = new Date();
      const months = periodFilter === '1m' ? 1 : 3;
      const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1).toISOString().split('T')[0];
      list = list.filter((e) => e.date >= cutoff);
    }
    return list;
  }, [allEntries, statusFilter, periodFilter]);

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

      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl }}>
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
        <View style={{ gap: spacing.xs }}>
          <View style={styles.chipRow}>
            {[{ id: 'all', label: 'Todos' }, { id: 'pending', label: 'Pendiente' }, { id: 'paid', label: 'Pagado' }].map(({ id, label }) => (
              <FilterChip key={id} label={label} active={statusFilter === id} onPress={() => setStatusFilter(id)} />
            ))}
          </View>
          <View style={styles.chipRow}>
            {[{ id: 'all', label: 'Siempre' }, { id: '1m', label: 'Este mes' }, { id: '3m', label: 'Últimos 3m' }].map(({ id, label }) => (
              <FilterChip key={id} label={label} active={periodFilter === id} onPress={() => setPeriodFilter(id)} />
            ))}
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
                {entry.status === 'paid' ? 'Pagado' : 'Pendiente'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function ClientsScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();

  // ── Store ──────────────────────────────────────────────────────────────────
  const clients                = useStore((s) => s.clients);
  const programs               = useStore((s) => s.programs);
  const workoutLog             = useStore((s) => s.workoutLog);
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
  const importForClient        = useStore((s) => s.importForClient);
  const deleteLogEntry         = useStore((s) => s.deleteLogEntry);
  const showToast              = useStore((s) => s.showToast);

  const isPro = profile.isPro ?? true;

  const allExercises = { ...exerciseLibrary, ...customExercises };

  const templatePrograms = useMemo(
    () => Object.values(programs ?? {})
      .filter((p) => p.mode === 'template')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [programs]
  );

  // ── UI State ───────────────────────────────────────────────────────────────
  const [showPaywall,      setShowPaywall]      = useState(false);
  const [view,             setView]             = useState('list'); // 'list' | 'detail' | 'billing'
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [activeTab,        setActiveTab]        = useState('programs');

  // List
  const [search,           setSearch]           = useState('');
  const [statusFilter,     setStatusFilter]     = useState('active');
  const [showNewClient,    setShowNewClient]     = useState(false);
  const [newClientName,    setNewClientName]     = useState('');

  // Detail - programs tab
  const [showNewProgram,   setShowNewProgram]   = useState(false);

  // Detail - history / progress filters
  const [scopeFilter,   setScopeFilter]   = useState('active');
  const [periodFilter,  setPeriodFilter]  = useState('all');

  // Detail - info accordion
  const [openSections,  setOpenSections]  = useState({ personal: true, weight: false, billing: false });

  // Detail - body weight
  const [weightDate,  setWeightDate]  = useState(new Date().toISOString().split('T')[0]);
  const [weightValue, setWeightValue] = useState('');

  // Detail - billing
  const [billDate,    setBillDate]    = useState(new Date().toISOString().split('T')[0]);
  const [billConcept, setBillConcept] = useState('');
  const [billAmount,  setBillAmount]  = useState('');
  const [billStatus,  setBillStatus]  = useState('pending');

  // Import
  const [importState, setImportState] = useState(null); // { fileName, parsedData }

  // ── Derived data ───────────────────────────────────────────────────────────

  const clientList = useMemo(
    () => Object.values(clients ?? {})
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      .filter((c) => {
        const s = c.status ?? 'active';
        if (statusFilter === 'active')   return s !== 'inactive';
        if (statusFilter === 'inactive') return s === 'inactive';
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    [clients, search, statusFilter]
  );

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

  const filteredLog = useMemo(() => {
    const templateIds = scopeFilter === 'active' ? activeClientTemplateIds : allClientTemplateIds;
    let log = workoutLog.filter((e) => templateIds.has(e.sessionTemplateId));
    if (periodFilter !== 'all') {
      const days = periodFilter === '7d' ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      log = log.filter((e) => e.timestamp >= cutoff);
    }
    return log.sort((a, b) => b.timestamp - a.timestamp);
  }, [workoutLog, scopeFilter, periodFilter, activeClientTemplateIds, allClientTemplateIds]);

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

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSelectClient(clientId) {
    setSelectedClientId(clientId);
    setActiveTab('programs');
    setScopeFilter('active');
    setPeriodFilter('all');
    setOpenSections({ personal: true, weight: false, billing: false });
    setView('detail');
  }

  function handleSelectClientInfo(clientId) {
    setSelectedClientId(clientId);
    setActiveTab('info');
    setScopeFilter('active');
    setPeriodFilter('all');
    setOpenSections({ personal: true, weight: false, billing: false });
    setView('detail');
  }

  function handleCreateClient() {
    if (!newClientName.trim()) return;
    createClient(newClientName.trim());
    setNewClientName('');
    setShowNewClient(false);
  }

  function handleDeleteClient(clientId) {
    Alert.alert(
      'Eliminar cliente',
      '¿Eliminar este cliente y todos sus programas e historial?',
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
    const srcName = templatePrograms.find((p) => p.id === templateId)?.name ?? 'Programa';
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

  function getSessionCount(program) {
    const ids = new Set(getAllProgramDays(program).map((d) => d.sessionTemplateId));
    return workoutLog.filter((e) => ids.has(e.sessionTemplateId)).length;
  }

  function getLastActivity(program) {
    const ids = new Set(getAllProgramDays(program).map((d) => d.sessionTemplateId));
    const sessions = workoutLog.filter((e) => ids.has(e.sessionTemplateId));
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
      { id: 'programs',  label: 'Programas',  icon: '🏋️' },
      { id: 'history',   label: 'Historial',  icon: '📋' },
      { id: 'progress',  label: 'Progresión', icon: '📈' },
      { id: 'info',      label: 'Info',       icon: '📝' },
    ];
    const PERIOD_OPTIONS = [
      { id: '7d',  label: '7 días' },
      { id: '30d', label: '30 días' },
      { id: 'all', label: 'Todo' },
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
            ) : clientPrograms.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                isActive={selectedClient.activeProgramId === program.id}
                sessionCount={getSessionCount(program)}
                lastActivity={getLastActivity(program)}
                onToggleActive={() => setClientActiveProgram(
                  selectedClientId,
                  selectedClient.activeProgramId === program.id ? null : program.id
                )}
                onView={() => setPrintingProgram(program.id)}
                onEdit={() => setEditingProgram(program.id)}
                onShare={() => shareSpecificProgram(program.id, true)}
                onExport={() => exportSpecificProgram(program.id, true)}
                onDelete={() => Alert.alert('Eliminar programa', `¿Eliminar "${program.name}"?`, [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Eliminar', style: 'destructive', onPress: () => deleteProgram(program.id, false) },
                ])}
              />
            ))}
          </ScrollView>
        )}

        {/* ── Tab: Historial ── */}
        {activeTab === 'history' && (
          <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + spacing.xxl }]}>
            {/* Filters */}
            <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
              <View style={styles.chipRow}>
                {[{ id: 'active', label: 'Programa activo' }, { id: 'all', label: 'Todos' }].map(({ id, label }) => (
                  <FilterChip key={id} label={label} active={scopeFilter === id} onPress={() => setScopeFilter(id)} />
                ))}
              </View>
              <View style={styles.chipRow}>
                {PERIOD_OPTIONS.map(({ id, label }) => (
                  <FilterChip key={id} label={label} active={periodFilter === id} onPress={() => setPeriodFilter(id)} />
                ))}
              </View>
            </View>

            {filteredLog.length === 0 ? (
              <Text style={styles.emptyText}>Sin sesiones para este filtro</Text>
            ) : filteredLog.map((session) => (
              <ClientSessionCard
                key={session.id}
                session={session}
                onDelete={(id) => deleteLogEntry(id)}
              />
            ))}
          </ScrollView>
        )}

        {/* ── Tab: Progresión ── */}
        {activeTab === 'progress' && (
          <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + spacing.xxl }]}>
            {/* Filters */}
            <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
              <View style={styles.chipRow}>
                {[{ id: 'active', label: 'Programa activo' }, { id: 'all', label: 'Todos' }].map(({ id, label }) => (
                  <FilterChip key={id} label={label} active={scopeFilter === id} onPress={() => setScopeFilter(id)} />
                ))}
              </View>
              <View style={styles.chipRow}>
                {PERIOD_OPTIONS.map(({ id, label }) => (
                  <FilterChip key={id} label={label} active={periodFilter === id} onPress={() => setPeriodFilter(id)} />
                ))}
              </View>
            </View>

            {exercisesWithLogs.length === 0 ? (
              <Text style={styles.emptyText}>Sin datos de progresión para este filtro</Text>
            ) : exercisesWithLogs.map((exerciseId) => (
              <ExerciseMiniCard
                key={exerciseId}
                exerciseId={exerciseId}
                logs={getExerciseLogs(exerciseId)}
              />
            ))}
          </ScrollView>
        )}

        {/* ── Tab: Info ── */}
        {activeTab === 'info' && (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Personal data ── */}
              <Accordion
                label="Datos personales"
                open={openSections.personal}
                onToggle={() => setOpenSections((s) => ({ ...s, personal: !s.personal }))}
              >
                {/* Status */}
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={styles.fieldLabel}>ESTADO</Text>
                  <View style={styles.statusRow}>
                    {[
                      { id: 'active',   label: 'Activo',  color: colors.green },
                      { id: 'paused',   label: 'Pausa',   color: colors.orange },
                      { id: 'inactive', label: 'Inactivo', color: colors.red },
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

                {/* Fields */}
                {[
                  { key: 'name',     label: 'NOMBRE / ALIAS',   placeholder: 'Lucas' },
                  { key: 'fullName', label: 'NOMBRE COMPLETO',  placeholder: 'Lucas García Martínez' },
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
                        {billStatus === 'paid' ? 'Pagado' : 'Pendiente'}
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
                            {entry.status === 'paid' ? 'Pagado' : 'Pendiente'}
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
                <Text style={styles.deleteClientBtnText}>Eliminar cliente</Text>
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

      {/* Search + billing button */}
      <View style={styles.listHeader}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar cliente…"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.billingBtn} onPress={() => setView('billing')} activeOpacity={0.7}>
            <Text style={styles.billingBtnText}>💳</Text>
          </TouchableOpacity>
          <AccentBtn label="＋ Nuevo" onPress={() => setShowNewClient(true)} small />
        </View>

        {/* Status filter */}
        <View style={styles.chipRow}>
          {[
            { id: 'active',   label: 'Activos' },
            { id: 'inactive', label: 'Inactivos' },
            { id: 'all',      label: 'Todos' },
          ].map(({ id, label }) => (
            <FilterChip key={id} label={label} active={statusFilter === id} onPress={() => setStatusFilter(id)} />
          ))}
        </View>
      </View>

      {/* Client list */}
      {clientList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyBody}>
            {search ? 'Sin resultados para esa búsqueda' : 'Sin clientes. Pulsa ＋ Nuevo para añadir uno.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={clientList}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xxl + insets.bottom }}
          renderItem={({ item: client }) => {
            const progCount   = (client.programIds ?? []).filter((id) => programs[id]).length;
            const statusColor = STATUS_COLORS[client.status ?? 'active'];

            return (
              <View style={styles.clientCard}>
                <TouchableOpacity
                  style={styles.clientCardMain}
                  onPress={() => handleSelectClient(client.id)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {statusColor && <View style={[styles.statusDotSmall, { backgroundColor: statusColor }]} />}
                      <Text style={styles.clientName}>{client.name}</Text>
                    </View>
                    <Text style={styles.clientMeta}>
                      {progCount} programa{progCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.clientInfoBox}
                    onPress={() => handleSelectClientInfo(client.id)}
                    hitSlop={8}
                  >
                    <Text style={styles.clientInfoBtn}>ℹ</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

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
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  searchInput: {
    flex:              1,
    backgroundColor:   colors.surface,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    color:             colors.text,
    fontSize:          typography.base,
  },
  billingBtn: {
    backgroundColor:   colors.surface,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs + 2,
    alignItems:        'center',
    justifyContent:    'center',
  },
  billingBtnText: {
    fontSize:   16,
    lineHeight: 20,
  },

  // ── Filter chips ──
  chipRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  chip: {
    flex:              1,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface,
    alignItems:        'center',
  },
  chipActive: {
    borderColor:     `${colors.accent}50`,
    backgroundColor: `${colors.accent}12`,
  },
  chipText: {
    fontSize:  typography.xs,
    color:     colors.muted,
    fontWeight: typography.medium,
  },
  chipTextActive: { color: colors.accent },

  // ── Client card (list) ──
  clientCard: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.md,
    overflow:        'hidden',
  },
  clientCardMain: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    padding:           spacing.md,
  },
  clientName: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  clientMeta: {
    fontSize: typography.xs,
    color:    colors.muted,
    marginTop: 2,
  },
  clientInfoBox: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    alignItems:        'center',
    justifyContent:    'center',
  },
  clientInfoBtn: {
    fontSize:   typography.base,
    color:      colors.muted,
    lineHeight: 18,
  },
  statusDotSmall: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },

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
  emptyText: {
    fontSize:  typography.sm,
    color:     colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },

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
  tabContent: {
    padding: spacing.xl,
    gap:     spacing.sm,
  },

  // ── Program card ──
  progCard: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.md,
    overflow:        'hidden',
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
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  progCardMeta: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 2,
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
