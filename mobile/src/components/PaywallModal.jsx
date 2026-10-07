/**
 * PaywallModal.jsx — la pantalla de Forma Pro (M01-06, docs/specs/M01-monetizacion.md §5.7).
 *
 * Pantalla completa y no hoja: con ventajas, dos planes, el botón y lo que piden
 * las tiendas, en una hoja al 85 % no cabía. Arriba, en negro, la marca, el
 * titular y las ventajas (se desplazan si el móvil es bajo); abajo, fijo, el
 * panel lima con los planes, el botón, la línea de renovación y los enlaces.
 *
 * Sigue siendo un `Modal` para que las tres entradas no cambien: el paywall
 * global de `RootNavigator`, el menú de AppHeader y, tras comprar sin cuenta,
 * «Guarda tu compra» (`TrainerSyncModal purpose="purchase"`, M01 §3.5).
 *
 * Fetches the current RevenueCat offering; en Expo Go no hay paquetes y sale
 * «Forma Pro próximamente».
 */

import { useState, useEffect, Children } from 'react';
import { View, Pressable, ScrollView, StyleSheet, ActivityIndicator, Linking, Platform, Modal } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line, Defs, ClipPath, LinearGradient, Stop, Rect } from 'react-native-svg';
import Reanimated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps, withTiming, Easing, interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Text, MAX_FONT_SCALE } from './ui/Text';
import { useStore } from '../../store/useStore';
import { spacing, textStyles, lh, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { showDialog } from './ui/dialog';
import { CheckIcon, CloseIcon } from './ui/EditorIcons';
import { RowIcon } from './ui/MenuList';
import { ROW_ICON } from './ui/rowIcons';
import FitLogo from './ui/FitLogo';
import TrainerSyncModal from './TrainerSyncModal';
import { TERMS_URL, PRIVACY_URL } from '../config/legal';

// ── Contenido ─────────────────────────────────────────────────────────────────

// Lo que Pro añade al plan gratis (M01 §4.1). La conexión, primero: es lo que
// tiene que entenderse.
const PRO_FEATURES = [
  { icon: ROW_ICON.phone,     key: 'connected' },
  { icon: ROW_ICON.users,     key: 'clients' },
  { icon: ROW_ICON.templates, key: 'templates' },
];

// Anual primero y preseleccionada: el pago único es la opción de quien ya está
// convencido (M01 §5). Lo que no sea ninguno de los dos va detrás.
const ORDER = { ANNUAL: 0, LIFETIME: 1 };
const byPlan = (a, b) => (ORDER[a.packageType] ?? 9) - (ORDER[b.packageType] ?? 9);

/** El texto de cada plan sale de su tipo, no del título de la tienda (que en
 *  Play trae el nombre de la app y «(unreviewed)» pegados). */
const planKey = (pkg) => (pkg?.packageType === 'ANNUAL' ? 'annual' : 'lifetime');

/** «Todos tus clientes *sincronizados*»: lo que va entre asteriscos, en lima. */
function Marked({ text, style, accentStyle }) {
  return (
    <Text style={style}>
      {/* El estilo del padre también: nuestro `Text` le pone Inter a un estilo
          sin familia, y el lima saldría en otra fuente que el resto. */}
      {text.split('*').map((part, i) => (i % 2 ? <Text key={i} style={[style, accentStyle]}>{part}</Text> : part))}
    </Text>
  );
}

// ── Geometría ─────────────────────────────────────────────────────────────────

const PANEL_RADIUS  = 40;  // el panel lima, como la referencia del usuario (no hay token tan grande)
const PANEL_OVERLAP = 20;  // el panel se monta sobre el final del scroll: sus esquinas dejan ver el negro
const TICKET_R  = 16;      // esquinas de la entrada
const NOTCH     = 8;       // radio de las muescas de los lados
const RADIO     = 22;
const RADIO_X   = spacing.lg + RADIO / 2;   // de aquí sale el relleno
const FILL_MS   = 450;     // como el relleno de Inicio por pestañas (U13-02)
const MIN_MS    = 120;

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

/** Rectángulo redondeado con una muesca a cada lado, a media altura. */
function ticketPath(w, h) {
  const r = TICKET_R, n = NOTCH, m = h / 2;
  return `M${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V${m - n} A${n} ${n} 0 0 0 ${w} ${m + n}`
    + ` V${h - r} A${r} ${r} 0 0 1 ${w - r} ${h} H${r} A${r} ${r} 0 0 1 0 ${h - r}`
    + ` V${m + n} A${n} ${n} 0 0 0 0 ${m - n} V${r} A${r} ${r} 0 0 1 ${r} 0 Z`;
}

/** Color que pasa de `a` (sin elegir) a `b` (elegida) con el relleno. */
function useInk(p, a, b, prop = 'color') {
  return useAnimatedStyle(() => ({ [prop]: interpolateColor(p.get(), [0, 1], [a, b]) }));
}

/**
 * Una entrada (un plan). Elegida, el negro de la app sale del botón de
 * selección y se extiende hasta cubrirla, como el color de una pestaña en
 * Inicio (U13-02); al dejar de estarlo, se recoge hacia él. Cada entrada lleva
 * su propio avance, así que ir y volver deprisa sigue desde donde iba y nunca
 * reinicia. El texto cambia de color al mismo paso.
 */
function PlanTicket({ id, selected, onPress, name, tag, sub, price, per }) {
  const th     = useTheme();
  const C      = th.colors;
  const styles = useThemedStyles(makeStyles);
  const [size, setSize] = useState(null);
  const p = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const to = selected ? 1 : 0;
    p.set(withTiming(to, {
      duration: Math.max(MIN_MS, FILL_MS * Math.abs(to - p.get())),
      easing:   Easing.out(Easing.cubic),
    }));
  }, [selected, p]);

  const R = size ? Math.hypot(Math.max(RADIO_X, size.w - RADIO_X), size.h / 2) : 0;
  const circleProps = useAnimatedProps(() => ({ r: p.get() * R }), [R]);

  const nameInk  = useInk(p, C.onAccent, C.text);
  const subInk   = useInk(p, withOpacity(C.onAccent, 0.68), C.mutedLight);
  const priceInk = useInk(p, C.onAccent, C.accent);
  const chipBg   = useInk(p, C.onAccent, C.accent, 'backgroundColor');
  const chipInk  = useInk(p, C.accent, C.onAccent);
  const on       = useAnimatedStyle(() => ({ opacity: p.get() }));
  const off      = useAnimatedStyle(() => ({ opacity: 1 - p.get() }));

  return (
    <Pressable
      onPress={onPress}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={styles.ticket}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[name, tag, sub, price, per].filter(Boolean).join(', ')}
    >
      {size && (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <ClipPath id={id}><Path d={ticketPath(size.w, size.h)} /></ClipPath>
          </Defs>
          <Path d={ticketPath(size.w, size.h)} fill={withOpacity(C.onAccent, 0.1)} />
          <AnimatedCircle cx={RADIO_X} cy={size.h / 2} fill={C.bg} clipPath={`url(#${id})`} animatedProps={circleProps} />
        </Svg>
      )}

      <View style={styles.radio}>
        <Reanimated.View style={[StyleSheet.absoluteFill, styles.radioRing, off]} />
        <Reanimated.View style={[StyleSheet.absoluteFill, styles.radioDot, on]}>
          <CheckIcon size={14} color={C.onAccent} />
        </Reanimated.View>
      </View>

      <View style={styles.ticketMain}>
        <View style={styles.ticketNameRow}>
          <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.ticketName, nameInk]}>{name}</Reanimated.Text>
          {!!tag && (
            <Reanimated.View style={[styles.chip, chipBg]}>
              <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.chipTxt, chipInk]}>{tag}</Reanimated.Text>
            </Reanimated.View>
          )}
        </View>
        {!!sub && <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.ticketSub, subInk]}>{sub}</Reanimated.Text>}
      </View>

      {/* La matriz con el precio, tras la línea perforada. */}
      <View style={styles.stub}>
        <Reanimated.View style={[styles.perforation, off]} pointerEvents="none">
          <Svg width={2} height="100%"><Line x1={1} y1={0} x2={1} y2="100%" stroke={withOpacity(C.onAccent, 0.35)} strokeWidth={1.5} strokeDasharray="4 4" /></Svg>
        </Reanimated.View>
        <Reanimated.View style={[styles.perforation, on]} pointerEvents="none">
          <Svg width={2} height="100%"><Line x1={1} y1={0} x2={1} y2="100%" stroke={C.border} strokeWidth={1.5} strokeDasharray="4 4" /></Svg>
        </Reanimated.View>
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.price, priceInk]}>{price}</Reanimated.Text>
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.per, subInk]}>{per}</Reanimated.Text>
      </View>
    </Pressable>
  );
}

