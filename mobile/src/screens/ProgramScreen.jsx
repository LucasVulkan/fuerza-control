/**
 * ProgramScreen — Mobile port of TemplatesView (web tab "Plantillas").
 *
 * Shows programs with mode='template'. Lets the user:
 *  - Create a new template (name + number of sessions)
 *  - View, edit, duplicate, export, delete templates
 *  - Assign a template to a client (PRO)
 */
import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../../store/useStore';
import AppHeader from '../components/AppHeader';
import { colors, spacing, typography, radius, borders, withOpacity } from '../theme';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getAllProgramDays(program) {
  if (program.stages?.length > 0) return program.stages.flatMap((s) => s.days ?? []);
  return program.days ?? [];
}

// ── Template card ──────────────────────────────────────────────────────────────

function TemplateCard({ program, onView, onEdit, onAssign, onShare, onMenu }) {
  const dayCount   = getAllProgramDays(program).length;
  const stageCount = (program.stages?.length ?? 0) > 1 ? program.stages.length : null;
  const structureStr = stageCount
    ? `${stageCount} etapas · ${dayCount} días/ciclo`
    : dayCount > 0 ? `${dayCount} días/ciclo` : null;

  return (
    <View style={styles.card}>
      {/* Top: name + badge + share icon */}
      <View style={styles.cardTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardName} numberOfLines={1}>{program.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>plantilla</Text>
            </View>
          </View>
          {structureStr && (
            <Text style={styles.cardMeta}>{structureStr}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.cardIconBtn} onPress={onShare} hitSlop={8} activeOpacity={0.7}>
          <Text style={styles.cardShareIcon}>📤</Text>
        </TouchableOpacity>
      </View>

      {/* Actions: Ver · Editar · Asignar · ⋯ */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.cardBtnSecondary} onPress={onView} activeOpacity={0.85}>
          <Text style={styles.cardBtnText}>Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cardBtnSecondary} onPress={onEdit} activeOpacity={0.85}>
          <Text style={styles.cardBtnText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cardBtnSecondary} onPress={onAssign} activeOpacity={0.85}>
          <Text style={styles.cardBtnText}>Asignar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cardBtnIcon} onPress={onMenu} activeOpacity={0.7}>
          <Text style={styles.cardBtnIconText}>⋯</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Create modal ───────────────────────────────────────────────────────────────

function CreateModal({ visible, onClose, onCreate }) {
  const [name,     setName]     = useState('');
  const [sessions, setSessions] = useState(3);

  function handleCreate() {
    if (!name.trim()) return;
    onCreate(name.trim(), sessions);
    setName('');
    setSessions(3);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        <View style={styles.centerModal}>
          <Text style={styles.modalTitle}>NUEVA PLANTILLA</Text>

          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Nombre de la plantilla…"
            placeholderTextColor={colors.muted2}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <Text style={styles.fieldLabel}>SESIONES</Text>
          <View style={styles.sessionPicker}>
            {[2, 3, 4, 5, 6].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.sessionBtn, sessions === n && styles.sessionBtnActive]}
                onPress={() => setSessions(n)}
              >
                <Text style={[styles.sessionBtnText, sessions === n && styles.sessionBtnTextActive]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, !name.trim() && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={!name.trim()}
            >
              <Text style={[styles.createBtnText, !name.trim() && styles.createBtnTextDisabled]}>
                CREAR
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Context menu ───────────────────────────────────────────────────────────────

function MenuOption({ label, onPress, danger }) {
  return (
    <TouchableOpacity
      style={styles.menuOption}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.menuOptionText, danger && { color: colors.red }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ContextMenu({ visible, onClose, onDuplicate, onExport, onDelete }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.contextMenu}>
        <MenuOption label="Duplicar" onPress={() => { onClose(); onDuplicate(); }} />
        <MenuOption label="Exportar" onPress={() => { onClose(); onExport(); }} />
        <MenuOption label="Eliminar" onPress={() => { onClose(); onDelete(); }} danger />
      </View>
    </Modal>
  );
}

// ── Assign to client modal ─────────────────────────────────────────────────────

function AssignToClientModal({ program, clients, onAssign, onClose }) {
  const clientList = useMemo(
    () => Object.values(clients ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  const [clientId,    setClientId]    = useState('');
  const [customName,  setCustomName]  = useState('');

  function handleAssign() {
    if (!clientId) return;
    onAssign(clientId, customName.trim() || program.name);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
        <View style={styles.assignModal}>
          <Text style={styles.modalTitle}>ASIGNAR A CLIENTE</Text>
          <Text style={styles.modalSub}>{program.name}</Text>

          {/* Client list */}
          {clientList.length === 0 ? (
            <Text style={styles.emptyText}>Sin clientes. Crea uno primero.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
              {clientList.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.clientOption, clientId === c.id && styles.clientOptionActive]}
                  onPress={() => setClientId(c.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.clientOptionText, clientId === c.id && { color: colors.accent }]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Optional custom name */}
          <TextInput
            style={styles.nameInput}
            placeholder={`Nombre (por defecto: ${program.name})`}
            placeholderTextColor={colors.muted2}
            value={customName}
            onChangeText={setCustomName}
            returnKeyType="done"
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, !clientId && styles.createBtnDisabled]}
              onPress={handleAssign}
              disabled={!clientId}
            >
              <Text style={[styles.createBtnText, !clientId && styles.createBtnTextDisabled]}>
                ASIGNAR
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ProgramScreen() {
  const insets = useSafeAreaInsets();

  const [showCreate,    setShowCreate]    = useState(false);
  const [contextTarget, setContextTarget] = useState(null); // programId or null
  const [showAssign,    setShowAssign]    = useState(false);
  const [assignTarget,  setAssignTarget]  = useState(null); // captures contextTarget before menu closes

  const programs                 = useStore((s) => s.programs);
  const sessionTemplates         = useStore((s) => s.sessionTemplates);
  const userPrograms             = useStore((s) => s.userPrograms);
  const clients                  = useStore((s) => s.clients);
  const createEmptyProgram       = useStore((s) => s.createEmptyProgram);
  const cloneProgramFromTemplate = useStore((s) => s.cloneProgramFromTemplate);
  const deleteProgram            = useStore((s) => s.deleteProgram);
  const setEditingProgram        = useStore((s) => s.setEditingProgram);
  const setPrintingProgram       = useStore((s) => s.setPrintingProgram);
  const exportSpecificProgram    = useStore((s) => s.exportSpecificProgram);
  const shareSpecificProgram     = useStore((s) => s.shareSpecificProgram);
  const showToast                = useStore((s) => s.showToast);

  const templateList = useMemo(
    () => Object.values(programs ?? {})
      .filter((p) => p.mode === 'template')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [programs]
  );

  function getExerciseCount(program) {
    return (program.days ?? []).reduce((total, { sessionTemplateId }) => {
      const tpl = userPrograms[sessionTemplateId] ?? sessionTemplates[sessionTemplateId];
      return total + (tpl?.exercises?.length ?? 0);
    }, 0);
  }

  function handleCreate(name, numSessions) {
    createEmptyProgram(numSessions, name, 'template');
    showToast('✓ Plantilla creada');
  }

  function handleDuplicate(programId) {
    const src = programs[programId];
    if (!src) return;
    cloneProgramFromTemplate(programId, { mode: 'template', name: src.name + ' (copia)' });
    showToast('✓ Plantilla duplicada');
  }

  function handleAssignToClient(clientId, programName) {
    if (!assignTarget) return;
    const newId = cloneProgramFromTemplate(assignTarget, {
      mode: 'managed', clientId, name: programName,
    });
    if (newId) {
      setEditingProgram(newId);
      showToast('✓ Asignado — abriendo editor');
    }
    setShowAssign(false);
    setAssignTarget(null);
  }

  function handleDelete(programId) {
    const name = programs[programId]?.name ?? 'esta plantilla';
    Alert.alert(
      'Eliminar plantilla',
      `¿Eliminar "${name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: () => { deleteProgram(programId, false); showToast('Plantilla eliminada'); },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />

      {/* Sub-header: title + action */}
      <View style={styles.subHeader}>
        <Text style={styles.title}>PLANTILLAS</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setShowCreate(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.newBtnText}>＋ Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {templateList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📐</Text>
          <Text style={styles.emptyTitle}>Sin plantillas</Text>
          <Text style={styles.emptyBody}>
            Crea plantillas de programa reutilizables.{'\n'}
            Podrás asignarlas a clientes o usarlas como base para nuevos programas.
          </Text>
          <TouchableOpacity
            style={styles.newBtnLarge}
            onPress={() => setShowCreate(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.newBtnLargeText}>CREAR PLANTILLA</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {templateList.map((program) => (
            <TemplateCard
              key={program.id}
              program={program}
              onView={() => setPrintingProgram(program.id)}
              onEdit={() => setEditingProgram(program.id)}
              onAssign={() => { setAssignTarget(program.id); setShowAssign(true); }}
              onShare={() => shareSpecificProgram(program.id)}
              onMenu={() => setContextTarget(program.id)}
            />
          ))}
        </ScrollView>
      )}

      {/* Create modal */}
      <CreateModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />

      {/* Context menu */}
      <ContextMenu
        visible={!!contextTarget && !showAssign}
        onClose={() => setContextTarget(null)}
        onDuplicate={() => handleDuplicate(contextTarget)}
        onExport={() => exportSpecificProgram(contextTarget)}
        onDelete={() => handleDelete(contextTarget)}
      />

      {/* Assign to client modal */}
      {showAssign && assignTarget && (
        <AssignToClientModal
          program={programs[assignTarget]}
          clients={clients}
          onAssign={handleAssignToClient}
          onClose={() => { setShowAssign(false); setAssignTarget(null); }}
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

  // Sub-header (below AppHeader)
  subHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.muted,
    letterSpacing: 2,
  },
  newBtn: {
    backgroundColor: colors.accent,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs + 2,
  },
  newBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.bg,
    letterSpacing: 0.5,
  },

  // List
  list: {
    padding:       spacing.xl,
    paddingBottom: spacing.xxl,
    gap:           spacing.sm,
  },

  // Template card
  card: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    gap:             spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  cardName: {
    fontSize:   typography.base,
    fontWeight: typography.semibold,
    color:      '#b0b0b0',
  },
  cardMeta: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 2,
  },
  badge: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.25),
    borderRadius:    radius.xs,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical:   2,
  },
  badgeText: {
    fontSize:   typography.xs,
    fontWeight: typography.bold,
    color:      colors.accent,
  },
  cardIconBtn: {
    width:           36,
    height:          36,
    borderRadius:    radius.md,
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cardShareIcon: {
    fontSize:   18,
    lineHeight: 22,
  },
  cardActions: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  cardBtnSecondary: {
    flex:              1,
    height:            36,
    borderRadius:      radius.md,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.sm,
  },
  cardBtnText: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
    color:      colors.muted,
  },
  cardBtnIcon: {
    width:           36,
    height:          36,
    borderRadius:    radius.md,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cardBtnIconText: {
    fontSize:   18,
    color:      colors.muted,
    lineHeight: 20,
  },

  // Empty state
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.xxl,
    gap:            spacing.md,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: {
    fontSize:   typography.md,
    fontWeight: typography.semibold,
    color:      colors.text,
  },
  emptyBody: {
    fontSize:   typography.base,
    color:      colors.muted,
    textAlign:  'center',
    lineHeight: typography.base * 1.6,
    maxWidth:   260,
  },
  newBtnLarge: {
    marginTop:         spacing.sm,
    backgroundColor:   colors.accent,
    borderRadius:      radius.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical:   spacing.lg,
  },
  newBtnLargeText: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.bg,
    letterSpacing: 1,
  },

  // Modals — bottom-sheet backdrop (flex:1 pushes sheet to bottom)
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  // Centered-modal backdrop (absoluteFill so KAV/card can center properly)
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },

  // Create modal — centered card (full border radius)
  centerModal: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    paddingBottom:   spacing.xxl,
    gap:             spacing.md,
  },
  modalTitle: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         colors.text,
    letterSpacing: 1,
  },
  nameInput: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.35),
    borderRadius:    radius.sm,
    color:           colors.text,
    fontSize:        typography.md,
    padding:         spacing.md,
  },
  fieldLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.muted,
    letterSpacing: 1.5,
  },
  sessionPicker: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  sessionBtn: {
    flex:            1,
    height:          44,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sessionBtnActive: {
    backgroundColor: withOpacity(colors.accent, 0.1),
    borderColor:     withOpacity(colors.accent, 0.4),
  },
  sessionBtnText: {
    fontSize:   typography.xl,
    fontWeight: typography.heavy,
    color:      colors.text,
  },
  sessionBtnTextActive: {
    color: colors.accent,
  },
  modalActions: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  cancelBtn: {
    flex:            1,
    paddingVertical: spacing.md,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    alignItems:      'center',
  },
  cancelBtnText: {
    fontSize:   typography.base,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  createBtn: {
    flex:            2,
    paddingVertical: spacing.md,
    borderRadius:    radius.sm,
    backgroundColor: colors.accent,
    alignItems:      'center',
  },
  createBtnDisabled: {
    backgroundColor: colors.surface2,
  },
  createBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.bg,
    letterSpacing: 1,
  },
  createBtnTextDisabled: {
    color: colors.muted,
  },

  // Context menu
  contextMenu: {
    backgroundColor:      colors.surface2,
    borderTopLeftRadius:  radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth:       borders.thin,
    borderTopColor:       colors.border,
    overflow:             'hidden',
  },
  menuOption: {
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  menuOptionDanger: {},
  menuOptionText: {
    fontSize:   typography.base,
    color:      colors.text,
    fontWeight: typography.medium,
  },

  // Assign to client modal
  modalWrap: {
    flex:           1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  assignModal: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    gap:             spacing.md,
  },
  modalSub: {
    fontSize:  typography.sm,
    color:     colors.muted,
    marginTop: -spacing.xs,
  },
  clientOption: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
    marginBottom:      spacing.xs,
  },
  clientOptionActive: {
    borderColor:     `${colors.accent}50`,
    backgroundColor: `${colors.accent}12`,
  },
  clientOptionText: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  emptyText: {
    fontSize:  typography.sm,
    color:     colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
});
