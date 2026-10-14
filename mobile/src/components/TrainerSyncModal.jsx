/**
 * TrainerSyncModal — la hoja para CREAR la cuenta del entrenador o conectarse
 * con una que ya existe.
 *
 * Se abre la primera vez que entra en Clientes (`trainerSync.mode === null`),
 * al conectar un cliente sin cuenta, desde el paywall y desde «Mi cuenta». Ver
 * el código, cambiar de forma o desconectarse está en la página «Mi cuenta» (M03).
 *
 * Tres pantallas dentro de la misma hoja:
 *   • select      → para qué sirve la cuenta (una línea), y cómo crearla: los
 *                   botones de Apple (oficial, solo iOS) y Google, y debajo, como
 *                   alternativa, el código personal. Enlace «Ya tengo cuenta».
 *   • recovery    → «Ya tengo cuenta»: Google, Apple o el código. Aquí Google y
 *                   Apple solo CONECTAN: si no hay cuenta avisan (M03-03 §7.4)
 *   • code_reveal → el código recién creado, para guardarlo
 *
 * El nombre que ven los clientes ya no se pide aquí: sale de Google o Apple y
 * se cambia en «Mi cuenta». Arriba de todo, antes de elegir nada, despistaba.
 *
 * `initialScreen="recovery"` la abre en «Ya tengo cuenta»; por defecto `'select'`.
 * `purpose="purchase"` (M01 §3.5): tras comprar Pro sin cuenta, para atar la
 * compra a una. Misma hoja con otro título y otra explicación.
 *
 * Entrar y crear van por `useTrainerAccount` y las acciones de cuenta del
 * store (M03-01): aquí no se toca Supabase.
 */

