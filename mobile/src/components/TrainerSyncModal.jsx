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
import * as Clipboard   from 'expo-clipboard';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import { APPLE_AUTH_AVAILABLE } from '../services/appleAuth';
import useTrainerAccount, { askCreateInstead } from '../hooks/useTrainerAccount';
import DragSheet from './DragSheet';
import CodeField from './ui/CodeField';
import { SectionLabel, RowIcon } from './ui/MenuList';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

import { showDialog } from './ui/dialog';

// Iconos de las filas, los de la maqueta (account.html). Google lleva los
// colores de su marca; Apple y la llave, el del texto.
const ICON_SIZE = 20;
function GoogleIcon() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5z" />
      <Path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10 10 0 0 0 12 22z" />
      <Path fill="#FBBC05" d="M6.2 13.6a6 6 0 0 1 0-3.8V7.1H2.7a10 10 0 0 0 0 9z" />
      <Path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.5l3-3A10 10 0 0 0 2.7 7.1l3.5 2.7C7 7.8 9.3 6 12 6z" />
    </Svg>
  );
}
function AppleIcon() {
  const th = useTheme();
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill={th.colors.text}>
      <Path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9a5 5 0 0 0-4.2 2.6c-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5a11 11 0 0 0 1.4-2.9 4.5 4.5 0 0 1-2.7-4.1zM13.9 4.9A4.4 4.4 0 0 0 15 1.7a4.6 4.6 0 0 0-3 1.5 4.2 4.2 0 0 0-1 3.1c1.1.1 2.2-.6 2.9-1.4z" />
    </Svg>
  );
}
function KeyIcon() {
  const th = useTheme();
  return (
    <RowIcon color={th.colors.text} size={ICON_SIZE} strokeWidth={2.2}>
      <Circle cx="8" cy="15" r="4" />
      <Path d="M11 12l9-9M17 6l3 3M14 9l2 2" />
    </RowIcon>
  );
}

// ── Caja del código (verlo y copiarlo) ────────────────────────────────────────

function CodeBox({ code }) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <TouchableOpacity style={styles.codeBox} onPress={handleCopy} activeOpacity={0.7}>
      <Text style={styles.codeText}>{code}</Text>
      <Text style={styles.codeHint}>{copied ? t('sync.copied') : t('sync.copyHint')}</Text>
    </TouchableOpacity>
  );
}

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
        <View style={styles.block}>
          <Text style={styles.lead}>{t('sync.revealLead')}</Text>

          <CodeBox code={newCode} />

          <View style={styles.warnCard}>
            <Text style={styles.warnText}>{t(forPurchase ? 'sync.revealWarnPurchase' : 'sync.revealWarn')}</Text>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => { setScreen('select'); onClose(); }}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{t('sync.revealCta')}</Text>
          </TouchableOpacity>
        </View>
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

  // Caja del código: el código es el protagonista, con la pista de copiar debajo.
  codeBox: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.lg,
    alignItems:      'center',
    gap:             spacing.sm,
  },
  codeText: {
    ...textStyles.code,
    color:         th.colors.accent,
    fontVariant:   ['tabular-nums'],
  },
  codeHint:   { ...textStyles.label, color: th.colors.mutedLight },

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

  warnCard: {
    backgroundColor: th.tint.orange30,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  warnText: { ...textStyles.label, color: th.tint.orange50, lineHeight: 15 },

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
