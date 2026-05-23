/**
 * Import modal — mobile port of the web ImportModal.
 * Shows after a .json file has been parsed successfully.
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
import { colors, spacing, typography, radius, borders, withOpacity } from '../theme';

// ── helpers ────────────────────────────────────────────────────────────────────

function typeLabel(exportType, hasLog) {
  if (exportType === 'full') return 'Backup completo';
  if (hasLog)               return 'Programa + historial';
  return 'Programa';
}

// ── Full-backup section toggles ────────────────────────────────────────────────

function SectionRow({ label, desc, enabled, disabled, onToggle }) {
  return (
    <TouchableOpacity
      style={[styles.sectionRow, enabled && !disabled && styles.sectionRowActive]}
      onPress={disabled ? undefined : onToggle}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={styles.sectionInfo}>
        <Text style={[styles.sectionLabel, disabled && { color: colors.muted2 }]}>{label}</Text>
        {desc ? <Text style={styles.sectionDesc}>{desc}</Text> : null}
      </View>
      <Switch
        value={enabled}
        onValueChange={disabled ? undefined : onToggle}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={enabled ? colors.bg : colors.muted}
      />
    </TouchableOpacity>
  );
}

function BackupSections({ parsedData, onImport, onClose }) {
  const hasPrograms  = Object.keys(parsedData?.programs ?? {}).length > 0 || !!parsedData?.program;
  const hasLog       = (parsedData?.workoutLog ?? []).length > 0;
  const hasCustEx    = Object.keys(parsedData?.customExercises ?? {}).length > 0;
  const hasClients   = Object.keys(parsedData?.clients ?? {}).length > 0;
  const hasTemplates = Object.values(parsedData?.programs ?? {}).some((p) => p.mode === 'template');

  const [sections, setSections] = useState({
    program:         hasPrograms,
    log:             hasLog,
    customExercises: hasCustEx,
    clients:         hasClients,
    templates:       hasTemplates,
    templatesMode:   'merge',
  });

  const nothingSelected = !sections.program && !sections.log && !sections.customExercises
    && !sections.clients && !sections.templates;

  function toggle(key) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  return (
    <>
      {/* Warning */}
      <View style={styles.warning}>
        <Text style={styles.warningText}>
          Los datos importados sobreescribirán los existentes en cada sección seleccionada.
        </Text>
      </View>

      <View style={styles.sectionList}>
        <SectionRow
          label="Programa activo"
          desc={hasPrograms ? 'Activa el programa importado' : 'No disponible'}
          enabled={sections.program}
          disabled={!hasPrograms}
          onToggle={() => toggle('program')}
        />
        <SectionRow
          label="Historial de sesiones"
          desc={hasLog ? `${(parsedData.workoutLog ?? []).length} sesiones` : 'No disponible'}
          enabled={sections.log}
          disabled={!hasLog}
          onToggle={() => toggle('log')}
        />
        <SectionRow
          label="Ejercicios personalizados"
          desc={hasCustEx ? `${Object.keys(parsedData.customExercises ?? {}).length} ejercicios` : 'No disponible'}
          enabled={sections.customExercises}
          disabled={!hasCustEx}
          onToggle={() => toggle('customExercises')}
        />
        <SectionRow
          label="Clientes"
          desc={hasClients ? `${Object.keys(parsedData.clients ?? {}).length} clientes` : 'No disponible'}
          enabled={sections.clients}
          disabled={!hasClients}
          onToggle={() => toggle('clients')}
        />
        {/* Template section — mode buttons live inside the same card */}
        <View style={[
          styles.templateCard,
          sections.templates && hasTemplates && styles.templateCardActive,
        ]}>
          <TouchableOpacity
            style={styles.templateCardRow}
            onPress={hasTemplates ? () => toggle('templates') : undefined}
            activeOpacity={hasTemplates ? 0.7 : 1}
          >
            <View style={styles.sectionInfo}>
              <Text style={[styles.sectionLabel, !hasTemplates && { color: colors.muted2 }]}>
                Plantillas de programa
              </Text>
              <Text style={styles.sectionDesc}>
                {hasTemplates ? 'Plantillas reutilizables' : 'No disponible'}
              </Text>
            </View>
            <Switch
              value={sections.templates && hasTemplates}
              onValueChange={hasTemplates ? () => toggle('templates') : undefined}
              disabled={!hasTemplates}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={sections.templates && hasTemplates ? colors.bg : colors.muted}
            />
          </TouchableOpacity>
          {sections.templates && hasTemplates && (
            <View style={styles.templateModeRow}>
              {['merge', 'replace'].map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modeBtn, sections.templatesMode === mode && styles.modeBtnActive]}
                  onPress={() => setSections((s) => ({ ...s, templatesMode: mode }))}
                >
                  <Text style={[
                    styles.modeBtnText,
                    sections.templatesMode === mode && styles.modeBtnTextActive,
                  ]}>
                    {mode === 'merge' ? 'Combinar' : 'Reemplazar'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.importBtn, nothingSelected && styles.importBtnDisabled]}
          onPress={nothingSelected ? undefined : () => onImport(parsedData, sections)}
          activeOpacity={nothingSelected ? 1 : 0.8}
        >
          <Text style={[styles.importBtnText, nothingSelected && styles.importBtnTextDisabled]}>
            IMPORTAR
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

