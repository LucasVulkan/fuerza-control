/**
 * ProgramUpdateModal.jsx
 *
 * Shown when the trainer has pushed a new version of the client's program.
 * Lets the client choose:
 *   - Actualizar manteniendo progreso  → preserves currentWeek + currentStageIndex
 *   - Actualizar desde cero            → resets progress to week 1, stage 0
 *   - Ahora no                         → dismisses, update stays pending
 */

import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../../store/useStore';
import { colors, spacing, typography, radius, borders, withOpacity } from '../theme';

export default function ProgramUpdateModal() {
  const pending                    = useStore((s) => s.clientSync?.pendingProgramUpdate);
  const applyPendingProgramUpdate  = useStore((s) => s.applyPendingProgramUpdate);
  const dismissPendingProgramUpdate = useStore((s) => s.dismissPendingProgramUpdate);
  const insets                     = useSafeAreaInsets();

  if (!pending) return null;

  const diff = pending.diff ?? [];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismissPendingProgramUpdate}>
      <View style={styles.backdrop} />
      <View style={[styles.outer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.card}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.tag}>ACTUALIZACIÓN</Text>
            <Text style={styles.title}>Tu entrenador ha modificado el programa</Text>
          </View>

          {/* Diff list */}
          <ScrollView style={styles.diffScroll} showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.diffBox}>
              {diff.map((line, i) => (
                <View key={i} style={styles.diffRow}>
                  <Text style={styles.diffDot}>·</Text>
                  <Text style={styles.diffText}>{line}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <ActionBtn
              label="Actualizar manteniendo progreso"
              sub="Conserva tu semana y etapa actual"
              accent
              onPress={() => applyPendingProgramUpdate(true)}
            />
            <ActionBtn
              label="Actualizar desde cero"
              sub="Empieza desde la semana 1"
              onPress={() => applyPendingProgramUpdate(false)}
            />
            <TouchableOpacity style={styles.laterBtn} onPress={dismissPendingProgramUpdate} activeOpacity={0.7}>
              <Text style={styles.laterTxt}>Ahora no</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

function ActionBtn({ label, sub, onPress, accent }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, accent && styles.actionBtnAccent]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.actionLabel, accent && styles.actionLabelAccent]}>{label}</Text>
      <Text style={[styles.actionSub, accent && styles.actionSubAccent]}>{sub}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  outer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent:    'flex-end',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    overflow:        'hidden',
    maxHeight:       '80%',
  },

  // Header
  header: {
    padding:      spacing.xl,
    paddingBottom: spacing.md,
  },
  tag: {
    fontSize:        typography.xs,
    fontWeight:      typography.heavy,
    color:           colors.accent,
    letterSpacing:   1.5,
    marginBottom:    spacing.xs,
  },
  title: {
    fontSize:   typography.lg,
    fontWeight: typography.heavy,
    color:      colors.text,
    lineHeight: typography.lg * 1.3,
  },

  // Diff
  diffScroll: {
    maxHeight: 180,
  },
  diffBox: {
    marginHorizontal: spacing.xl,
    marginBottom:     spacing.md,
    backgroundColor:  withOpacity(colors.accent, 0.05),
    borderWidth:      borders.thin,
    borderColor:      withOpacity(colors.accent, 0.2),
    borderRadius:     radius.sm,
    padding:          spacing.md,
    gap:              spacing.xs,
  },
  diffRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
    alignItems:    'flex-start',
  },
  diffDot: {
    color:    colors.accent,
    fontSize: typography.base,
  },
  diffText: {
    flex:       1,
    fontSize:   typography.sm,
    color:      colors.text,
    lineHeight: typography.sm * 1.5,
  },

  // Action buttons
  actions: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  actionBtn: {
    backgroundColor: colors.surface2,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
    gap:             2,
  },
  actionBtnAccent: {
    backgroundColor: colors.accent,
    borderColor:     colors.accent,
  },
  actionLabel: {
    fontSize:   typography.base,
    fontWeight: typography.bold,
    color:      colors.text,
  },
  actionLabelAccent: {
    color: colors.bg,
  },
  actionSub: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
  actionSubAccent: {
    color: withOpacity(colors.bg, 0.7),
  },

  // Later
  laterBtn: {
    alignItems:      'center',
    paddingVertical: spacing.sm,
  },
  laterTxt: {
    fontSize: typography.sm,
    color:    colors.muted,
  },
});