import { useState, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from './ui/Text';
import { useTranslation } from 'react-i18next';

import { APPLE_AUTH_AVAILABLE } from '../services/appleAuth';
import useTrainerAccount, { askCreateInstead } from '../hooks/useTrainerAccount';
import DragSheet from './DragSheet';
import CodeField from './ui/CodeField';
import { Section, SectionLabel, MenuRow } from './ui/MenuList';
import { KeyIcon } from './ui/AccountIcons';
import AppleSignInButton from './ui/AppleSignInButton';
import GoogleSignInButton from './ui/GoogleSignInButton';
import CodeReveal from './CodeReveal';
import { spacing, textStyles, lh } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

import { showDialog } from './ui/dialog';

export default function TrainerSyncModal({ visible, onClose, isFirstTime = true, purpose = 'sync', initialScreen = 'select' }) {
  const forPurchase = purpose === 'purchase';
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  const [screen,  setScreen]  = useState(initialScreen); // 'select' | 'code_reveal' | 'recovery'
  const [newCode, setNewCode] = useState(null);
  // Qué opción está en marcha ('google' | 'apple' | 'code' | 'recover'), para su ruedecita.
  const [pending, setPending] = useState(null);

  const [recoverCode,  setRecoverCode]  = useState('');
  const [recoverError, setRecoverError] = useState(null);

  // La hoja sigue montada al cerrarse: al volver a abrirla empieza de cero.
  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (visible) {
      setScreen(initialScreen);
      setRecoverCode('');
      setRecoverError(null);
    }
  }, [visible]);

  const acct = useTrainerAccount();
  const { isExpoGo } = acct;

  function showSocialError(provider, err) {
    showDialog(
      t(provider === 'apple' ? 'sync.errAppleTitle' : 'sync.errGoogleTitle'),
      err?.message ?? t('sync.errGoogleBody'),
    );
  }

  /**
   * Google o Apple: cerrar al conectar; cancelar no es un error. Con `mustExist`
   * («Ya tengo cuenta») solo conecta: si no hay cuenta, pregunta (§7.4).
   */
  async function social(provider, mustExist = false) {
    setPending(provider);
    try {
      await (provider === 'apple' ? acct.signInWithApple : acct.signInWithGoogle)({ mustExist });
      onClose();
    } catch (err) {
      if (err?.notFound) {
        askCreateInstead(t, err, { onDone: () => onClose(), onError: (e) => showSocialError(provider, e) });
      } else if (!err?.cancelled) {
        showSocialError(provider, err);
      }
    } finally {
      setPending(null);
    }
  }

  async function createCode() {
    setPending('code');
    try {
      const { code } = await acct.createCode();
      setNewCode(code);
      setScreen('code_reveal');
    } catch (err) {
      showDialog(t('sync.errAccountTitle'), err?.message ?? t('sync.errAccountBody'));
    } finally {
      setPending(null);
    }
  }

  async function handleRecover() {
    if (!recoverCode.trim() || pending) return;
    setRecoverError(null);
    setPending('recover');
    try {
      await acct.recover(recoverCode);
    } catch (err) {
      setRecoverError(err?.message ?? t('sync.errReconnectBody'));
      return;
    } finally {
      setPending(null);
    }
    setScreen('select');
    onClose();
  }

  const busy = pending !== null;

  const titles = {
    select:      forPurchase ? t('sync.purchaseTitle') : t('sync.createTitle'),
    code_reveal: t('sync.revealTitle'),
    recovery:    t('sync.recoveryTitle'),
  };

  const action = screen === 'code_reveal'
    ? { label: t('common.accept'),      onPress: () => { setScreen('select'); onClose(); } }
    // «Atrás» solo si se llegó a «Ya tengo cuenta» desde crear; abierta ya ahí
    // (Mi cuenta, paywall), el botón cierra: no hay detrás a donde volver.
    : screen === 'recovery' && initialScreen !== 'recovery'
      ? { label: t('trainer.codeBack'), onPress: () => setScreen('select') }
      : screen === 'recovery'
        ? { label: t('common.cancel'), onPress: onClose }
      : { label: forPurchase || isFirstTime ? t('sync.notNow') : t('common.cancel'), onPress: onClose };

  /** Los dos botones de marca, Apple (oficial, solo iOS) encima de Google. `mustExist`: solo conectar. */
  const socialButtons = (mustExist) => (
    <View style={styles.socials}>
      {APPLE_AUTH_AVAILABLE && (
        <AppleSignInButton onPress={() => social('apple', mustExist)} disabled={busy || isExpoGo} />
      )}
      <GoogleSignInButton
        onPress={() => social('google', mustExist)}
        busy={pending === 'google'}
        disabled={busy || isExpoGo}
      />
      {isExpoGo && <Text style={styles.hint}>{t('sync.onlyInstalled')}</Text>}
    </View>
  );

  /** La raya con la «o» que separa las cuentas de Google/Apple del código. */
  const orDivider = (
    <View style={styles.or}>
      <View style={styles.orLine} />
      <Text style={styles.orText}>{t('sync.or')}</Text>
      <View style={styles.orLine} />
    </View>
  );

  return (
    <DragSheet
      visible={visible}
      onClose={onClose}
      title={titles[screen]}
      action={action}
    >
      {screen === 'code_reveal' && newCode && (
        <CodeReveal code={newCode} purchase={forPurchase} onDone={() => { setScreen('select'); onClose(); }} />
      )}

      {/* ── «Ya tengo cuenta»: Google, Apple (solo conectan) o el código ── */}
      {screen === 'recovery' && (
        <View style={styles.block}>
          <Text style={styles.why}>{t('sync.recoveryLead')}</Text>

          <View>
            <SectionLabel>{t('sync.recoverySocial')}</SectionLabel>
            {socialButtons(true)}
          </View>

          {orDivider}

          <View>
            <SectionLabel>{t('sync.recoveryCodeLabel')}</SectionLabel>
            <CodeField
              value={recoverCode}
              onChangeText={(v) => { setRecoverCode(v); setRecoverError(null); }}
              groups={3}
              onSubmitEditing={handleRecover}
              error={recoverError}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, (!recoverCode.trim() || busy) && styles.btnDisabled]}
              onPress={handleRecover}
              disabled={!recoverCode.trim() || busy}
              activeOpacity={0.85}
            >
              {pending === 'recover'
                ? <ActivityIndicator color={th.colors.onAccent} />
                : <Text style={styles.primaryBtnText}>{t('sync.recoveryCta')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Crear la cuenta ── */}
      {screen === 'select' && (
        <View style={styles.block}>
          <Text style={styles.why}>{t(forPurchase ? 'sync.purchaseLead' : 'sync.createLead')}</Text>

          <View>
            <SectionLabel>{t('sync.createWith')}</SectionLabel>
            {socialButtons(false)}
          </View>

          {orDivider}

          <Section style={styles.lastSection}>
            <MenuRow
              icon={<KeyIcon size={18} color={th.colors.mutedLight} />}
              label={t('sync.rowCode')}
              sub={t('sync.rowCodeSub')}
              subLines={3}
              disabled={busy}
              status={pending === 'code' ? <ActivityIndicator color={th.colors.accent} size="small" /> : null}
              onPress={createCode}
            />
          </Section>

          <TouchableOpacity onPress={() => setScreen('recovery')} disabled={busy} activeOpacity={0.7} hitSlop={8}>
            <Text style={styles.link}>{t('sync.haveAccount')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </DragSheet>
  );
}

const makeStyles = (th) => StyleSheet.create({
  block: { gap: spacing.lg, paddingBottom: spacing.md },
  // La explicación, una por pantalla: gris con barra a la izquierda, como en «Mi cuenta».
  why: {
    ...textStyles.body,
    lineHeight:      lh(textStyles.body.fontSize),
    color:           th.colors.mutedLight,
    borderLeftWidth: 2,
    borderLeftColor: th.colors.surface3,
    paddingLeft:     spacing.sm2,
  },
  hint: { ...textStyles.label, color: th.colors.mutedLight, lineHeight: 15 },
  link: { ...textStyles.button, color: th.colors.accent, textAlign: 'center' },

  socials: { gap: spacing.sm2 },
  lastSection: { marginBottom: 0 },

  or:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: th.colors.surface3 },
  orText: { ...textStyles.label, color: th.colors.mutedLight },

  primaryBtn: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       spacing.md,
  },
  primaryBtnText: { ...textStyles.button, color: th.colors.onAccent },
  btnDisabled:    { opacity: 0.5 },
});
