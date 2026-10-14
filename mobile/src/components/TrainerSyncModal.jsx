/**
 * TrainerSyncModal — la hoja para ENTRAR o CREAR la cuenta del entrenador.
 *
 * Se abre la primera vez que entra en Clientes (`trainerSync.mode === null`),
 * al conectar un cliente sin cuenta y desde el paywall. Ver el código, copiarlo,
 * cambiar de forma de entrar o salir está en la página «Mi cuenta» (M03).
 *
 * Tres pantallas dentro de la misma hoja:
 *   • select      → filas que actúan directamente: Google, Apple (solo iOS) o
 *                   «Crear un código personal»; el enlace «Ya tengo un código»
 *                   lleva a `recovery`
 *   • code_reveal → el código recién creado, para guardarlo
 *   • recovery    → «¿Cómo entrabas?»: el código, Google o Apple. Aquí Google y
 *                   Apple solo ENTRAN: si no hay cuenta avisan (M03-03 §7.4)
 *
 * `initialScreen="recovery"` la abre en «¿Cómo entrabas?» (el «Ya tengo cuenta»
 * del paywall y de la página); por defecto, `'select'`.
 *
 * `purpose="purchase"` (M01 §3.5): se abre tras comprar Pro sin cuenta, para
 * que la compra quede atada a una. Mismo flujo, con otro título.
 *
 * Pasa a `DragSheet` como el resto de los modales (§9 de docs/UI-MIGRATION.md).
 * Entrar y crear van por `useTrainerAccount` y las acciones de cuenta del
 * store (M03-01): aquí no se toca Supabase.
 */

import { useState, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Text, TextInput } from './ui/Text';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import { APPLE_AUTH_AVAILABLE } from '../services/appleAuth';
import useTrainerAccount, { askCreateInstead } from '../hooks/useTrainerAccount';
import DragSheet from './DragSheet';
import CodeField from './ui/CodeField';
import { SectionLabel } from './ui/MenuList';
import { GoogleIcon, AppleIcon, KeyIcon, ICON_SIZE } from './ui/AccountIcons';
import CodeReveal from './CodeReveal';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

import { showDialog } from './ui/dialog';

// ── Campo del nombre visible para los clientes ────────────────────────────────

function NameField({ value, onChange }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  return (
    <View>
      <SectionLabel>{t('sync.nameLabel')}</SectionLabel>
      <TextInput
        style={styles.nameInput}
        placeholder={t('sync.namePlaceholder')}
        placeholderTextColor={th.colors.mutedLight}
        value={value}
        onChangeText={onChange}
        returnKeyType="done"
        autoCorrect={false}
        maxLength={40}
      />
      <Text style={styles.hintLeft}>{t('sync.nameHint')}</Text>
    </View>
  );
}

// ── Fila que actúa directamente (la `.opt` de la maqueta) ─────────────────────

