/**
 * Las pantallas del tramo común del recorrido de entrada (O03-01, spec §5, §6, §11.5):
 * bienvenida (con el idioma), unidades, tema, bifurcación «¿Cómo entrenas?» y el
 * «Listo» genérico. Cada una es un componente que `OnboardingFlowScreen` pinta por
 * su id; reciben `goTo(id)`, que navega o, si el id aún no tiene pantalla, hace la
 * salida provisional a lo de hoy (ver `OnboardingFlowScreen`).
 *
 * Maqueta: docs/mockups/onboarding-2.html (welcome, units, theme, role, done).
 */
import { useEffect, useState } from 'react';
import { View, Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import logoImg from '../../../../assets/adaptive-icon.png';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, Easing, useReducedMotion, runOnJS } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import { THEMES } from '../../../themes';
import { spacing, textStyles, withOpacity } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { Text, MAX_FONT_SCALE } from '../../../components/ui/Text';
import Marked from '../../../components/ui/Marked';
import FitLogo from '../../../components/ui/FitLogo';
import { Rise } from '../../../components/ui/Rise';
import { CheckIcon } from '../../../components/ui/EditorIcons';
import {
  FlowBody, FlowTitle, FlowTile, FlowRow, FlowFooter, FlowPanel, PanelButton, FlowNote,
} from '../../../components/onboarding/flow';
import { ROLE_START, afterSettings, deviceLanguage } from '../../../utils/onboardingFlow';

/** El idioma del móvil. Hermes trae `Intl`; si algún día no, español. */
function deviceLocale() {
  try { return Intl.DateTimeFormat().resolvedOptions().locale; } catch { return 'es'; }
}

// Constantes y no `{}`/`[]` en el selector: zustand 5 vuelve a pintar sin fin si el selector devuelve un objeto nuevo cada vez.
const NONE = {};
const NO_ITEMS = [];
const answersOf = (s) => s.onboardingFlow?.answers ?? NONE;

// ── Bienvenida (§5.1-5.2) ─────────────────────────────────────────────────────

const SHEET_RADIUS = 40;     // el de FlowPanel y el paywall: no hay token tan grande
const SHEET_IN_MS  = 450;    // la hoja sube a su sitio
const SHEET_OUT_MS = 420;    // la hoja crece hasta tapar el lima
const LOGO_SIZE    = 180;
const SHEET_SHARE  = 0.46;   // la hoja ocupa al menos esta parte de la pantalla

