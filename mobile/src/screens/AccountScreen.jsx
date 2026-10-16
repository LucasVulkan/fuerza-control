/**
 * AccountScreen — «Mi cuenta»: la cuenta del entrenador y el plan en una página
 * (docs/specs/M03-mi-cuenta.md §6, maqueta docs/mockups/account.html).
 *
 * Dos bloques: CUENTA DE ENTRENADOR (con todas sus acciones dentro) y PLAN
 * (solo las suyas). Cuatro estilos y nada más: `caps` = título, `heading` /
 * `code` / `heroName` = lo que tengo, `button` = lo que puedo hacer, `body` con
 * barra a la izquierda = explicación (una por bloque como mucho).
 *
 * Entrar, cambiar de forma y salir pasan por `useTrainerAccount` y las acciones
 * de cuenta del store: aquí no se toca Supabase salvo para LEER el correo de la
 * sesión. Cambiar de forma y el código recién creado son una sola `DragSheet`
 * que cambia de contenido sin cerrarse; desconectar se confirma con `showDialog`.
 *
 * Las acciones de la cuenta van en secciones con título, con las filas de
 * `MenuList` del resto de la app («CAMBIAR A», «MÁS OPCIONES»): un
 * grupo sin título escondido tras «Más opciones» no decía para qué era.
 */

import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Pressable, Linking, Platform, StyleSheet } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import Reanimated, { FadeIn } from 'react-native-reanimated';

import { useStore } from '../../store/useStore';
import { trainerSupabase } from '../config/supabase';
import { APPLE_AUTH_AVAILABLE } from '../services/appleAuth';
import useTrainerAccount from '../hooks/useTrainerAccount';
import { useEnterClock, EnterClock } from '../hooks/useEnterClock';
import { FREE, templateCounts, isConnected } from '../utils/freePlan';
import ScreenHeader from '../components/ui/ScreenHeader';
import { Rise } from '../components/ui/Rise';
import { Press, Btn, Explain } from '../components/ui/CardKit';
import { Section, MenuRow, RowIcon } from '../components/ui/MenuList';
import { ROW_ICON } from '../components/ui/rowIcons';
import { ModeIcon } from '../components/ui/AccountIcons';
import AppleSignInButton from '../components/ui/AppleSignInButton';
import GoogleSignInButton from '../components/ui/GoogleSignInButton';
import { showDialog } from '../components/ui/dialog';
import DragSheet from '../components/DragSheet';
import CodeReveal from '../components/CodeReveal';
import TrainerSyncModal from '../components/TrainerSyncModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import TrainerRelogin from '../components/TrainerRelogin';
import PaywallModal from '../components/PaywallModal';
import { spacing, textStyles, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

// Cuánto tarda en volver el icono de copiar tras copiar.
const COPIED_MS = 2000;
// Las formas de entrar que se recomiendan (D4): Apple solo existe en iPhone.
const SOCIAL = APPLE_AUTH_AVAILABLE ? ['apple', 'google'] : ['google'];
const USE_KEY = { google: 'account.useGoogle', apple: 'account.useApple', code: 'account.useCode' };

// ── Piezas sueltas ────────────────────────────────────────────────────────────

/** El panel de PRO: degradado `accent` → `green`, el del panel del paywall. Medido, no al 100 % (ver PaywallModal). */
function GradientCard({ style, children }) {
  const th = useTheme();
  const [box, setBox] = useState(null);
  return (
    <View style={style} onLayout={(e) => setBox(e.nativeEvent.layout)}>
      {box && (
        <Svg width={box.width} height={box.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="accountPro" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={th.colors.accent} />
              <Stop offset="1" stopColor={th.colors.green} />
            </LinearGradient>
          </Defs>
          <Rect width={box.width} height={box.height} fill="url(#accountPro)" />
        </Svg>
      )}
      {children}
    </View>
  );
}

function CopyIcon({ color }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="9" y="9" width="11" height="11" rx="2" />
      <Path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </Svg>
  );
}
function CheckIcon({ color }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12.5l4.5 4.5L19 7" />
    </Svg>
  );
}

/** Medidor del plan gratis: `n/máx` y una barra de `máx` segmentos. */
function Meter({ label, n, max }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.meter}>
      <View style={styles.meterLbl}>
        <Text style={styles.meterKey} numberOfLines={1}>{label}</Text>
        <Text style={styles.meterVal}>{n}/{max}</Text>
      </View>
      <View style={styles.meterBars}>
        {Array.from({ length: max }, (_, i) => <View key={i} style={[styles.meterBar, i < n && styles.meterBarOn]} />)}
      </View>
    </View>
  );
}