function EntryRow({ icon, label, tag, busy, disabled, onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.entry, disabled && styles.entryDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.entryIcon}>{icon}</View>
      <Text style={styles.entryLabel}>{label}</Text>
      {busy
        ? <ActivityIndicator color={th.colors.accent} size="small" />
        : (
          <>
            {!!tag && <View style={styles.tag}><Text style={styles.tagTxt}>{tag}</Text></View>}
            <Text style={styles.chev}>›</Text>
          </>
        )}
    </TouchableOpacity>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function TrainerSyncModal({ visible, onClose, isFirstTime = true, purpose = 'sync', initialScreen = 'select' }) {
  const forPurchase = purpose === 'purchase';
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const setTrainerName     = useStore((s) => s.setTrainerName);
  const trainerSync        = useStore((s) => s.trainerSync);

  const [screen,    setScreen]    = useState(initialScreen); // 'select' | 'code_reveal' | 'recovery'
  const [newCode,   setNewCode]   = useState(null);
  const [nameInput, setNameInput] = useState(trainerSync.trainerName ?? '');
  // Qué fila está en marcha ('google' | 'apple' | 'code'), para su ruedecita.
  const [pending,   setPending]   = useState(null);

  // Recuperar cuenta (antes una sub-pantalla con su propio estado)
  const [recoverCode,    setRecoverCode]    = useState('');
  const [recoverError,   setRecoverError]   = useState(null);

  // Sync local inputs when modal reopens (Modal stays mounted when hidden in RN).
  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (visible) {
      setNameInput(trainerSync.trainerName ?? '');
      setScreen(initialScreen);
      setRecoverCode('');
      setRecoverError(null);
    }
  }, [visible]);

  // Entrar con Google, Apple o código y crear cuenta: useTrainerAccount (lo comparte con el recorrido de entrada).
  const acct = useTrainerAccount();
  const { loading, isExpoGo } = acct;

  function showSocialError(provider, err) {
    showDialog(
      t(provider === 'apple' ? 'sync.errAppleTitle' : 'sync.errGoogleTitle'),
      err?.message ?? t('sync.errGoogleBody'),
    );
  }

  /**
   * Google o Apple: cerrar al entrar; cancelar no es un error. Con `mustExist`
   * (desde «Ya tengo cuenta») solo entra: si no hay cuenta, pregunta (§7.4).
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

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleName(v) {
    setNameInput(v);
    setTrainerName(v.trim() || null);
  }

  async function handleRecover() {
    if (!recoverCode.trim()) return;
    setRecoverError(null);
    try {
      await acct.recover(recoverCode);
    } catch (err) {
      setRecoverError(err?.message ?? t('sync.errReconnectBody'));
      return;
    }
    setScreen('select');
    onClose();
  }

  const busy = pending !== null;
  const socialDisabled = busy || isExpoGo;

  const titles = {
    select:      forPurchase ? t('sync.purchaseTitle') : t('sync.createTitle'),
    code_reveal: t('sync.revealTitle'),
    recovery:    t('sync.recoveryTitle'),
  };

  const action = screen === 'code_reveal'
    ? { label: t('common.accept'),      onPress: () => { setScreen('select'); onClose(); } }
    : screen === 'recovery'
      ? { label: t('trainer.codeBack'), onPress: () => setScreen('select') }
      : { label: forPurchase || isFirstTime ? t('sync.notNow') : t('common.cancel'), onPress: onClose };

  /** Google (y Apple en iOS) con «Recomendado». `mustExist`: solo entrar. */
  const socialRows = (mustExist) => (
    <>
      {APPLE_AUTH_AVAILABLE && (
        <EntryRow
          icon={<AppleIcon />}
          label={t('sync.rowApple')}
          tag={t('sync.recommended')}
          busy={pending === 'apple'}
          disabled={socialDisabled}
          onPress={() => social('apple', mustExist)}
        />
      )}
      <EntryRow
        icon={<GoogleIcon />}
        label={t('sync.rowGoogle')}
        tag={t('sync.recommended')}
        busy={pending === 'google'}
        disabled={socialDisabled}
        onPress={() => social('google', mustExist)}
      />
    </>
  );

  return (
    <DragSheet
      visible={visible}
      onClose={onClose}
      title={titles[screen]}
      action={action}
    >
      {/* ── Código recién creado ── */}
      {screen === 'code_reveal' && newCode && (
        <CodeReveal code={newCode} purchase={forPurchase} onDone={() => { setScreen('select'); onClose(); }} />
      )}

      {/* ── «¿Cómo entrabas?»: el código, Google o Apple (solo entran) ── */}
      {screen === 'recovery' && (
        <View style={styles.block}>
          <Text style={styles.lead}>{t('sync.recoveryLead')}</Text>

          <CodeField
            value={recoverCode}
            onChangeText={(v) => { setRecoverCode(v); setRecoverError(null); }}
            groups={3}
            onSubmitEditing={handleRecover}
            error={recoverError}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, (!recoverCode.trim() || loading) && styles.btnDisabled]}
            onPress={handleRecover}
            disabled={!recoverCode.trim() || loading}
            activeOpacity={0.85}
          >
            {loading && !busy
              ? <ActivityIndicator color={th.colors.onAccent} />
              : <Text style={styles.primaryBtnText}>{t('sync.recoveryCta')}</Text>}
          </TouchableOpacity>

          <View>
            <SectionLabel>{t('sync.recoverySocial')}</SectionLabel>
            <View style={styles.entries}>{socialRows(true)}</View>
            {isExpoGo && <Text style={styles.hintLeft}>{t('sync.onlyInstalled')}</Text>}
          </View>
        </View>
      )}

      {/* ── Entrar o crear la cuenta ── */}
      {screen === 'select' && (
        <View style={styles.block}>
          {forPurchase && <Text style={styles.lead}>{t('sync.purchaseLead')}</Text>}

          {/* El nombre solo hace falta al crear la cuenta: con ella puesta se cambia en «Mi cuenta». */}
          {!forPurchase && !trainerSync.userId && <NameField value={nameInput} onChange={handleName} />}

          <View style={styles.entries}>
            {socialRows(false)}
            <EntryRow
              icon={<KeyIcon />}
              label={t('sync.rowCode')}
              busy={pending === 'code'}
              disabled={busy}
              onPress={createCode}
            />
          </View>
          {isExpoGo && <Text style={styles.hintLeft}>{t('sync.onlyInstalled')}</Text>}

          <TouchableOpacity onPress={() => setScreen('recovery')} disabled={busy} activeOpacity={0.7}>
            <Text style={styles.link}>{t('sync.haveCode')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </DragSheet>
  );
}

const makeStyles = (th) => StyleSheet.create({
  block: { gap: spacing.lg, paddingBottom: spacing.md },
  lead:  { ...textStyles.body, color: th.colors.mutedLight, lineHeight: 18 },
  hintLeft: { ...textStyles.label, color: th.colors.mutedLight, lineHeight: 15, marginTop: spacing.sm },
  link:     { ...textStyles.labelStrong, color: th.tint.accent50, textAlign: 'center' },

  // Filas que actúan directamente (`.opt` de la maqueta account.html).
  entries: { gap: spacing.sm2 },
  entry: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    minHeight:       56,
    padding:         spacing.lg,
    borderRadius:    th.radius.lg,
    backgroundColor: th.colors.surface,
  },
  entryDisabled: { opacity: 0.45 },
  entryIcon:     { width: ICON_SIZE, height: ICON_SIZE },
  entryLabel:    { ...textStyles.itemTitleQuiet, flex: 1, color: th.colors.text },
  // «Recomendado»: caps lima sobre accent10, como la etiqueta del recorrido de entrada.
  tag: {
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs2,
    backgroundColor:   th.tint.accent10,
  },
  tagTxt: { ...textStyles.caps, color: th.colors.accent },
  chev:   { ...textStyles.title, color: th.colors.muted },

  nameInput: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    ...textStyles.itemTitle,
    color:             th.colors.text,
  },

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
