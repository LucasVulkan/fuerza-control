/**
 * Import modal — mobile port of the web ImportModal.
 * Shows after a .fitdata file has been parsed successfully.
 *
 * Two layouts depending on the export type:
 *   - 'full' (backup)   → section switches (multi-select) + IMPORTAR button
 *   - program / mixed   → radio-button mode picker + IMPORTAR button
 *
 * Props:
 *   fileName    — original file name
 *   parsedData  — already-parsed JSON object
 *   onImport(parsedData, sections) — called when user confirms
 *   onClose     — called to dismiss
 */
import { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, Switch, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

// ── helpers ────────────────────────────────────────────────────────────────────

function typeLabel(exportType, hasLog) {
  if (exportType === 'full') return 'Backup completo';
  if (hasLog)               return 'Programa + historial';
  return 'Programa';
}

// ── Radio option (program-mode picker) ────────────────────────────────────────

function RadioOption({ label, desc, selected, onPress }) {
  const s = useThemedStyles(makeS);
  return (
    <TouchableOpacity
      style={[s.radioOption, selected && s.radioOptionSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[s.radioCircle, selected && s.radioCircleSelected]}>
        {selected && <View style={s.radioDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.radioLabel, selected && s.radioLabelSelected]}>{label}</Text>
        {desc ? <Text style={s.radioDesc}>{desc}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Section toggle row (backup) ───────────────────────────────────────────────

function SectionRow({ label, desc, enabled, disabled, onToggle }) {
  const th = useTheme();
  const s = useThemedStyles(makeS);
  return (
    <TouchableOpacity
      style={[s.sectionRow, enabled && !disabled && s.sectionRowActive]}
      onPress={disabled ? undefined : onToggle}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={s.sectionInfo}>
        <Text style={[s.sectionLabel, disabled && { color: th.colors.muted2 }]}>{label}</Text>
        {desc ? <Text style={s.sectionDesc}>{desc}</Text> : null}
      </View>
      <Switch
        value={enabled}
        onValueChange={disabled ? undefined : onToggle}
        disabled={disabled}
        trackColor={{ false: th.colors.border, true: th.colors.accent }}
        thumbColor={enabled ? '#FFFFFF' : th.colors.muted}
      />
    </TouchableOpacity>
  );
}

// ── Backup sections (full-backup flow) ────────────────────────────────────────

function BackupSections({ parsedData, sections, onToggle, onSetTemplatesMode }) {
  const th = useTheme();
  const s = useThemedStyles(makeS);
  const hasPrograms  = Object.keys(parsedData?.programs ?? {}).length > 0 || !!parsedData?.program;
  const hasLog       = (parsedData?.workoutLog ?? []).length > 0;
  const hasCustEx    = Object.keys(parsedData?.customExercises ?? {}).length > 0;
  const hasClients   = Object.keys(parsedData?.clients ?? {}).length > 0;
  const hasTemplates = Object.values(parsedData?.programs ?? {}).some((p) => p.mode === 'template');

  return (
    <>
      <View style={s.warning}>
        <Text style={s.warningText}>
          Los datos importados sobreescribirán los existentes en cada sección seleccionada.
        </Text>
      </View>

      <View style={s.sectionList}>
        <SectionRow
          label="Programa activo"
          desc={hasPrograms ? 'Activa el programa importado' : 'No disponible'}
          enabled={sections.program}
          disabled={!hasPrograms}
          onToggle={() => onToggle('program')}
        />
        <SectionRow
          label="Historial de sesiones"
          desc={hasLog ? `${(parsedData.workoutLog ?? []).length} sesiones` : 'No disponible'}
          enabled={sections.log}
          disabled={!hasLog}
          onToggle={() => onToggle('log')}
        />
        <SectionRow
          label="Ejercicios personalizados"
          desc={hasCustEx ? `${Object.keys(parsedData.customExercises ?? {}).length} ejercicios` : 'No disponible'}
          enabled={sections.customExercises}
          disabled={!hasCustEx}
          onToggle={() => onToggle('customExercises')}
        />
        <SectionRow
          label="Clientes"
          desc={hasClients ? `${Object.keys(parsedData.clients ?? {}).length} clientes` : 'No disponible'}
          enabled={sections.clients}
          disabled={!hasClients}
          onToggle={() => onToggle('clients')}
        />

        {/* Template section — mode buttons inside same card */}
        <View style={[s.templateCard, sections.templates && hasTemplates && s.templateCardActive]}>
          <TouchableOpacity
            style={s.templateCardRow}
            onPress={hasTemplates ? () => onToggle('templates') : undefined}
            activeOpacity={hasTemplates ? 0.7 : 1}
          >
            <View style={s.sectionInfo}>
              <Text style={[s.sectionLabel, !hasTemplates && { color: th.colors.muted2 }]}>
                Plantillas de programa
              </Text>
              <Text style={s.sectionDesc}>
                {hasTemplates ? 'Plantillas reutilizables' : 'No disponible'}
              </Text>
            </View>
            <Switch
              value={sections.templates && hasTemplates}
              onValueChange={hasTemplates ? () => onToggle('templates') : undefined}
              disabled={!hasTemplates}
              trackColor={{ false: th.colors.border, true: th.colors.accent }}
              thumbColor={sections.templates && hasTemplates ? '#FFFFFF' : th.colors.muted}
            />
          </TouchableOpacity>
          {sections.templates && hasTemplates && (
            <View style={s.templateModeRow}>
              {['merge', 'replace'].map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[s.modeBtn, sections.templatesMode === mode && s.modeBtnActive]}
                  onPress={() => onSetTemplatesMode(mode)}
                >
                  <Text style={[s.modeBtnText, sections.templatesMode === mode && s.modeBtnTextActive]}>
                    {mode === 'merge' ? 'Combinar' : 'Reemplazar'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </>
  );
}

// ── Program mode picker (non-backup flow) ─────────────────────────────────────

const PROGRAM_MODES = (hasLog) => [
  ...(hasLog ? [{
    id:       'full',
    label:    'Reemplazar programa e historial',
    desc:     'Activa el programa importado y añade su historial de sesiones',
    sections: { program: true, log: true },
  }] : []),
  ...(hasLog ? [{
    id:       'log_only',
    label:    'Solo añadir historial',
    desc:     'Mantiene el programa actual, añade las sesiones del archivo',
    sections: { program: false, log: true },
  }] : []),
  {
    id:       'program_only',
    label:    'Solo el programa',
    desc:     'Activa el programa importado, sin tocar el historial',
    sections: { program: true, log: false },
  },
];

function ProgramModes({ hasLog, selectedMode, onSelect }) {
  const s = useThemedStyles(makeS);
  const modes = PROGRAM_MODES(hasLog);
  return (
    <View style={s.modeList}>
      {modes.map((m) => (
        <RadioOption
          key={m.id}
          label={m.label}
          desc={m.desc}
          selected={selectedMode === m.id}
          onPress={() => onSelect(m.id)}
        />
      ))}
    </View>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function ImportModal({ fileName, parsedData, onImport, onClose }) {
  const s = useThemedStyles(makeS);
  const exportType = parsedData?.exportType ?? 'program';
  const isBackup   = exportType === 'full';
  const hasLog     = (parsedData?.workoutLog ?? []).length > 0;
  const badge      = typeLabel(exportType, hasLog);

  // ── Backup state ──────────────────────────────────────────────────────────
  const hasPrograms  = Object.keys(parsedData?.programs ?? {}).length > 0 || !!parsedData?.program;
  const hasLogData   = (parsedData?.workoutLog ?? []).length > 0;
  const hasCustEx    = Object.keys(parsedData?.customExercises ?? {}).length > 0;
  const hasClients   = Object.keys(parsedData?.clients ?? {}).length > 0;
  const hasTemplates = Object.values(parsedData?.programs ?? {}).some((p) => p.mode === 'template');

  const [sections, setSections] = useState({
    program:         hasPrograms,
    log:             hasLogData,
    customExercises: hasCustEx,
    clients:         hasClients,
    templates:       hasTemplates,
    templatesMode:   'merge',
  });

  // ── Program-mode state ────────────────────────────────────────────────────
  const defaultMode = hasLog ? 'full' : 'program_only';
  const [selectedMode, setSelectedMode] = useState(defaultMode);

  // ── Derived ───────────────────────────────────────────────────────────────
  const nothingSelected = isBackup
    ? !sections.program && !sections.log && !sections.customExercises
      && !sections.clients && !sections.templates
    : false; // radio always has a valid selection

  function toggle(key) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleConfirm() {
    if (isBackup) {
      onImport(parsedData, sections);
    } else {
      const modes = PROGRAM_MODES(hasLog);
      const mode  = modes.find((m) => m.id === selectedMode) ?? modes[modes.length - 1];
      onImport(parsedData, mode.sections);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.centeredOuter}
      >
        <View style={s.sheet}>
          {/* ── Header ── */}
          <Text style={s.title}>Importar archivo</Text>
          <View style={s.fileRow}>
            <Text style={s.fileName} numberOfLines={1}>{fileName}</Text>
            <View style={s.badge}>
              <Text style={s.badgeText}>{badge.toUpperCase()}</Text>
            </View>
          </View>

          {/* ── Scrollable content ── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
          >
            {isBackup
              ? (
                <BackupSections
                  parsedData={parsedData}
                  sections={sections}
                  onToggle={toggle}
                  onSetTemplatesMode={(mode) => setSections((prev) => ({ ...prev, templatesMode: mode }))}
                />
              )
              : (
                <ProgramModes
                  hasLog={hasLog}
                  selectedMode={selectedMode}
                  onSelect={setSelectedMode}
                />
              )
            }
          </ScrollView>

          {/* ── Actions — always visible, outside scroll ── */}
          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.importBtn, nothingSelected && s.importBtnDisabled]}
              onPress={nothingSelected ? undefined : handleConfirm}
              activeOpacity={nothingSelected ? 1 : 0.8}
            >
              <Text style={[s.importBtnText, nothingSelected && s.importBtnTextDisabled]}>
                IMPORTAR
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeS = (th) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  centeredOuter: {
    flex:              1,
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
  },
  sheet: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    padding:         spacing.xl,
    gap:             spacing.md,
    maxHeight:       '88%',
  },
  title: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         th.colors.text,
    letterSpacing: 0.5,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  fileName: {
    flex:     1,
    fontSize: typography.sm,
    color:    th.colors.muted,
  },
  badge: {
    backgroundColor:   withOpacity(th.colors.accent, 0.1),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.accent, 0.3),
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical:   2,
  },
  badgeText: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.accent,
    letterSpacing: 0.5,
  },

  // Scroll area
  scroll: { flexShrink: 1 },
  scrollContent: { gap: spacing.sm },

  // Warning
  warning: {
    backgroundColor: withOpacity(th.colors.red, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.red, 0.3),
    borderRadius:    th.radius.sm,
    padding:         spacing.sm,
    marginBottom:    spacing.xs,
  },
  warningText: {
    fontSize:   typography.xs,
    color:      th.colors.red,
    lineHeight: typography.xs * 1.6,
  },

  // ── Radio options (program modes) ─────────────────────────────────────────
  modeList: { gap: spacing.sm },

  radioOption: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    backgroundColor: th.colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  radioOptionSelected: {
    borderColor:     withOpacity(th.colors.accent, 0.5),
    backgroundColor: withOpacity(th.colors.accent, 0.06),
  },
  radioCircle: {
    width:          20,
    height:         20,
    borderRadius:   10,
    borderWidth:    2,
    borderColor:    th.colors.border,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  radioCircleSelected: {
    borderColor: th.colors.accent,
  },
  radioDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: th.colors.accent,
  },
  radioLabel: {
    fontSize:     typography.base,
    fontWeight:   typography.medium,
    color:        th.colors.text,
    marginBottom: 2,
  },
  radioLabelSelected: {
    color: th.colors.accent,
  },
  radioDesc: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    lineHeight: typography.xs * 1.6,
  },

  // ── Backup sections ───────────────────────────────────────────────────────
  sectionList: { gap: spacing.xs },
  sectionRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: th.colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.sm,
    padding:         spacing.sm,
    gap:             spacing.sm,
  },
  sectionRowActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.05),
    borderColor:     withOpacity(th.colors.accent, 0.25),
  },
  sectionInfo: { flex: 1 },
  sectionLabel: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  sectionDesc: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 2,
  },

  // Template card
  templateCard: {
    backgroundColor: th.colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.sm,
    overflow:        'hidden',
  },
  templateCardActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.05),
    borderColor:     withOpacity(th.colors.accent, 0.25),
  },
  templateCardRow: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       spacing.sm,
    gap:           spacing.sm,
  },
  templateModeRow: {
    flexDirection:  'row',
    gap:            spacing.xs,
    padding:        spacing.sm,
    paddingTop:     spacing.xs,
    borderTopWidth: borders.thin,
    borderTopColor: th.colors.border,
  },
  modeBtn: {
    flex:            1,
    paddingVertical: spacing.xs + 2,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface,
    alignItems:      'center',
  },
  modeBtnActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.1),
    borderColor:     withOpacity(th.colors.accent, 0.3),
  },
  modeBtnText: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },
  modeBtnTextActive: { color: th.colors.accent },

  // ── Actions row (always visible) ─────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap:           spacing.sm,
    paddingTop:    spacing.xs,
  },
  cancelBtn: {
    flex:            1,
    paddingVertical: spacing.md,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    alignItems:      'center',
  },
  cancelText: {
    fontSize:   typography.base,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },
  importBtn: {
    flex:            2,
    paddingVertical: spacing.md,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
  },
  importBtnDisabled: { backgroundColor: th.colors.surface2 },
  importBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         th.colors.bg,
    letterSpacing: 1,
  },
  importBtnTextDisabled: { color: th.colors.muted },
});
