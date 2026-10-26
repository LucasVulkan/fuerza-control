/**
 * TrainerConnectionScreen — la conexión con TU entrenador (lado cliente).
 * Maqueta: docs/mockups/trainer-connection.html (C09 §4.8).
 *
 * La gramática de Mi cuenta (CardKit): una TARJETA que dice dónde estás —estado
 * con punto de color, con quién y tres datos (programa, último envío, acceso)
 * en filas finas que no parecen botones— con la acción que toca dentro, y
 * debajo, el resto de opciones como filas cortas sin subtítulo: lo que implican
 * lo dice su confirmación, no la fila.
 *
 * Cuatro estados: sin entrenador · conectado · falta enviar · desconectado (con
 * su motivo, `clientSync.lostReason`, C09 §4.6).
 *
 * «Qué ve tu entrenador» es una línea, verificada contra `scopeFilterForUpload`
 * (`src/utils/clientLogs.js`): las sesiones de sus programas y las libres
 * posteriores a la conexión — nada más.
 */

import { useState } from 'react';
import { View, ScrollView, Pressable, Share, StyleSheet } from 'react-native';
import { Text } from '../components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Circle, G } from 'react-native-svg';

import { useStore }               from '../../store/useStore';
import { APPLE_AUTH_AVAILABLE }   from '../services/appleAuth';
import { WEB_URL }                from '../config/web';
import ClientCodeModal            from '../components/ClientCodeModal';
import ClientGoogleLinkModal      from '../components/ClientGoogleLinkModal';
import { Section, MenuRow, RowIcon } from '../components/ui/MenuList';
import { ROW_ICON }               from '../components/ui/rowIcons';
import { ModeIcon }               from '../components/ui/AccountIcons';
import AppleSignInButton          from '../components/ui/AppleSignInButton';
import GoogleSignInButton         from '../components/ui/GoogleSignInButton';
import { Btn, Explain, Press }    from '../components/ui/CardKit';
import { Rise }                   from '../components/ui/Rise';
import { formatWhen }             from '../utils/formatWhen';
import { spacing, textStyles }    from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { showDialog }             from '../components/ui/dialog';
import ScreenHeader               from '../components/ui/ScreenHeader';

// Los tres pasos de «sin entrenador»: código → programa → sesiones.
const STEP_PATHS = [
  'M11 12l9-9M17 6l3 3M14 9l2 2',                          // llave (con el círculo de abajo)
  'M9 8h6M9 12h6M9 16h3M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  'M22 2L11 13M22 2l-7 20-4-9-9-4z',                        // enviar
];

// El avión de papel pesa abajo a la izquierda: centrado por su caja se ve
// descentrado. Se corre un punto hacia arriba a la derecha.
const STEP_NUDGE = [null, null, 'translate(-1 1)'];

function StepIcon({ i, color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <G transform={STEP_NUDGE[i] ?? undefined}>
        {i === 0 && <Circle cx="8" cy="15" r="4" />}
        <Path d={STEP_PATHS[i]} />
      </G>
    </Svg>
  );
}

// Compartir: flecha que sale de la bandeja.
const SHARE_ICON = <Path d="M12 15V3M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />;

