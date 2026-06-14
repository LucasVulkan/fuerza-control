/**
 * TrainerConnectionScreen
 *
 * Shows the current client ↔ trainer connection status and lets the user:
 *   • Connect to a trainer (enter code or reconnect via Google)
 *   • Link their Google account for seamless reconnect
 *   • Disconnect from the trainer
 *   • Change trainer (re-enter a new code)
 */

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation }     from '@react-navigation/native';

import { useStore }               from '../../store/useStore';
import ClientCodeModal            from '../components/ClientCodeModal';
import ClientGoogleLinkModal      from '../components/ClientGoogleLinkModal';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

// ── TrainerConnectionScreen ───────────────────────────────────────────────────

export default function TrainerConnectionScreen() {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();

  const clientSync           = useStore((s) => s.clientSync);
  const programs             = useStore((s) => s.programs);
  const profile              = useStore((s) => s.profile);
  const disconnectFromTrainer = useStore((s) => s.unlinkFromTrainer);

  const [showCodeModal,    setShowCodeModal]    = useState(false);
  const [googleAutoStart,  setGoogleAutoStart]  = useState(false);
  const [showGoogleModal,  setShowGoogleModal]  = useState(false);

  const isConnected   = !!clientSync.slotId;
  const hasError      = !!(clientSync.pendingUpload || clientSync.syncErrorAt);
  const activeProgram = profile.activeProgramId ? programs[profile.activeProgramId] : null;

  // ── Derived status label ──────────────────────────────────────────────────
  function statusLabel() {
    if (!isConnected)            return 'Sin conexión';
    if (clientSync.pendingUpload) return 'Pendiente de sincronizar';
    if (clientSync.syncErrorAt)   return 'Error de sincronización';
    return 'Conectado';
  }

  function statusColor() {
    if (!isConnected) return th.colors.muted;
    if (hasError)     return th.colors.orange;
    return th.colors.green;
  }

  // ── Disconnect ────────────────────────────────────────────────────────────
  function handleDisconnect() {
    Alert.alert(
      'Desconectar entrenador',
      '¿Seguro que quieres desconectarte? Tu programa del entrenador se archivará y se restaurará el anterior (si tenías uno).',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar', style: 'destructive',
          onPress: async () => {
            await disconnectFromTrainer();
            navigation.goBack();
          },
        },
      ],
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ENTRENADOR</Text>
        <View style={styles.headerRight}>
          <View style={[styles.statusDot, { backgroundColor: statusColor() }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status card ── */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: statusColor() }]} />
            <Text style={styles.statusText}>{statusLabel()}</Text>
          </View>

          {isConnected && (
            <>
              {clientSync.trainerName ? (
                <View style={styles.infoLine}>
                  <Text style={styles.infoLabel}>ENTRENADOR</Text>
                  <Text style={styles.infoValue}>{clientSync.trainerName}</Text>
                </View>
              ) : null}

              {activeProgram ? (
                <View style={styles.infoLine}>
                  <Text style={styles.infoLabel}>PROGRAMA</Text>
                  <Text style={styles.infoValue}>{activeProgram.name}</Text>
                </View>
              ) : null}

              <View style={styles.infoLine}>
                <Text style={styles.infoLabel}>ACCESO</Text>
                <Text style={styles.infoValue}>
                  {clientSync.googleLinked ? '🔗 Cuenta Google' : '🔑 Código de entrenador'}
                </Text>
              </View>

              {clientSync.lastSyncedAt ? (
                <View style={styles.infoLine}>
                  <Text style={styles.infoLabel}>ÚLTIMA SYNC</Text>
                  <Text style={styles.infoValue}>
                    {new Date(clientSync.lastSyncedAt).toLocaleString('es-ES', {
                      day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
              ) : null}

              {clientSync.syncErrorAt ? (
                <View style={styles.errorLine}>
                  <Text style={styles.errorText}>
                    ⚠️ Error de sync el{' '}
                    {new Date(clientSync.syncErrorAt).toLocaleString('es-ES', {
                      day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
              ) : null}
            </>
          )}

          {!isConnected && (
            <Text style={styles.noConnectDesc}>
              Conecta con tu entrenador para recibir programas personalizados y que tenga acceso a tu historial de sesiones.
            </Text>
          )}
        </View>

        {/* ── Actions ── */}
        {isConnected ? (
          <>
            <Text style={styles.sectionLabel}>ACCIONES</Text>

            <ActionRow
              label="Cambiar entrenador"
              description="Introduce el código de un nuevo entrenador"
              onPress={() => setShowCodeModal(true)}
            />

            {!clientSync.googleLinked && (
              <ActionRow
                label="Vincular cuenta Google"
                description="Reconéctate automáticamente desde cualquier dispositivo"
                onPress={() => setShowGoogleModal(true)}
              />
            )}

            {clientSync.googleLinked && (
              <View style={styles.linkedRow}>
                <Text style={styles.linkedIcon}>✓</Text>
                <View>
                  <Text style={styles.linkedLabel}>Google vinculado</Text>
                  <Text style={styles.linkedDesc}>Reconexión automática activada</Text>
                </View>
              </View>
            )}

            <View style={styles.separator} />

            <ActionRow
              label="Desconectar entrenador"
              onPress={handleDisconnect}
              danger
            />
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={() => setShowCodeModal(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.connectBtnText}>Conectar con código</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.googleBtn}
              onPress={() => { setGoogleAutoStart(true); setShowCodeModal(true); }}
              activeOpacity={0.8}
            >
              <Text style={styles.googleBtnText}>Reconectarse con Google</Text>
            </TouchableOpacity>

            <Text style={styles.connectHint}>
              Si ya estuviste conectado antes y vinculaste tu cuenta de Google, úsala para reconectarte automáticamente.
            </Text>
          </>
        )}
      </ScrollView>

      {/* ── Modals overlay ── */}
      <ClientCodeModal
        visible={showCodeModal}
        startWithGoogle={googleAutoStart}
        onClose={() => { setShowCodeModal(false); setGoogleAutoStart(false); }}
        onSuccess={() => { setShowCodeModal(false); setGoogleAutoStart(false); }}
      />

      <ClientGoogleLinkModal
        visible={showGoogleModal}
        onClose={() => setShowGoogleModal(false)}
      />
    </View>
  );
}

// ── ActionRow ─────────────────────────────────────────────────────────────────

function ActionRow({ label, description, onPress, danger }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.actionRow, danger && styles.actionRowDanger]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, danger && styles.dangerLabel]}>{label}</Text>
        {description ? (
          <Text style={styles.actionDesc}>{description}</Text>
        ) : null}
      </View>
      <Text style={[styles.actionChevron, danger && { color: th.colors.red }]}>›</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  backBtn: {
    paddingRight: spacing.md,
  },
  backIcon: {
    fontSize:   28,
    color:      th.colors.text,
    lineHeight: 32,
  },
  headerTitle: {
    flex:          1,
    fontSize:      typography.sm,
    fontWeight:    typography.heavy,
    color:         th.colors.muted,
    letterSpacing: 2,
  },
  headerRight: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingLeft:    spacing.sm,
  },
  statusDot: {
    width: 10, height: 10, borderRadius: 5,
  },

  // Content
  content: {
    padding: spacing.xl,
    gap:     spacing.sm,
  },

  // Status card
  statusCard: {
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    padding:         spacing.md,
    gap:             spacing.xs + 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
  },
  statusText: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  infoLine: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    gap:            spacing.sm,
  },
  infoLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.muted,
    letterSpacing: 0.8,
    marginTop:     2,
    flexShrink:    0,
  },
  infoValue: {
    fontSize:   typography.sm,
    color:      th.colors.text,
    textAlign:  'right',
    flex:       1,
  },
  errorLine: {
    marginTop: 2,
  },
  errorText: {
    fontSize:  typography.xs,
    color:     th.colors.red,
  },
  noConnectDesc: {
    fontSize:   typography.sm,
    color:      th.colors.muted,
    lineHeight: typography.sm * 1.5,
    marginTop:  spacing.xs,
  },

  // Section label
  sectionLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.muted,
    letterSpacing: 1.5,
    marginTop:     spacing.xs,
  },

  // Action rows
  actionRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  actionRowDanger: {
    borderBottomColor: withOpacity(th.colors.red, 0.15),
  },
  actionLabel: {
    fontSize: typography.base,
    color:    th.colors.text,
  },
  actionDesc: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 2,
  },
  actionChevron: {
    fontSize: typography.lg,
    color:    th.colors.muted,
    marginLeft: spacing.sm,
  },
  dangerLabel: {
    color: th.colors.red,
  },

  separator: {
    height:          borders.thin,
    backgroundColor: th.colors.border,
    marginVertical:  spacing.xs,
  },

  // Google linked badge
  linkedRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  linkedIcon: {
    fontSize:   18,
    color:      th.colors.green,
  },
  linkedLabel: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  linkedDesc: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 1,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: th.colors.border },
  dividerText: { fontSize: typography.xs, color: th.colors.muted },

  // Google button
  googleBtn: {
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
    backgroundColor: th.colors.surface2,
  },
  googleBtnText: {
    fontSize:   typography.sm,
    color:      th.colors.text,
    fontWeight: typography.medium,
  },

  // Not connected CTA
  connectBtn: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.sm,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    marginTop:       spacing.xs,
  },
  connectBtnText: {
    fontSize:   typography.base,
    fontWeight: typography.bold,
    color:      th.colors.bg,
  },
  connectHint: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    lineHeight: typography.xs * 1.6,
    textAlign:  'center',
    marginTop:  spacing.xs,
  },
});
