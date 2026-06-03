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
import { useNavigation }  from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { useStore } from '../../store/useStore';
import AppHeader from '../components/AppHeader';
import PaywallModal from '../components/PaywallModal';
import { colors, spacing, typography, radius, borders, withOpacity } from '../theme';

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function getAllProgramDays(program) {
  if (program.stages?.length > 0) return program.stages.flatMap((s) => s.days ?? []);
  return program.days ?? [];
}

// ── Template card ──────────────────────────────────────────────────────────────

function TemplateCard({ program, onView, onEdit, onAssign, onShare, onMenu }) {
  const { t }      = useTranslation();
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
          <ShareIcon />
        </TouchableOpacity>
      </View>

      {/* Actions: Ver · Editar · Asignar · ⋯ */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.cardBtnSecondary} onPress={onView} activeOpacity={0.85}>
          <Text style={styles.cardBtnText}>{t('templates.actionView')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cardBtnSecondary} onPress={onEdit} activeOpacity={0.85}>
          <Text style={styles.cardBtnText}>{t('templates.actionEdit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cardBtnSecondary} onPress={onAssign} activeOpacity={0.85}>
          <Text style={styles.cardBtnText}>{t('clients.newProgramModal.assignBtn')}</Text>
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
  const { t }          = useTranslation();
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
          <Text style={styles.modalTitle}>{t('templates.newModal.title')}</Text>

          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder={t('templates.newModal.namePlaceholder')}
            placeholderTextColor={colors.muted2}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <Text style={styles.fieldLabel}>{t('templates.newModal.sessionsLabel').toUpperCase()}</Text>
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
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, !name.trim() && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={!name.trim()}
            >
              <Text style={[styles.createBtnText, !name.trim() && styles.createBtnTextDisabled]}>
                {t('templates.newModal.createBtn')}
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
  const { t }  = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.contextMenu, { paddingBottom: insets.bottom }]}>
        <MenuOption label={t('templates.contextDuplicate')} onPress={() => { onClose(); onDuplicate(); }} />
        <MenuOption label={t('templates.contextExport')}    onPress={() => { onClose(); onExport(); }} />
        <MenuOption label={t('templates.contextDelete')}    onPress={() => { onClose(); onDelete(); }} danger />
      </View>
    </Modal>
  );
}

// ── Assign to client modal ─────────────────────────────────────────────────────

function AssignToClientModal({ program, clients, onAssign, onClose }) {
  const { t }      = useTranslation();
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
          <Text style={styles.modalTitle}>{t('templates.assignModal.title')}</Text>
          <Text style={styles.modalSub}>{program.name}</Text>

          {/* Client list */}
          {clientList.length === 0 ? (
            <Text style={styles.emptyText}>{t('templates.assignModal.noClients')}</Text>
          ) : (
            <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
              {clientList.map((c) => {
                const isSelected = clientId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.clientOption, isSelected && styles.clientOptionActive]}
                    onPress={() => setClientId(c.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.clientOptionText, isSelected && { color: colors.accent }]}>
                      {c.name}
                    </Text>
                    {isSelected && (
                      <Text style={styles.clientOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Optional custom name */}
          <TextInput
            style={styles.nameInput}
            placeholder={t('templates.assignModal.programNamePlaceholder')}
            placeholderTextColor={colors.muted2}
            value={customName}
            onChangeText={setCustomName}
            returnKeyType="done"
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, !clientId && styles.createBtnDisabled]}
              onPress={handleAssign}
              disabled={!clientId}
            >
              <Text style={[styles.createBtnText, !clientId && styles.createBtnTextDisabled]}>
                {t('templates.assignModal.assignBtn')}
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
  const { t }       = useTranslation();
  const insets      = useSafeAreaInsets();
  const navigation  = useNavigation();

  const [showCreate,    setShowCreate]    = useState(false);
  const [contextTarget, setContextTarget] = useState(null); // programId or null
  const [showAssign,    setShowAssign]    = useState(false);
  const [assignTarget,  setAssignTarget]  = useState(null); // captures contextTarget before menu closes
  const [showPaywall,   setShowPaywall]   = useState(false);

  const profile    = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const isPro      = profile?.isPro ?? true;

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
    showToast(t('templates.toastCreated'));
  }

  function handleDuplicate(programId) {
    const src = programs[programId];
    if (!src) return;
    cloneProgramFromTemplate(programId, { mode: 'template', name: src.name + t('templates.copyNameSuffix') });
    showToast(t('templates.toastDuplicated'));
  }

  function handleAssignToClient(clientId, programName) {
    if (!assignTarget) return;
    const newId = cloneProgramFromTemplate(assignTarget, {
      mode: 'managed', clientId, name: programName,
    });
    if (newId) {
      setEditingProgram(newId);
      showToast(t('templates.toastAssigned'));
    }
    setShowAssign(false);
    setAssignTarget(null);
  }

  function handleDelete(programId) {
    Alert.alert(
      t('templates.deleteTitle'),
      t('templates.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: () => { deleteProgram(programId, false); showToast(t('templates.toastDeleted')); },
        },
      ]
    );
  }

  // ── PRO gate ───────────────────────────────────────────────────────────────
  if (!isPro) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <AppHeader />
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📐</Text>
          <Text style={styles.emptyTitle}>Plantillas de entrenamiento</Text>
          <Text style={styles.emptyBody}>
            Crea plantillas y asígnalas a tus clientes en segundos. Estandariza tus programas y ahorra tiempo.
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />

      {/* Sub-header: title + action */}
      <View style={styles.subHeader}>
        <View style={styles.subHeaderRow}>
          <Text style={styles.title}>{t('templates.title').toUpperCase()}</Text>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => setShowCreate(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.newBtnText}>{t('templates.newBtn')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {templateList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📐</Text>
          <Text style={styles.emptyTitle}>{t('templates.title')}</Text>
          <Text style={styles.emptyBody}>{t('templates.empty')}</Text>
          <TouchableOpacity
            style={styles.newBtnLarge}
            onPress={() => setShowCreate(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.newBtnLargeText}>{t('templates.newModal.createBtn')}</Text>
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
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.lg,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  subHeaderRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.muted,
    letterSpacing: 2,
  },
  newBtn: {
    backgroundColor:   colors.accent,
    borderRadius:      radius.sm,
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
  proBtn: {
    backgroundColor:   colors.accent,
    borderRadius:      radius.sm,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop:         spacing.xs,
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
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  clientOptionActive: {
    borderColor:     colors.accent,
    backgroundColor: withOpacity(colors.accent, 0.1),
  },
  clientOptionText: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
    flex:       1,
  },
  clientOptionCheck: {
    fontSize:   typography.base,
    fontWeight: typography.heavy,
    color:      colors.accent,
    marginLeft: spacing.sm,
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