function Welcome({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const insets  = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const language    = useStore((s) => s.profile.language ?? 'es');
  const setLanguage = useStore((s) => s.setLanguage);
  const flowAnswer  = useStore((s) => s.flowAnswer);
  const langTouched = useStore((s) => !!answersOf(s).langTouched);
  const viaInvite   = useStore((s) => !!answersOf(s).viaInvite);
  const pending     = useStore((s) => s.pendingInviteCode);
  const validate    = useStore((s) => s.validateClientCode);
  const [trainerName, setTrainerName] = useState(null);
  const { height: winH } = useWindowDimensions();
  const [leaving, setLeaving] = useState(false);
  const [sheetH, setSheetH]   = useState(0);         // alto de la hoja en reposo, medido
  const boxH = useSharedValue(winH);                 // alto de la pantalla, medido
  const rest = useSharedValue(0);                    // lo mismo que `sheetH`, para la animación
  const rise = useSharedValue(reduced ? 0 : 1);      // 1 = hoja fuera por abajo, 0 = en su sitio
  const grow = useSharedValue(0);                    // 0 = hoja en reposo, 1 = tapa toda la pantalla

  useEffect(() => {
    if (!reduced) rise.set(withTiming(0, { duration: SHEET_IN_MS, easing: Easing.out(Easing.cubic) }));
  }, [reduced, rise]);

  // Viene marcado el idioma del móvil, la primera vez que se pinta y si el usuario no lo ha tocado.
  useEffect(() => {
    if (langTouched) return;
    const lang = deviceLanguage(deviceLocale());
    if (lang !== useStore.getState().profile.language) setLanguage(lang);
  }, [langTouched, setLanguage]);

  // El nombre del entrenador que invita, si el hueco ya tiene programa; si no, la línea genérica.
  useEffect(() => {
    if (!pending) return undefined;
    let alive = true;
    validate(pending)
      .then((info) => { if (alive && info.trainerName) setTrainerName(info.trainerName.replace(/\*/g, '')); })
      .catch(() => {});
    return () => { alive = false; };
  }, [pending, validate]);

  function chooseLanguage(lang) {
    flowAnswer({ langTouched: true });
    setLanguage(lang);
  }

  // La hoja sube hasta tapar el lima y entonces se pasa a la siguiente pantalla, que tiene su mismo fondo.
  function leave(id) {
    if (leaving) return;
    setLeaving(true);
    if (reduced) { goTo(id); return; }
    grow.set(withTiming(1, { duration: SHEET_OUT_MS, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(goTo)(id);
    }));
  }

  // La hoja va encima del lima (absoluta): al crecer lo tapa sin empujar el logo, y llega hasta arriba del todo.
  const sheetAnim = useAnimatedStyle(() => ({
    top:                  rest.get() ? (boxH.get() - rest.get()) * (1 - grow.get()) : boxH.get(),
    borderTopLeftRadius:  SHEET_RADIUS * (1 - grow.get()),
    borderTopRightRadius: SHEET_RADIUS * (1 - grow.get()),
    transform:            [{ translateY: rise.get() * rest.get() }],
  }));
  const fadeAnim = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, grow.get() * 2) }));

  return (
    <View style={styles.lime} onLayout={(e) => boxH.set(e.nativeEvent.layout.height)}>
      {/* Sobre el lima, la barra de estado va en oscuro. */}
      <StatusBar style="dark" />
      {/* El logo, centrado en el lima que deja la hoja. */}
      <View style={[styles.logoBox, { paddingTop: insets.top, bottom: sheetH }]}>
        <Image source={logoImg} style={styles.logo} accessibilityIgnoresInvertColors />
        <View style={styles.brand} accessible accessibilityLabel="Forma Fit">
          <Text style={styles.forma}>Forma</Text>
          <FitLogo height={24} color={styles.forma.color} />
        </View>
      </View>
      <View
        style={[styles.langsw, { top: insets.top + spacing.md }]}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('onboardingFlow.common.welcome.language')}
      >
        {['es', 'en'].map((lang) => (
          <Pressable
            key={lang}
            onPress={() => chooseLanguage(lang)}
            accessibilityRole="radio"
            accessibilityState={{ checked: language === lang }}
            style={[styles.lang, language === lang && styles.langOn]}
          >
            <Text style={[styles.langTxt, language === lang && styles.langTxtOn]}>{lang.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <Reanimated.View style={[styles.sheet, sheetAnim]}>
        <Reanimated.View
          style={[styles.sheetIn, { minHeight: Math.round(winH * SHEET_SHARE) }, fadeAnim]}
          pointerEvents={leaving ? 'none' : 'auto'}
          onLayout={(e) => { const h = e.nativeEvent.layout.height; setSheetH(h); rest.set(h); }}
        >
          <View style={styles.sheetBody}>
            <Marked text={t('onboardingFlow.common.welcome.hero')} style={styles.hero} accentStyle={styles.accent} />
            <Text style={styles.tagline}>{t('onboardingFlow.common.welcome.tagline')}</Text>
            {viaInvite && (
              <FlowNote
                tone="blue"
                text={trainerName
                  ? t('onboardingFlow.common.welcome.invited', { trainer: trainerName })
                  : t('onboardingFlow.common.welcome.invitedAnon')}
              />
            )}
          </View>
          <FlowFooter
            primary={{ label: t('onboardingFlow.common.welcome.start'), onPress: () => leave('units') }}
            secondary={[{ label: t('onboardingFlow.common.welcome.haveAccount'), onPress: () => leave('recover') }]}
          />
        </Reanimated.View>
      </Reanimated.View>
    </View>
  );
}

// ── Unidades (§5.3) ───────────────────────────────────────────────────────────

function Units({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const unit       = useStore((s) => s.profile.weightUnit ?? 'kg');
  const setProfile = useStore((s) => s.setProfile);
  return (
    <FlowBody footer={<FlowFooter primary={{ label: t('onboardingFlow.common.next'), onPress: () => goTo('theme') }} />}>
      <FlowTitle text={t('onboardingFlow.common.units.title')} sub={t('onboardingFlow.common.units.sub')} />
      <View style={styles.tiles}>
        {['kg', 'lb'].map((u, i) => (
          <FlowTile
            key={u}
            big={u.toUpperCase()}
            index={2 + i}
            selected={unit === u}
            onPress={() => setProfile({ weightUnit: u })}
          />
        ))}
      </View>
    </FlowBody>
  );
}

// ── Tema (§5.4) ───────────────────────────────────────────────────────────────

// Forma Fit primero; el resto, claro y oscuro intercalados (hay 2 claros: earthy y space).
const THEME_ORDER = ['formaFit', 'earthy', 'dark', 'space', 'steel', 'midnight'];

/** Una muestra: el fondo, la superficie y el acento del tema, con su nombre. La elegida se eleva. */
function Swatch({ id, active, onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const T      = THEMES[id];
  const lift   = useSharedValue(active ? -3 : 0);
  useEffect(() => {
    lift.set(withTiming(active ? -3 : 0, { duration: 200, easing: Easing.out(Easing.cubic) }));
  }, [active, lift]);
  const up = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));
  return (
    <Reanimated.View style={[styles.swatchCell, up]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ checked: active }}
        accessibilityLabel={T.name}
        style={[styles.swatch, { backgroundColor: T.colors.bg, borderColor: active ? th.colors.text : 'transparent' }]}
      >
        <View style={[styles.swatchBar, { backgroundColor: T.colors.surface }]} />
        <View style={[styles.swatchBar, { width: '60%', backgroundColor: T.colors.accent }]} />
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={[styles.swatchName, { color: T.colors.text }]}>
          {T.name}
        </Reanimated.Text>
      </Pressable>
    </Reanimated.View>
  );
}

function Theme({ goTo }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const setTheme = useStore((s) => s.setTheme);
  const answers  = useStore(answersOf);
  return (
    <FlowBody footer={<FlowFooter primary={{ label: t('onboardingFlow.common.next'), onPress: () => goTo(afterSettings(answers)) }} />}>
      <FlowTitle text={t('onboardingFlow.common.theme.title')} sub={t('onboardingFlow.common.theme.sub')} />
      <Rise index={2}>
        <View style={styles.swatches} accessibilityRole="radiogroup">
          {THEME_ORDER.map((id) => <Swatch key={id} id={id} active={th.id === id} onPress={() => setTheme(id)} />)}
        </View>
      </Rise>
      <Rise index={3}>
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>{t('onboardingFlow.common.theme.previewTitle')}</Text>
          <Text style={styles.previewMeta}>{t('onboardingFlow.common.theme.previewMeta')}</Text>
          <View style={styles.previewPill}><Text style={styles.previewPillTxt}>{t('onboardingFlow.common.theme.previewCta')}</Text></View>
        </View>
      </Rise>
    </FlowBody>
  );
}

// ── Bifurcación (§6) ──────────────────────────────────────────────────────────

// Cada camino lleva su color y su icono (O04-02).
const ROLES = [['self', 'accent', 'self'], ['coached', 'blue', 'coached'], ['trainer', 'orange', 'trainer']];

function Role({ goTo }) {
  const { t } = useTranslation();
  const C          = useTheme().colors;
  const styles     = useThemedStyles(makeStyles);
  const role       = useStore((s) => answersOf(s).role);
  const flowAnswer = useStore((s) => s.flowAnswer);
  const setProfile = useStore((s) => s.setProfile);
  return (
    <FlowBody footer={<FlowFooter primary={{ label: t('onboardingFlow.common.continue'), disabled: !role, onPress: () => goTo(ROLE_START[role]) }} />}>
      <FlowTitle text={t('onboardingFlow.common.role.title')} sub={t('onboardingFlow.common.role.sub')} />
      <View style={styles.opts}>
        {ROLES.map(([r, color, icon], i) => (
          <FlowRow
            key={r}
            index={2 + i}
            title={t(`onboardingFlow.common.role.${r}`)}
            desc={t(`onboardingFlow.common.role.${r}Desc`)}
            color={C[color]}
            icon={icon}
            selected={role === r}
            // El rol decide las pestañas: solo el entrenador ve las de entrenador.
            onPress={() => { flowAnswer({ role: r }); setProfile({ role: r, proTabsHidden: r !== 'trainer' }); }}
          />
        ))}
      </View>
    </FlowBody>
  );
}

// ── Listo (§11.5) ─────────────────────────────────────────────────────────────

function CheckRow({ ok, label, index }) {
  const styles = useThemedStyles(makeStyles);
  const C = useTheme().colors;
  return (
    <Rise index={index}>
      <View style={styles.check}>
        <View style={[styles.checkDot, ok ? styles.checkOn : styles.checkOff]}>
          {ok && <CheckIcon size={13} color={C.onAccent} />}
        </View>
        <Text style={[styles.checkTxt, !ok && styles.checkTxtOff]}>{label}</Text>
      </View>
    </Rise>
  );
}

function Done() {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const items    = useStore((s) => s.onboardingFlow?.done ?? NO_ITEMS);
  const asClient = useStore((s) => { const a = answersOf(s); return a.role === 'trainer' && a.alsoTrains !== true; });
  const finish   = useStore((s) => s.finishOnboardingFlow);

  const panel = (
    <FlowPanel title={t(asClient ? 'onboardingFlow.done.panelClients' : 'onboardingFlow.done.panelTrain')}>
      <PanelButton label={t('onboardingFlow.done.cta')} onPress={() => finish()} />
    </FlowPanel>
  );

  return (
    <FlowBody footer={panel}>
      <FlowTitle text={t('onboardingFlow.done.title')} sub={t('onboardingFlow.done.sub')} />
      <View style={styles.checks}>
        {items.map((it, i) => <CheckRow key={it.key} ok={it.ok} label={it.label} index={2 + i} />)}
      </View>
    </FlowBody>
  );
}

export default { welcome: Welcome, units: Units, theme: Theme, role: Role, done: Done };

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  // Bienvenida: lima a sangre arriba con el logo, hoja del fondo de la app abajo.
  lime:    { flex: 1, backgroundColor: th.colors.accent },
  logoBox: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  // El PNG del icono trae margen alrededor del monograma: el lockup se acerca con un margen negativo.
  logo:    { width: LOGO_SIZE, height: LOGO_SIZE, marginBottom: -LOGO_SIZE * 0.16 },
  brand:   { flexDirection: 'row', alignItems: 'center', gap: spacing.xs2 },
  // El logotipo de la cabecera de la app (`appNameForma`), en negro sobre el lima.
  forma: {
    fontFamily:    'Inter_900Black_Italic',
    fontSize:      34,
    color:         th.colors.onAccent,
    letterSpacing: -2,
  },
  langsw:    { position: 'absolute', right: spacing.lg + 1, flexDirection: 'row', gap: spacing.xs, padding: 3, borderRadius: th.radius.md, backgroundColor: withOpacity(th.colors.onAccent, 0.12) },
  lang:      { paddingVertical: spacing.sm2 - 1, paddingHorizontal: spacing.md, borderRadius: th.radius.sm + 2 },
  langOn:    { backgroundColor: th.colors.onAccent },
  langTxt:   { ...textStyles.labelStrong, color: withOpacity(th.colors.onAccent, 0.6) },
  langTxtOn: { color: th.colors.accent },
  sheet:     { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: th.colors.bg, borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, overflow: 'hidden', justifyContent: 'flex-end' },
  sheetIn:   { flexShrink: 0 },
  sheetBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg + 1, paddingTop: spacing.xxl, paddingBottom: spacing.sm },
  hero: {
    ...textStyles.heroGlyph,
    color:              th.colors.text,
    lineHeight:         40,
    paddingRight:       2,
    includeFontPadding: false,
    textAlign:          'center',
  },
  accent:  { color: th.colors.accent },
  tagline: { ...textStyles.bodyStrong, color: th.colors.mutedLight, marginTop: spacing.lg, textAlign: 'center' },

  // Unidades y bifurcación
  tiles: { flexDirection: 'row', gap: spacing.md },
  opts:  { gap: spacing.md },

  // Tema
  // Seis temas no caben en una fila sin cortar los nombres: dos filas de tres.
  swatches:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm2, marginBottom: spacing.lg },
  swatchCell:  { flexBasis: '30%', flexGrow: 1 },
  swatch: {
    height:         92,
    borderRadius:   th.radius.lg,
    borderWidth:    2,
    paddingVertical:   spacing.sm2,
    paddingHorizontal: spacing.sm,
    justifyContent: 'flex-end',
    gap:            spacing.xs2,
  },
  swatchBar:  { height: 10, borderRadius: 3 },
  swatchName: { ...textStyles.labelStrong, textAlign: 'center', marginTop: spacing.xs },
  preview: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    padding:         spacing.lg + 1,
  },
  previewTitle:   { ...textStyles.itemTitle, color: th.colors.text },
  previewMeta:    { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.xs2, marginBottom: spacing.md + 2 },
  previewPill:    { alignSelf: 'flex-start', backgroundColor: th.colors.accent, borderRadius: th.radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  previewPillTxt: { ...textStyles.labelStrong, color: th.colors.onAccent, textTransform: 'uppercase' },

  // Listo
  checks: { gap: spacing.sm2 },
  check: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.lg - 3,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.lg,
    paddingVertical:   spacing.lg - 1,
    paddingHorizontal: spacing.lg + 1,
  },
  checkDot:    { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkOn:     { backgroundColor: th.colors.accent },
  checkOff:    { borderWidth: 2, borderColor: th.colors.muted },
  checkTxt:    { ...textStyles.bodyStrong, color: th.colors.text, flex: 1 },
  checkTxtOff: { ...textStyles.body, color: th.colors.mutedLight },
});