export default function TrainerConnectionScreen() {
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);
  const { t }      = useTranslation();
  const navigation = useNavigation();

  const clientSync            = useStore((s) => s.clientSync);
  // Invitación (M01-04): RootNavigator trae aquí; la hoja se abre con el código.
  const pendingInvite         = useStore((s) => s.pendingInviteCode);
  const programs              = useStore((s) => s.programs);
  const profile               = useStore((s) => s.profile);
  const disconnectFromTrainer = useStore((s) => s.unlinkFromTrainer);
  const uploadHistory         = useStore((s) => s.uploadHistoryToTrainer);
  const showToast             = useStore((s) => s.showToast);

  // La hoja del código: { reconnect?, social?, provider? } o null.
  const [codeSheet,       setCodeSheet]       = useState(null);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [retrying,        setRetrying]        = useState(false);

  const lang          = profile.language ?? 'es';
  const isConnected   = !!clientSync.slotId;
  // El servidor dijo que ya no tiene asiento (C09 §4.3).
  const isLost        = isConnected && !!clientSync.lostAt;
  const hasError      = isConnected && !isLost && !!(clientSync.pendingUpload || clientSync.syncErrorAt);
  const activeProgram = profile.activeProgramId ? programs[profile.activeProgramId] : null;
  const provider      = clientSync.googleLinked ? (clientSync.linkedProvider ?? 'google') : null;

  // Desconectado: con Google/Apple nadie le echa con el código (C09 §4.7), así
  // que su motivo es haber perdido la sesión y la salida es su cuenta. Con
  // código, el motivo dice qué hacer, y con 'identity' el código va ya puesto.
  const lostWhy     = provider ? 'social' : (clientSync.lostReason ?? 'gone');
  const lostKey     = { social: 'Social', identity: 'Identity', taken: 'Taken' }[lostWhy] ?? '';
  const reuseCode   = isLost && (lostWhy === 'identity' || lostWhy === 'taken') ? clientSync.clientCode : null;

  const when = (v) => formatWhen(v, lang, t('dayCard.today'), t('dayCard.yesterday'));
  const trainerName = clientSync.trainerName || t('trainer.unnamedTrainer');

  async function handleRetry() {
    setRetrying(true);
    try {
      await uploadHistory();
      showToast(t('header.toastSynced'), 2200, 'success');
    } catch {
      showToast(t('header.toastSyncFailed'), 2200, 'error');
    } finally {
      setRetrying(false);
    }
  }

  // Si hay entrenos que no llegan, el store no desconecta y dice cuántos (E51).
  // Sin red se desconecta igual y el servidor se entera después (E52); si el
  // asiento cambió en otro móvil, no se desconecta (E66).
  async function disconnect(force) {
    try {
      const { unsent, offline, changed } = await disconnectFromTrainer({ force });
      if (unsent) {
        showDialog(t('trainer.unsentTitle'), t('trainer.unsentBody', { count: unsent }), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('trainer.unsentConfirm'), style: 'destructive', onPress: () => disconnect(true) },
        ]);
        return;
      }
      if (changed) {
        showDialog(t('trainer.disconnectTitle'), t('trainer.seatChanged', { trainer: useStore.getState().clientSync.trainerName || t('trainer.unnamedTrainer') }));
        return;
      }
      if (offline) showToast(t('trainer.disconnectedOffline'), 3200);
      navigation.goBack();
    } catch {
      showToast(t('header.toastSyncFailed'), 2200, 'error');
    }
  }

  function handleDisconnect() {
    showDialog(t('trainer.disconnectTitle'), t('trainer.disconnectBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('trainer.disconnectConfirm'), style: 'destructive', onPress: () => disconnect(false) },
    ]);
  }

  function invite() {
    Share.share({ message: t('onboardingFlow.coached.noapp.inviteMessage', { url: WEB_URL }) }).catch(() => {});
  }

  // ── Piezas ──────────────────────────────────────────────────────────────────

  /** Punto de color + palabra: lo primero que se lee. tone: on · warn · off. */
  const stateLine = (tone, label) => (
    <View style={styles.stateRow}>
      <View style={[styles.dot, tone === 'on' && styles.dotOn, tone === 'warn' && styles.dotWarn]} />
      <Text style={[styles.state, tone === 'on' && styles.stateOn, tone === 'warn' && styles.stateWarn]}>{label}</Text>
    </View>
  );

  /** Un dato: etiqueta a la izquierda, valor a la derecha. Ni icono ni flecha: no se pulsa. */
  const fact = (key, value, { tone, note, code } = {}) => (
    <View style={styles.fact} key={key}>
      <Text style={styles.factKey}>{t(`trainer.fact.${key}`)}</Text>
      <Text style={[styles.factVal, code && styles.factCode, tone === 'warn' && styles.factWarn]} numberOfLines={1}>
        {value}{note ? <Text style={styles.factNote}>{`  ${note}`}</Text> : null}
      </Text>
    </View>
  );

  const programFact = (note) => fact('program', activeProgram?.name ?? t('trainer.rowProgramNone'), { note });

  const access = provider
    ? fact('access', t(provider === 'apple' ? 'account.short.apple' : 'account.short.google'))
    : fact('access', clientSync.clientCode ?? t('trainer.accessCode'), { code: !!clientSync.clientCode });

  const brandButtons = provider === 'apple' && APPLE_AUTH_AVAILABLE
    ? <AppleSignInButton onPress={() => setCodeSheet({ social: true, provider: 'apple' })} />
    : <GoogleSignInButton onPress={() => setCodeSheet({ social: true, provider: 'google' })} />;

  const options = (
    <Section title={t('trainer.sectionOptions')} style={styles.options}>
      {!isLost && !provider && (
        <MenuRow
          icon={<ModeIcon mode={APPLE_AUTH_AVAILABLE ? 'apple' : 'google'} size={18} color={th.colors.mutedLight} />}
          label={t(APPLE_AUTH_AVAILABLE ? 'trainer.linkAccountLabel' : 'trainer.linkGoogleLabel')}
          onPress={() => setShowGoogleModal(true)}
        />
      )}
      <MenuRow
        icon={<RowIcon>{ROW_ICON.sync}</RowIcon>}
        label={t('trainer.changeLabel')}
        onPress={() => setCodeSheet({})}
      />
      <MenuRow
        icon={<RowIcon color={th.tint.red50}>{ROW_ICON.logout}</RowIcon>}
        label={t('trainer.disconnectLabel')}
        labelColor={th.tint.red50}
        onPress={handleDisconnect}
      />
    </Section>
  );

  // ── Estados ─────────────────────────────────────────────────────────────────

  let body;
  if (!isConnected) {
    body = (
      <>
        <View style={styles.card}>
          <Text style={styles.offHeading}>{t('trainer.offHeading')}</Text>
          <Explain>{t('trainer.offWhy')}</Explain>
          <View style={styles.steps}>
            <View style={styles.stepsLine} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.step}>
                <View style={styles.stepIcon}><StepIcon i={i} color={th.colors.accent} /></View>
                <Text style={styles.stepText}>{t(`trainer.step${i + 1}`)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.acts}>
            <Btn tone="acc" label={t('trainer.enterCode')} onPress={() => setCodeSheet({})} />
          </View>
          <Pressable style={styles.link} onPress={() => setCodeSheet({ reconnect: true, social: true })} hitSlop={8}>
            <Text style={styles.linkText}>{t('trainer.alreadyConnected')}</Text>
          </Pressable>
        </View>

        {/* Promo: discreta, fuera de la tarjeta. */}
        <Press style={styles.invite} onPress={invite}>
          <Text style={styles.inviteQ} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {t('trainer.inviteQ')} <Text style={styles.inviteCta}>{t('trainer.inviteCta')}</Text>
          </Text>
          <RowIcon color={th.colors.accent}>{SHARE_ICON}</RowIcon>
        </Press>
      </>
    );
  } else if (isLost) {
    body = (
      <>
        <View style={styles.card}>
          {stateLine('warn', t('trainer.tagLost'))}
          <Text style={[styles.name, styles.nameDim]}>{trainerName}</Text>
          <Explain tone="warn">{t(`trainer.lostSub${lostKey}`)}</Explain>
          <View style={styles.acts}>
            {lostWhy === 'social'
              ? brandButtons
              : <Btn tone="acc" label={t(`trainer.lostCta${lostKey}`)} onPress={() => setCodeSheet({})} />}
          </View>
          <View style={styles.facts}>
            {programFact(t('trainer.onMyPhone'))}
            {fact('lastSent', when(clientSync.lastSyncedAt) ?? t('trainer.never'))}
          </View>
        </View>
        {options}
      </>
    );
  } else {
    body = (
      <>
        <View style={styles.card}>
          {stateLine(hasError ? 'warn' : 'on', t(hasError ? 'trainer.tagPending' : 'trainer.tagConnected'))}
          <Text style={styles.name}>{trainerName}</Text>
          <View style={styles.facts}>
            {programFact()}
            {hasError && clientSync.syncErrorAt
              ? fact('lastSent', t('trainer.failedAt', { when: when(clientSync.syncErrorAt) }), { tone: 'warn' })
              : fact('lastSent', when(clientSync.lastSyncedAt) ?? t('trainer.never'))}
            {access}
          </View>
          {hasError && (
            <View style={styles.acts}>
              <Btn label={t('trainer.retryLabel')} loading={retrying} onPress={handleRetry} />
            </View>
          )}
          <Explain>{t('trainer.privacyLine')}</Explain>
        </View>
        {options}
      </>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {/* Se entra deslizando desde la derecha: se sale con ‹ (U36). */}
      <ScreenHeader onBack={() => navigation.goBack()} eyebrow={t('header.sectionConnections')} title={t('trainer.title')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Rise index={0}>{body}</Rise>
      </ScrollView>

      <ClientCodeModal
        initialCode={reuseCode}
        visible={!!codeSheet || !!pendingInvite}
        startWithSocial={!!codeSheet?.social && !pendingInvite}
        reconnect={!!codeSheet?.reconnect}
        autoProvider={codeSheet?.provider ?? null}
        onClose={() => setCodeSheet(null)}
        onSuccess={() => setCodeSheet(null)}
      />

      <ClientGoogleLinkModal
        // Con una invitación pendiente, lo primero que se ve es la hoja con el código.
        visible={showGoogleModal && !pendingInvite}
        onClose={() => setShowGoogleModal(false)}
      />
    </SafeAreaView>
  );
}

// Medidas de Mi cuenta (AccountScreen): mismas tarjetas, títulos y explicación.
const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },
  content:   { paddingTop: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  card: { backgroundColor: th.colors.surface, borderRadius: th.radius.md, padding: spacing.lg, overflow: 'hidden' },

  // Estado
  stateRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: th.colors.muted },
  dotOn:     { backgroundColor: th.colors.accent },
  dotWarn:   { backgroundColor: th.colors.orange },
  state:     { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase' },
  stateOn:   { color: th.colors.accent },
  stateWarn: { color: th.colors.orange },
  name:      { ...textStyles.title, color: th.colors.text, marginTop: spacing.sm2 },
  nameDim:   { color: th.colors.mutedLight },
  offHeading: { ...textStyles.heading, color: th.colors.text },

  // Datos
  facts:    { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: th.colors.surface2 },
  fact: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: th.colors.surface2,
  },
  factKey:  { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase' },
  factVal:  { ...textStyles.bodyStrong, color: th.colors.text, flexShrink: 1, textAlign: 'right' },
  factCode: { color: th.colors.accent },
  factWarn: { color: th.colors.orange },
  factNote: { ...textStyles.label, color: th.colors.mutedLight },

  acts:    { gap: spacing.sm2, marginTop: spacing.lg },
  options: { marginTop: spacing.xl, marginBottom: 0 },

  // Sin entrenador: tres pasos, unidos por una línea detrás de los iconos
  steps:     { flexDirection: 'row', marginTop: spacing.lg },
  stepsLine: { position: 'absolute', top: 21, left: '17%', right: '17%', height: 2, backgroundColor: th.colors.surface2 },
  step:      { flex: 1, alignItems: 'center', gap: spacing.sm2 },
  stepIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: th.colors.surface3,
    alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: th.colors.surface,
  },
  stepText:  { ...textStyles.labelStrong, color: th.colors.text, textAlign: 'center' },
  link:      { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xs },
  linkText:  { ...textStyles.button, color: th.colors.accent },

  invite: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md,
    padding: spacing.lg, borderRadius: th.radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: th.colors.surface3,
  },
  inviteQ:    { ...textStyles.body, color: th.colors.mutedLight, flex: 1 },
  inviteCta:  { ...textStyles.button, color: th.colors.accent },
});