// ── Program modes (non-full-backup) ───────────────────────────────────────────

function ProgramModes({ parsedData, hasLog, onImport, onClose }) {
  return (
    <View style={styles.modeList}>
      <ModeOption
        label="Reemplazar programa e historial"
        desc="Activa el programa importado y añade su historial de sesiones"
        onPress={() => onImport(parsedData, { program: true, log: true })}
      />
      {hasLog && (
        <ModeOption
          label="Solo añadir historial"
          desc="Mantiene el programa actual, añade las sesiones del archivo"
          onPress={() => onImport(parsedData, { program: false, log: true })}
        />
      )}
      <ModeOption
        label="Solo el programa"
        desc="Activa el programa importado, sin tocar el historial"
        onPress={() => onImport(parsedData, { program: true, log: false })}
      />
      <TouchableOpacity style={[styles.cancelBtn, { marginTop: spacing.xs }]} onPress={onClose}>
        <Text style={styles.cancelText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

function ModeOption({ label, desc, onPress }) {
  return (
    <TouchableOpacity style={styles.modeOption} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.modeOptionLabel}>{label}</Text>
      <Text style={styles.modeOptionDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function ImportModal({ fileName, parsedData, onImport, onClose }) {
  const exportType = parsedData?.exportType ?? 'program';
  const isBackup   = exportType === 'full';
  const hasLog     = (parsedData?.workoutLog ?? []).length > 0;
  const badge      = typeLabel(exportType, hasLog);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.centeredOuter}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>Importar archivo</Text>

          <View style={styles.fileRow}>
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge.toUpperCase()}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
            {isBackup
              ? <BackupSections parsedData={parsedData} onImport={onImport} onClose={onClose} />
              : <ProgramModes parsedData={parsedData} hasLog={hasLog} onImport={onImport} onClose={onClose} />
            }
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Centered modal layout
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
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    padding:         spacing.xl,
    gap:             spacing.md,
  },
  title: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         colors.text,
    letterSpacing: 0.5,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    marginBottom:  spacing.xs,
  },
  fileName: {
    flex:       1,
    fontSize:   typography.sm,
    color:      colors.muted,
  },
  badge: {
    backgroundColor: withOpacity(colors.accent, 0.1),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.3),
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical:   2,
  },
  badgeText: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 0.5,
  },

  // Warning
  warning: {
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth:     borders.thin,
    borderColor:     'rgba(248,113,113,0.3)',
    borderRadius:    radius.sm,
    padding:         spacing.sm,
    marginBottom:    spacing.sm,
  },
  warningText: {
    fontSize:   typography.xs,
    color:      colors.red,
    lineHeight: typography.xs * 1.6,
  },

  // Section toggles
  sectionList: {
    gap: spacing.xs,
  },
  sectionRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    borderRadius:    radius.sm,
    padding:         spacing.sm,
    gap:             spacing.sm,
  },
  sectionRowActive: {
    backgroundColor: withOpacity(colors.accent, 0.05),
    borderColor:     withOpacity(colors.accent, 0.25),
  },
  sectionInfo: { flex: 1 },
  sectionLabel: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  sectionDesc: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 2,
  },

  // Template section — card that contains toggle + mode buttons
  templateCard: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    borderRadius:    radius.sm,
    overflow:        'hidden',
  },
  templateCardActive: {
    backgroundColor: withOpacity(colors.accent, 0.05),
    borderColor:     withOpacity(colors.accent, 0.25),
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
    borderTopColor: colors.border,
  },

  // Merge/replace mode (legacy, kept for non-template uses if any)
  modeRow: {
    flexDirection:     'row',
    gap:               spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom:     spacing.xs,
  },
  modeBtn: {
    flex:            1,
    paddingVertical: spacing.xs + 2,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface,
    alignItems:      'center',
  },
  modeBtnActive: {
    backgroundColor: withOpacity(colors.accent, 0.1),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  modeBtnText: {
    fontSize:   typography.xs,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  modeBtnTextActive: {
    color: colors.accent,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.sm,
  },
  cancelBtn: {
    flex:            1,
    paddingVertical: spacing.md,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    alignItems:      'center',
  },
  cancelText: {
    fontSize:   typography.base,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  importBtn: {
    flex:            2,
    paddingVertical: spacing.md,
    borderRadius:    radius.sm,
    backgroundColor: colors.accent,
    alignItems:      'center',
  },
  importBtnDisabled: {
    backgroundColor: colors.surface2,
  },
  importBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.bg,
    letterSpacing: 1,
  },
  importBtnTextDisabled: {
    color: colors.muted,
  },

  // Program modes
  modeList: {
    gap: spacing.sm,
  },
  modeOption: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.sm,
    padding:         spacing.md,
  },
  modeOptionLabel: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  modeOptionDesc: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 3,
    lineHeight: typography.xs * 1.6,
  },
});
