/**
 * CodeReveal — el código personal recién creado, para guardarlo.
 *
 * Lo comparten la hoja de entrada (`TrainerSyncModal`, pantalla `code_reveal`) y
 * la hoja de «Mi cuenta» al pasar a código (M03-02 §6.5). «Ya lo he guardado»
 * queda apagado hasta que el código se copia o se envía: sin él no se recupera
 * la cuenta, y el botón era lo primero que se pulsaba sin leer.
 * `onDone` lo llama «Ya lo he guardado»; cerrar la hoja es cosa de quien lo usa.
 */

import { useState } from 'react';
import { View, TouchableOpacity, Share, StyleSheet } from 'react-native';
import { Text } from './ui/Text';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';

import { spacing, textStyles } from '../theme';
import { useThemedStyles } from '../useTheme';

export default function CodeReveal({ code, purchase = false, onDone }) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const [saved,  setSaved]  = useState(false); // copiado o enviado
  const [copied, setCopied] = useState(false); // el ✓ de dos segundos

  async function copy() {
    await Clipboard.setStringAsync(code);
    setSaved(true);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function send() {
    try {
      const res = await Share.share({ message: code });
      if (res.action === Share.sharedAction) setSaved(true);
    } catch { /* hoja de compartir rota: queda Copiar */ }
  }

  return (
    <View style={styles.block}>
      <Text style={styles.lead}>{t('sync.revealLead')}</Text>

      <TouchableOpacity style={styles.codeBox} onPress={copy} activeOpacity={0.7}>
        <Text style={styles.codeText}>{code}</Text>
        <Text style={styles.codeHint}>{copied ? t('sync.copied') : t('sync.copyHint')}</Text>
      </TouchableOpacity>

      <View style={styles.warnCard}>
        <Text style={styles.warnText}>{t(purchase ? 'sync.revealWarnPurchase' : 'sync.revealWarn')}</Text>
      </View>

      <View style={styles.pair}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={copy} activeOpacity={0.85}>
          <Text style={styles.secondaryBtnText}>{t('sync.revealCopy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={send} activeOpacity={0.85}>
          <Text style={styles.secondaryBtnText}>{t('sync.revealSend')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, !saved && styles.btnDisabled]}
        onPress={onDone}
        disabled={!saved}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>{t('sync.revealCta')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  block: { gap: spacing.lg, paddingBottom: spacing.md },
  lead:  { ...textStyles.body, color: th.colors.mutedLight, lineHeight: 18 },

  // Caja del código: el código es el protagonista, con la pista de copiar debajo.
  codeBox: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.lg,
    alignItems:      'center',
    gap:             spacing.sm,
  },
  codeText: { ...textStyles.code, color: th.colors.accent, fontVariant: ['tabular-nums'] },
  codeHint: { ...textStyles.label, color: th.colors.mutedLight },

  warnCard: {
    backgroundColor: th.tint.orange30,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  warnText: { ...textStyles.label, color: th.tint.orange50, lineHeight: 15 },

  pair: { flexDirection: 'row', gap: spacing.sm2 },
  secondaryBtn: {
    flex:            1,
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  secondaryBtnText: { ...textStyles.button, color: th.colors.text },

  primaryBtn: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  primaryBtnText: { ...textStyles.button, color: th.colors.onAccent },
  btnDisabled:    { opacity: 0.5 },
});
