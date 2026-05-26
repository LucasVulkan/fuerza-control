/**
 * ClientCodeModal
 *
 * Two-step modal for the client to connect with their trainer.
 *
 * Step 1 — Enter code:
 *   Client types the XXXX-XXXX code → app validates it against Supabase.
 *
 * Step 2 — Confirm:
 *   Shows program name found, explains what connecting means,
 *   warns that the current program will be archived.
 */

import { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../../store/useStore';
import { colors, spacing, typography, radius, borders, withOpacity } from '../theme';

export default function ClientCodeModal({ visible, onClose, onSuccess }) {
  const validateClientCode = useStore((s) => s.validateClientCode);
  const linkToTrainer      = useStore((s) => s.linkToTrainer);
  const clientSync         = useStore((s) => s.clientSync);

  const [step,        setStep]        = useState('enter'); // 'enter' | 'confirm'
  const [code,        setCode]        = useState('');
  const [slotInfo,    setSlotInfo]    = useState(null); // { slotId, programName, alreadyLinked }
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [pasted,      setPasted]      = useState(false);

  async function handlePaste() {
    const text = await Clipboard.getStringAsync();
    if (text?.trim()) {
      setCode(text.trim().toUpperCase());
      setError(null);
      setPasted(true);
      setTimeout(() => setPasted(false), 1500);
    }
  }

  function handleClose() {
    setStep('enter');
    setCode('');
    setSlotInfo(null);
    setError(null);
    onClose();
  }

  async function handleValidate() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const info = await validateClientCode(code);
      setSlotInfo(info);
      setStep('confirm');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await linkToTrainer(code);
      handleClose();
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const isAlreadyLinked = !!clientSync.slotId;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.backdrop} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.center}
      >
        <View style={s.card}>

          {/* ── Step 1: Enter code ── */}
          {step === 'enter' && (
            <>
              <Text style={s.title}>Conectar con entrenador</Text>
              <Text style={s.subtitle}>
                Introduce el código que te ha dado tu entrenador.
              </Text>

              <TextInput
                style={s.codeInput}
                placeholder="XXXX-XXXX"
                placeholderTextColor={colors.muted}
                value={code}
                onChangeText={(t) => { setCode(t.toUpperCase()); setError(null); }}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleValidate}
                autoFocus
              />
              <TouchableOpacity onPress={handlePaste} style={s.pasteBtn} activeOpacity={0.7}>
                <Text style={s.pasteBtnText}>{pasted ? '✓ Pegado' : '📋 Pegar'}</Text>
              </TouchableOpacity>

              {error && <Text style={s.errorText}>{error}</Text>}

              <View style={s.actions}>
                <TouchableOpacity style={s.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
                  <Text style={s.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.primaryBtn, { flex: 1 }, (!code.trim() || loading) && { opacity: 0.5 }]}
                  onPress={handleValidate}
                  disabled={!code.trim() || loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={colors.bg} />
                    : <Text style={s.primaryBtnText}>Continuar</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Step 2: Confirm ── */}
          {step === 'confirm' && slotInfo && (
            <>
              <Text style={s.title}>Programa encontrado</Text>

              <View style={s.programFound}>
                <Text style={s.programFoundLabel}>PROGRAMA</Text>
                <Text style={s.programFoundName}>{slotInfo.programName}</Text>
              </View>

              {isAlreadyLinked && (
                <View style={s.warnBox}>
                  <Text style={s.warnText}>
                    ⚠️ Ya estás conectado con un entrenador. Al continuar perderás el acceso al anterior.
                  </Text>
                </View>
              )}

              <View style={s.infoBox}>
                <InfoRow text="Tu programa actual se archivará y se cargará el de tu entrenador." />
                <InfoRow text="Tu entrenador tendrá acceso a tu historial de sesiones." />
                <InfoRow text="Cualquier cambio que haga en el programa lo recibirás automáticamente." />
                <InfoRow text="Tu historial anterior se conserva." />
              </View>

              {error && <Text style={s.errorText}>{error}</Text>}

              <View style={s.actions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setStep('enter')} activeOpacity={0.7}>
                  <Text style={s.cancelBtnText}>← Atrás</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.primaryBtn, { flex: 1 }, loading && { opacity: 0.5 }]}
                  onPress={handleConfirm}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={colors.bg} />
                    : <Text style={s.primaryBtnText}>Conectar</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function InfoRow({ text }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoDot}>·</Text>
      <Text style={s.infoText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  center: {
    flex:              1,
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    gap:             spacing.md,
  },
  title: {
    fontSize:   typography.lg,
    fontWeight: typography.heavy,
    color:      colors.text,
  },
  subtitle: {
    fontSize:   typography.sm,
    color:      colors.muted,
    marginTop:  -spacing.xs,
    lineHeight: typography.sm * 1.5,
  },
  codeInput: {
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    color:             colors.text,
    fontSize:          22,
    fontWeight:        typography.heavy,
    letterSpacing:     4,
    textAlign:         'center',
  },
  pasteBtn: {
    alignSelf:   'flex-end',
    marginTop:   -spacing.xs,
    paddingVertical:   spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  pasteBtnText: {
    fontSize: typography.xs,
    color:    colors.accent,
  },
  errorText: {
    fontSize:  typography.xs,
    color:     colors.red,
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius:    radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  primaryBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.bg,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.sm,
    alignItems:        'center',
    justifyContent:    'center',
  },
  cancelBtnText: { fontSize: typography.base, color: colors.muted },

  // Program found card
  programFound: {
    backgroundColor: withOpacity(colors.accent, 0.06),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.25),
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.xs,
  },
  programFoundLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 1,
  },
  programFoundName: {
    fontSize:   typography.md,
    fontWeight: typography.heavy,
    color:      colors.text,
  },

  // Warning box
  warnBox: {
    backgroundColor: withOpacity(colors.orange, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.orange, 0.3),
    borderRadius:    radius.sm,
    padding:         spacing.md,
  },
  warnText: {
    fontSize:   typography.xs,
    color:      colors.orange,
    lineHeight: typography.xs * 1.5,
  },

  // Info list
  infoBox: {
    gap: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
    alignItems:    'flex-start',
  },
  infoDot: {
    fontSize:  typography.sm,
    color:     colors.accent,
    lineHeight: typography.sm * 1.4,
  },
  infoText: {
    flex:       1,
    fontSize:   typography.xs,
    color:      colors.muted,
    lineHeight: typography.xs * 1.5,
  },
});