/**
 * Pinta solo `children[index]` pero ocupa el alto del más alto: la línea de
 * renovación del anual es más larga que la del pago único, y sin esto el panel
 * daba un salto al cambiar de plan. Vale en cualquier idioma porque mide.
 */
function SameHeight({ index, children }) {
  const [heights, setHeights] = useState({});
  const max = Math.max(0, ...Object.values(heights));
  return (
    <View style={{ minHeight: max }}>
      {Children.toArray(children).map((child, i) => (
        <View
          key={i}
          style={[StyleSheet.absoluteFillObject, { bottom: undefined, opacity: i === index ? 1 : 0 }]}
          importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}
          accessibilityElementsHidden={i !== index}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setHeights((o) => (o[i] === h ? o : { ...o, [i]: h }));
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export default function PaywallModal({ onClose }) {
  const getOffering      = useStore((s) => s.getOffering);
  const [offering, setOffering] = useState(null);
  const [loading, setLoading]   = useState(true);
  // Comprado sin cuenta: la pantalla cede el sitio a «Guarda tu compra» (M01 §3.5).
  const [askAccount, setAskAccount] = useState(false);

  useEffect(() => {
    (async () => {
      setOffering(await getOffering());
      setLoading(false);
    })();
  }, [getOffering]);

  if (askAccount) {
    return <TrainerSyncModal visible purpose="purchase" isFirstTime={false} onClose={onClose} />;
  }

  // Borde a borde, como `DragSheet`: el `SafeAreaProvider` de dentro mide los
  // márgenes de ESTA ventana (en Android no son los de la raíz).
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaProvider>
        <PaywallBody
          packages={[...(offering?.availablePackages ?? [])].sort(byPlan)}
          loading={loading}
          onClose={onClose}
          onNeedsAccount={() => setAskAccount(true)}
        />
      </SafeAreaProvider>
    </Modal>
  );
}

function PaywallBody({ packages, loading, onClose, onNeedsAccount }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const C      = th.colors;
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const purchasePackage  = useStore((s) => s.purchasePackage);
  const restorePurchases = useStore((s) => s.restorePurchases);
  const checkProStatus   = useStore((s) => s.checkProStatus);
  const showToast        = useStore((s) => s.showToast);

  const [selected, setSelected]     = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring]   = useState(false);

  const store       = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  const selectedPkg = packages.find((p) => p.identifier === selected) ?? packages[0] ?? null;
  const selIndex    = selectedPkg ? packages.indexOf(selectedPkg) : 0;

  function choose(pkg) {
    if (pkg.identifier === selectedPkg?.identifier) return;
    setSelected(pkg.identifier);
    Haptics.selectionAsync().catch(() => {});
  }

  async function handlePurchase() {
    if (!selectedPkg) return;
    setPurchasing(true);
    try {
      const result = await purchasePackage(selectedPkg);
      if (result.ok) {
        if (!result.isPro) {
          // Purchase went through but entitlement not yet reflected — poll RC
          showToast(t('paywall.processing'), 2200, 'neutral');
          const synced = await checkProStatus().catch(() => false);
          if (!synced) {
            // Last resort: try restore
            await restorePurchases().catch(() => {});
          }
        }
        if (!useStore.getState().trainerSync.userId) onNeedsAccount();
        else onClose();
      } else if (!result.cancelled) {
        showDialog(t('paywall.errTitle'), result.error ?? t('drive.errBackupBody'));
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const isPro = await restorePurchases();
      if (isPro) onClose();
    } finally {
      setRestoring(false);
    }
  }

  // Lo que dice cada entrada. El mensual sale de la tienda (`pricePerMonthString`).
  const ticketCopy = (pkg) => {
    const k = planKey(pkg);
    const monthly = pkg.product.pricePerMonthString;
    return {
      name:  t(`paywall.plan.${k}`),
      tag:   k === 'annual' ? t('paywall.plan.recommended') : null,
      sub:   k === 'annual' ? (monthly ? t('paywall.plan.annualMonthly', { price: monthly }) : null) : t('paywall.plan.lifetimeSub'),
      price: pkg.product.priceString,
      per:   t(`paywall.plan.${k}Per`),
    };
  };

  return (
    <View style={styles.screen}>
      {/* ── Arriba: marca, titular y ventajas ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.sm2 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.topRow}>
          <View style={styles.logo} accessible accessibilityLabel="Forma Fit Pro">
            <Text style={styles.forma}>Forma</Text>
            <FitLogo height={14} />
            <View style={styles.proPill}><Text style={styles.proTxt}>PRO</Text></View>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <CloseIcon size={16} color={C.text} />
          </Pressable>
        </View>

        <Marked text={t('paywall.headline')} style={styles.headline} accentStyle={styles.accent} />
        <Text style={styles.tagline}>{t('paywall.tagline')}</Text>
        {/* La barra de progreso de la app, como separador. */}
        <View style={styles.bar}>
          <View style={[styles.barSeg, { flex: 3, backgroundColor: th.tint.accent50 }]} />
          <View style={[styles.barSeg, { flex: 4, backgroundColor: C.accent }]} />
          <View style={[styles.barSeg, { flex: 3, backgroundColor: C.border }]} />
        </View>

        <View style={styles.features}>
          {PRO_FEATURES.map((f) => (
            <View key={f.key} style={styles.featRow}>
              <View style={styles.featIcon}><RowIcon color={C.accent} size={18} strokeWidth={2}>{f.icon}</RowIcon></View>
              <View style={styles.featText}>
                <Marked text={t(`paywall.features.${f.key}.title`)} style={styles.featTitle} accentStyle={styles.accent} />
                <Text style={styles.featDesc}>{t(`paywall.features.${f.key}.desc`)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Abajo, fijo: planes, botón y lo que piden las tiendas ── */}
      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="paywallPanel" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.accent} />
              <Stop offset="1" stopColor={C.green} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#paywallPanel)" />
        </Svg>

        <Text style={styles.panelTitle}>{t('paywall.payTitle')}</Text>

        {loading ? (
          <ActivityIndicator color={C.onAccent} style={styles.panelState} />
        ) : packages.length === 0 ? (
          <Text style={[styles.legal, styles.panelState]}>{t('paywall.comingSoon')}</Text>
        ) : (
          <>
            <View style={styles.tickets} accessibilityRole="radiogroup">
              {packages.map((pkg, i) => (
                <PlanTicket
                  key={pkg.identifier}
                  id={`paywallTicket${i}`}
                  selected={pkg.identifier === selectedPkg?.identifier}
                  onPress={() => choose(pkg)}
                  {...ticketCopy(pkg)}
                />
              ))}
            </View>

            <Pressable
              style={[styles.cta, purchasing && { opacity: 0.6 }]}
              onPress={handlePurchase}
              disabled={purchasing}
              accessibilityRole="button"
            >
              {purchasing
                ? <ActivityIndicator size="small" color={C.accent} />
                : <Text style={styles.ctaTxt} numberOfLines={1}>
                    {t(`paywall.plan.${planKey(selectedPkg)}Cta`, { price: selectedPkg.product.priceString })}
                  </Text>}
            </Pressable>

            {/* Apple 3.1.2 y Play: precio, periodo, que se renueva y cómo
                cancelar, junto al botón. */}
            <View style={styles.legalBox}>
              <SameHeight index={selIndex}>
                {packages.map((pkg) => (
                  <Text key={pkg.identifier} style={styles.legal}>
                    {t(`paywall.plan.${planKey(pkg)}Legal`, { price: pkg.product.priceString, store })}
                  </Text>
                ))}
              </SameHeight>
            </View>
          </>
        )}

        <View style={styles.links}>
          <Pressable onPress={handleRestore} disabled={restoring} hitSlop={8} accessibilityRole="button">
            {restoring
              ? <ActivityIndicator size="small" color={C.onAccent} />
              : <Text style={styles.link}>{t('paywall.restore')}</Text>}
          </Pressable>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8} accessibilityRole="link">
            <Text style={styles.link}>{t('paywall.terms')}</Text>
          </Pressable>
          {/* ponytail: sin URL publicada no sale; ver config/legal.js. */}
          {PRIVACY_URL && (
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8} accessibilityRole="link">
              <Text style={styles.link}>{t('paywall.privacy')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: th.colors.bg },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.xxl + PANEL_OVERLAP,
  },

  // Marca
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo:   { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // El logotipo, igual que en la cabecera de la app (AppHeader `appNameForma`).
  forma: {
    fontFamily:    'Inter_900Black_Italic',
    fontSize:      19,
    color:         th.colors.text,
    letterSpacing: -1.14,
  },
  proPill: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    marginLeft:        spacing.sm,
  },
  proTxt: { ...textStyles.caps, color: th.colors.onAccent },
  closeBtn: {
    width:           32,
    height:          32,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Titular
  headline: {
    ...textStyles.heroGlyph,
    color:              th.colors.text,
    lineHeight:         36,
    includeFontPadding: false,
    marginTop:          spacing.xl,
  },
  accent:  { color: th.colors.accent },
  tagline: { ...textStyles.caps, color: th.colors.mutedLight, marginTop: spacing.md },
  bar:     { flexDirection: 'row', width: '60%', height: 4, gap: 3, marginTop: spacing.md },
  barSeg:  { borderRadius: 2 },

  // Ventajas
  features:  { gap: spacing.lg, marginTop: spacing.xl },
  featRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  featIcon: {
    width:           32,
    height:          32,
    borderRadius:    th.radius.md,
    backgroundColor: th.tint.accent10,
    alignItems:      'center',
    justifyContent:  'center',
  },
  featText:  { flex: 1 },
  featTitle: { ...textStyles.itemTitleQuiet, color: th.colors.text },
  featDesc:  { ...textStyles.body, color: th.colors.mutedLight, lineHeight: lh(14), marginTop: spacing.xs },

  // Panel lima
  panel: {
    marginTop:            -PANEL_OVERLAP,
    borderTopLeftRadius:  PANEL_RADIUS,
    borderTopRightRadius: PANEL_RADIUS,
    overflow:             'hidden',
    paddingHorizontal:    spacing.lg,
    paddingTop:           spacing.xl,
  },
  panelTitle: {
    ...textStyles.heroName,
    color:         th.colors.onAccent,
    textTransform: 'uppercase',
    textAlign:     'center',
    marginBottom:  spacing.md,
  },
  panelState: { marginVertical: spacing.xl },
  tickets:    { gap: spacing.sm2 },

  // Entrada
  ticket: {
    flexDirection: 'row',
    alignItems:    'stretch',
    gap:           spacing.md,
    paddingLeft:   spacing.lg,
    minHeight:     74,
  },
  radio:     { width: RADIO, height: RADIO, alignSelf: 'center' },
  radioRing: { borderRadius: RADIO / 2, borderWidth: 2, borderColor: th.colors.onAccent },
  radioDot: {
    borderRadius:    RADIO / 2,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  ticketMain:    { flex: 1, minWidth: 0, justifyContent: 'center', paddingVertical: spacing.lg },
  ticketNameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  ticketName:    { ...textStyles.itemTitleQuiet },
  chip: {
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
  },
  chipTxt:   { ...textStyles.caps },
  ticketSub: { ...textStyles.labelStrong, marginTop: spacing.xs },
  stub: {
    justifyContent: 'center',
    alignItems:     'flex-end',
    marginVertical: spacing.md,
    paddingLeft:    spacing.lg,
    paddingRight:   spacing.lg,
  },
  perforation: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2 },
  price: { ...textStyles.heroGlyph, lineHeight: 36, includeFontPadding: false },
  per:   { ...textStyles.labelStrong },

  // Botón y pie
  cta: {
    backgroundColor: th.colors.onAccent,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.lg,
    alignItems:      'center',
    marginTop:       spacing.lg,
  },
  ctaTxt:   { ...textStyles.button, color: th.colors.accent },
  legalBox: { marginTop: spacing.md },
  legal: {
    ...textStyles.label,
    color:      withOpacity(th.colors.onAccent, 0.75),
    textAlign:  'center',
    lineHeight: lh(12),
  },
  links: {
    flexDirection:  'row',
    justifyContent: 'center',
    flexWrap:       'wrap',
    gap:            spacing.lg,
    marginTop:      spacing.sm2,
  },
  link: { ...textStyles.labelStrong, color: th.colors.onAccent, textDecorationLine: 'underline' },
});