/** El nombre que ven los clientes: se escribe ahí mismo y se guarda al terminar. */
function NameField() {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const trainerName    = useStore((s) => s.trainerSync?.trainerName);
  const setTrainerName = useStore((s) => s.setTrainerName);
  const [draft, setDraft] = useState(trainerName ?? '');
  const [focus, setFocus] = useState(false);
  const input = useRef(null);
  return (
    <Pressable style={styles.nameCard} onPress={() => input.current?.focus()}>
      <Text style={styles.inputKey}>{t('account.nameLabel')}</Text>
      <TextInput
        ref={input}
        style={[styles.inputBox, focus && styles.inputFocus]}
        value={draft}
        onChangeText={setDraft}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onEndEditing={() => setTrainerName(draft)}
        placeholder={t('sync.namePlaceholder')}
        placeholderTextColor={th.colors.muted}
        returnKeyType="done"
        autoCorrect={false}
        maxLength={40}
      />
    </Pressable>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const acct       = useTrainerAccount();
  const enterClock = useEnterClock();

  const trainerSync      = useStore((s) => s.trainerSync);
  const isPro            = useStore((s) => s.profile?.isPro ?? false);
  const clients          = useStore((s) => s.clients);
  const programs         = useStore((s) => s.programs);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const hasRemoteAccount = useStore((s) => s.hasRemoteAccount());

  const mode       = trainerSync?.mode ?? null;
  const hasAccount = !!mode && mode !== 'offline';

  const [sheet,       setSheet]       = useState(null); // { kind: 'switch', to } | { kind: 'reveal', code }
  const [syncModal,   setSyncModal]   = useState(null); // 'select' | 'recovery'
  const [showDelete,  setShowDelete]  = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [sessionEmail, setSessionEmail] = useState(null);
  const needsLogin = useStore((s) => s.trainerLoginNeeded);
  const [pro,         setPro]         = useState(null);

  // El correo de Google o Apple se guarda al entrar (`trainerSync.email`); las
  // cuentas de antes de guardarlo lo leen de la sesión de entrenador. Y si
  // Google/Apple perdió la sesión, se dice aquí con su botón (C09 §3.6): antes
  // solo salía «Sesión expirada» al mandar algo, sin decir dónde arreglarlo.
  useEffect(() => {
    if (!hasAccount) return undefined;
    let alive = true;
    trainerSupabase.auth.getSession().then(({ data }) => { if (alive) setSessionEmail(data.session?.user?.email ?? null); }, () => {});
    useStore.getState().trainerSessionState();   // pone `trainerLoginNeeded`
    return () => { alive = false; };
  }, [hasAccount, trainerSync?.userId]);
  const email = trainerSync?.email ?? sessionEmail;

  // El plan se mira al abrir la página, no se lleva encima (`getProDetails`).
  useEffect(() => {
    if (!isPro) return undefined;
    let alive = true;
    useStore.getState().getProDetails().then((d) => { if (alive) setPro(d); });
    return () => { alive = false; };
  }, [isPro]);
  const proDetails = isPro ? pro : null;

  async function copyCode() {
    await Clipboard.setStringAsync(trainerSync.code);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  }

  // ── Acciones de las hojas ───────────────────────────────────────────────────

  async function doSwitch(to) {
    try {
      if (to === 'code') {
        const { code } = await acct.createCode();
        setSheet({ kind: 'reveal', code });
        return;
      }
      await (to === 'apple' ? acct.signInWithApple : acct.signInWithGoogle)();
      setSheet(null);
    } catch (err) {
      if (err?.cancelled) return;
      showDialog(
        t(to === 'apple' ? 'sync.errAppleTitle' : to === 'code' ? 'sync.errAccountTitle' : 'sync.errGoogleTitle'),
        err?.message ?? t(to === 'code' ? 'sync.errAccountBody' : 'sync.errGoogleBody'),
      );
    }
  }

  function confirmLeave() {
    const back = mode === 'code'
      ? t('account.leaveBackCode')
      : t('account.leaveBackSocial', { how: t(`account.short.${mode}`) });
    showDialog(t('account.leaveTitle'), t('account.leaveWhy', { back }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.leaveCta'),
        style: 'destructive',
        onPress: () => acct.leave().catch((err) => showDialog(t('common.error'), err?.message)),
      },
    ]);
  }

  /** La fila de borrar: sale con y sin cuenta de entrenador (D11). */
  const deleteRow = (
    <MenuRow
      icon={<RowIcon color={th.tint.red50}>{ROW_ICON.trash}</RowIcon>}
      label={t('account.deleteRow')}
      labelColor={th.tint.red50}
      onPress={() => setShowDelete(true)}
    />
  );

  // ── Plan ────────────────────────────────────────────────────────────────────

  const storeName = proDetails?.store === 'PLAY_STORE' ? 'Google Play'
    : proDetails?.store === 'APP_STORE' || proDetails?.store === 'MAC_APP_STORE' ? 'App Store'
    : Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  const proKind = proDetails?.kind === 'annual'
    ? t('account.proAnnual', {
      date: new Date(proDetails.expiresAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }),
    })
    : proDetails?.kind === 'lifetime' ? t('account.proLifetime')
    : proDetails?.kind === 'gift'     ? t('account.proGift')
    : null;

  const clientList = Object.values(clients ?? {});
  const counts     = templateCounts({ programs, sessionTemplates });

  // ── Bloques ─────────────────────────────────────────────────────────────────

  const trainerBlock = !hasAccount ? (
    <>
      <View style={styles.card}>
        <Text style={styles.how}>{t('account.notConnected')}</Text>
        <Explain>{t('account.noneWhy')}</Explain>
        <View style={styles.acts}>
          <Btn grow tone="acc" label={t('account.create')} onPress={() => setSyncModal('select')} />
          <Btn grow label={t('account.haveAccount')} onPress={() => setSyncModal('recovery')} />
        </View>
      </View>
      {hasRemoteAccount && (
        <Section title={t('account.sectionDelete')} style={styles.subSection}>{deleteRow}</Section>
      )}
    </>
  ) : (
    <>
      <View style={styles.card}>
        <View style={styles.howRow}>
          <ModeIcon mode={mode} size={15} color={th.colors.mutedLight} />
          <Text style={styles.how}>{t('account.connectedWith', { how: t(`account.short.${mode}`) })}</Text>
        </View>
        {mode === 'code' ? (
          <>
            <View style={styles.haveRow}>
              <Text style={[styles.have, styles.haveCode]} numberOfLines={1}>{trainerSync.code}</Text>
              <Press
                style={[styles.iconBtn, copied && styles.iconBtnDone]}
                onPress={copyCode}
              >
                <Reanimated.View key={copied ? 'ok' : 'copy'} entering={FadeIn.duration(150)}>
                  {copied ? <CheckIcon color={th.colors.accent} /> : <CopyIcon color={th.colors.text} />}
                </Reanimated.View>
              </Press>
            </View>
            <Explain>
              {t('account.codeWhy', { social: t(APPLE_AUTH_AVAILABLE ? 'account.socialIos' : 'account.socialAndroid') })}
            </Explain>
          </>
        ) : (
          <Text style={[styles.have, styles.haveMail]}>{email ?? t('account.emailHidden')}</Text>
        )}
        {/* Dentro de la misma tarjeta: es el estado de esta cuenta, no otra cosa. */}
        {needsLogin && mode !== 'code' && <TrainerRelogin />}
      </View>

      <NameField />

      <Section title={t('account.sectionSwitch')} style={styles.subSection}>
        {[...SOCIAL, 'code'].filter((m) => m !== mode).map((m) => (
          <MenuRow
            key={m}
            icon={<ModeIcon mode={m} size={18} color={th.colors.mutedLight} />}
            label={t(`account.how.${m}`)}
            badge={m === 'code' ? null : t('sync.recommended')}
            onPress={() => setSheet({ kind: 'switch', to: m })}
          />
        ))}
      </Section>

      <Section title={t('account.sectionLeave')} style={styles.subSection}>
        <MenuRow icon={<RowIcon>{ROW_ICON.logout}</RowIcon>} label={t('account.leave')} onPress={confirmLeave} />
        {deleteRow}
      </Section>
    </>
  );

  const planBlock = !isPro ? (
    <View style={[styles.card, styles.cardPlan]}>
      <View style={styles.planTop}>
        <Text style={styles.planName}>FREE</Text>
        <Text style={styles.planKindFree}>{t('account.freeNoExpiry')}</Text>
      </View>
      <View style={styles.meters}>
        <Meter label={t('account.meter.clients')}   n={clientList.length}                         max={FREE.clients} />
        <Meter label={t('account.meter.connected')} n={clientList.filter(isConnected).length}     max={FREE.connected} />
        <Meter label={t('account.meter.programs')}  n={counts.programTemplates}                   max={FREE.programTemplates} />
        <Meter label={t('account.meter.sessions')}  n={counts.sessionTemplates}                   max={FREE.sessionTemplates} />
      </View>
      <View style={styles.acts}>
        <Btn grow tone="acc" label={t('account.goPro')} onPress={() => setShowPaywall(true)} />
      </View>
      <Pressable style={styles.link} onPress={() => useStore.getState().restorePurchases()} hitSlop={8}>
        <Text style={styles.linkText}>{t('account.restore')}</Text>
      </Pressable>
    </View>
  ) : (
    <>
      <GradientCard style={[styles.card, styles.cardPlan, styles.cardPro]}>
        <View style={styles.planTop}>
          <Text style={[styles.planName, styles.onAccent]}>PRO</Text>
          {!!proKind && <Text style={[styles.planKindPro, styles.onAccent]}>{proKind}</Text>}
        </View>
        <View style={styles.badge}>
          <Text style={[styles.badgeText, styles.onAccent]}>
            {t(hasAccount ? 'account.savedInAccount' : 'account.savedInStore', { store: storeName })}
          </Text>
        </View>
        {!hasAccount && (
          <Explain tone="onAccent">
            {t('account.otherPlatformWhy', { other: storeName === 'Google Play' ? 'iPhone' : 'Android' })}
          </Explain>
        )}
        {hasAccount && proDetails?.kind === 'annual' && !!proDetails.managementURL && (
          <View style={styles.acts}>
            <Btn grow tone="dark" label={t('account.manage', { store: storeName })} onPress={() => Linking.openURL(proDetails.managementURL)} />
          </View>
        )}
      </GradientCard>
      <Pressable style={styles.link} onPress={() => useStore.getState().restorePurchases()} hitSlop={8}>
        <Text style={styles.linkText}>{t('account.restore')}</Text>
      </Pressable>
    </>
  );

  // ── Contenido de la hoja ────────────────────────────────────────────────────

  let sheetBody = null;
  if (sheet?.kind === 'switch') {
    const to = sheet.to;
    sheetBody = (
      <>
        <Text style={styles.sheetTitle}>{t(USE_KEY[to])}</Text>
        <Explain>
          {to === 'code' ? t('account.switchCodeWhy') : t('account.switchSocialWhy', { how: t(`account.short.${to}`) })}
        </Explain>
        {to === 'google' && acct.isExpoGo && <Explain>{t('sync.onlyInstalled')}</Explain>}
        <View style={styles.actsCol}>
          {/* Google y Apple confirman con su propio botón, el mismo que en la hoja de entrada. */}
          {to === 'apple' && <AppleSignInButton onPress={() => doSwitch('apple')} disabled={acct.loading} />}
          {to === 'google' && (
            <GoogleSignInButton onPress={() => doSwitch('google')} busy={acct.loading} disabled={acct.isExpoGo} />
          )}
          {to === 'code' && (
            <Btn tone="acc" label={t('account.createCodeCta')} loading={acct.loading} onPress={() => doSwitch('code')} />
          )}
          <Btn tone="ghost" label={t('common.cancel')} disabled={acct.loading} onPress={() => setSheet(null)} />
        </View>
      </>
    );
  } else if (sheet?.kind === 'reveal') {
    sheetBody = (
      <>
        <Text style={styles.sheetTitle}>{t('sync.revealTitle')}</Text>
        <CodeReveal code={sheet.code} onDone={() => setSheet(null)} />
      </>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <ScreenHeader onBack={() => navigation.goBack()} eyebrow={t('account.eyebrow')} title={t('account.title')} />

      <EnterClock.Provider value={enterClock}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Rise index={0}>
            <Text style={styles.sec}>{t('account.sectionTrainer')}</Text>
            {trainerBlock}
          </Rise>
          <Rise index={1}>
            <Text style={[styles.sec, styles.secNext]}>{t('account.sectionPlan')}</Text>
            {planBlock}
          </Rise>
        </ScrollView>
      </EnterClock.Provider>

      <DragSheet visible={!!sheet} onClose={() => setSheet(null)}>
        <View style={styles.sheetBody}>{sheetBody}</View>
      </DragSheet>

      <TrainerSyncModal
        visible={!!syncModal}
        initialScreen={syncModal ?? 'select'}
        onClose={() => setSyncModal(null)}
        isFirstTime={false}
      />
      <DeleteAccountModal visible={showDelete} onClose={() => setShowDelete(false)} />
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },
  content:   { paddingTop: spacing.xxl, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // Título de bloque (`.sec`)
  sec:     { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase', marginBottom: spacing.md },
  secNext: { marginTop: spacing.xxl },

  // Tarjeta (`.card`)
  // El radio del resto de la app (`md`); solo el plan lleva el grande, para distinguirse.
  card:     { backgroundColor: th.colors.surface, borderRadius: th.radius.md, padding: spacing.lg, overflow: 'hidden' },
  cardPlan: { borderRadius: th.radius.lg },
  cardPro:  { backgroundColor: 'transparent' },
  howRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  how:     { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase' },
  have:    { marginTop: spacing.sm2 },
  haveMail: { ...textStyles.heading, color: th.colors.text },
  // El código a 18 (`heading`), como el `codeTextSm` de antes: cabe en una línea con el botón de copiar.
  haveCode: { ...textStyles.code, fontSize: textStyles.heading.fontSize, color: th.colors.accent, flexShrink: 1, marginTop: 0 },
  haveRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm2 },
  iconBtn: {
    width: 40, height: 40, borderRadius: th.radius.md, backgroundColor: th.colors.surface2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconBtnDone: { backgroundColor: th.tint.accent10 },

  // Filas de botones (`Btn`, `Explain`: components/ui/CardKit)
  acts:    { flexDirection: 'row', gap: spacing.sm2, marginTop: spacing.lg },
  actsCol: { gap: spacing.sm2, marginTop: spacing.lg },

  // Nombre para los clientes: tarjeta con un hueco más oscuro (`bg`) y con
  // borde, para que se vea a la primera que ahí se escribe.
  nameCard: {
    backgroundColor: th.colors.surface, borderRadius: th.radius.md,
    padding: spacing.lg, marginTop: spacing.sm2, gap: spacing.sm2,
  },
  inputKey: { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase' },
  inputBox: {
    ...textStyles.itemTitleQuiet,
    color:             th.colors.text,
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.md,
    borderWidth:       1,
    borderColor:       th.colors.surface3,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
  },
  inputFocus: { borderColor: th.colors.accent },

  // Secciones de acciones (`Section` de MenuList) dentro del bloque de la cuenta.
  subSection: { marginTop: spacing.xl, marginBottom: 0 },

  // Plan
  planTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  planName:     { ...textStyles.heroName, color: th.colors.text, textTransform: 'uppercase' },
  planKindFree: { ...textStyles.label, color: th.colors.mutedLight, textAlign: 'right' },
  planKindPro:  { ...textStyles.labelStrong, textAlign: 'right', flexShrink: 1, marginLeft: spacing.md },
  onAccent:     { color: th.colors.onAccent },
  meters:       { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.md, marginTop: spacing.lg },
  meter:        { flexGrow: 1, flexBasis: '40%' },
  meterLbl:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterKey:     { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase', flexShrink: 1 },
  meterVal:     { ...textStyles.labelStrong, color: th.colors.text },
  meterBars:    { flexDirection: 'row', gap: spacing.xs2, marginTop: spacing.sm },
  meterBar:     { flex: 1, height: 6, borderRadius: 3, backgroundColor: th.colors.surface3 },
  meterBarOn:   { backgroundColor: th.colors.accent },
  badge: {
    alignSelf: 'flex-start', padding: spacing.sm, borderRadius: th.radius.xs, marginTop: spacing.md,
    backgroundColor: withOpacity(th.colors.onAccent, 0.14),
  },
  badgeText: { ...textStyles.labelStrong },
  link:     { alignSelf: 'center', marginTop: spacing.lg },
  linkText: { ...textStyles.button, color: th.colors.accent },

  // Hojas (`.sheet`)
  sheetBody:  { paddingBottom: spacing.md },
  sheetTitle: { ...textStyles.title, color: th.colors.text, marginBottom: spacing.lg },
});
