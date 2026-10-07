/**
 * PaywallModal.jsx
 * Shown when a free user tries to access a PRO feature.
 * Fetches the current RevenueCat offering and displays available packages.
 * Falls back gracefully when native module isn't loaded (Expo Go).
 *
 * Es una `DragSheet` (U34): antes montaba su propio Modal con su velo y su
 * asa. Se cierra arrastrando o tocando fuera, como todas las hojas.
 */

import { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Platform } from 'react-native';
import { Text } from './ui/Text';
import { useTranslation } from 'react-i18next';

import { useStore }                                     from '../../store/useStore';
import { spacing, borders, textStyles, lh } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

import { showDialog } from './ui/dialog';
import DragSheet from './DragSheet';
import TrainerSyncModal from './TrainerSyncModal';
import { TERMS_URL, PRIVACY_URL } from '../config/legal';
// ── Feature list ──────────────────────────────────────────────────────────────

// Lo que Pro añade al plan gratis (M01 §4.1): lo demás ya es de todos.
const PRO_FEATURES = [
  { emoji: '👥', key: 'clients' },
  { emoji: '📱', key: 'connected' },
  { emoji: '📐', key: 'templates' },
];

// Anual primero y preseleccionada: el pago único es la opción de quien ya está
// convencido (M01 §5). Lo que no sea ninguno de los dos va detrás.
const ORDER = { ANNUAL: 0, LIFETIME: 1 };
const byPlan = (a, b) => (ORDER[a.packageType] ?? 9) - (ORDER[b.packageType] ?? 9);

/** El texto de cada plan sale de su tipo, no del título de la tienda (que en
 *  Play trae el nombre de la app y «(unreviewed)» pegados). */
const planKey = (pkg) => (pkg?.packageType === 'ANNUAL' ? 'annual' : 'lifetime');

// ── Component ─────────────────────────────────────────────────────────────────

export default function PaywallModal({ onClose, reason = null }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const getOffering      = useStore((s) => s.getOffering);
  const purchasePackage  = useStore((s) => s.purchasePackage);
  const restorePurchases = useStore((s) => s.restorePurchases);
  const checkProStatus   = useStore((s) => s.checkProStatus);
  const showToast        = useStore((s) => s.showToast);

  const [offering, setOffering]       = useState(null);
  const [selected, setSelected]       = useState(null); // selected package key
  const [loading, setLoading]         = useState(true);
  const [purchasing, setPurchasing]   = useState(false);
  const [restoring, setRestoring]     = useState(false);
  // Comprado sin cuenta: la hoja cede el sitio a «Guarda tu compra» (M01 §3.5).
  const [askAccount, setAskAccount]   = useState(false);

  useEffect(() => {
    (async () => {
      const o = await getOffering();
      setOffering(o);
      const first = [...(o?.availablePackages ?? [])].sort(byPlan)[0];
      if (first) setSelected(first.identifier);
      setLoading(false);
    })();
  }, []);

  const packages = [...(offering?.availablePackages ?? [])].sort(byPlan);
  const store    = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  const selectedPkg = packages.find((p) => p.identifier === selected) ?? packages[0] ?? null;

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
        if (!useStore.getState().trainerSync.userId) setAskAccount(true);
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

  if (askAccount) {
    return <TrainerSyncModal visible purpose="purchase" isFirstTime={false} onClose={onClose} />;
  }

  return (
    <DragSheet visible onClose={onClose}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.badge}>PRO</Text>
            <Text style={styles.title}>{t('paywall.title')}</Text>
            <Text style={styles.subtitle}>{t(reason ? `paywall.reason.${reason}` : 'paywall.subtitle')}</Text>
          </View>

          {/* Feature list */}
          <View style={styles.featureList}>
            {PRO_FEATURES.map((f) => (
              <View key={f.key} style={styles.featureRow}>
                <Text style={styles.featureEmoji}>{f.emoji}</Text>
                <Text style={styles.featureTxt}>{t(`paywall.features.${f.key}`)}</Text>
              </View>
            ))}
          </View>

          {/* Packages */}
          {loading ? (
            <ActivityIndicator color={th.colors.accent} style={{ marginVertical: spacing.xl }} />
          ) : packages.length === 0 ? (
            <View style={styles.noProducts}>
              <Text style={styles.noProductsTxt}>{t('paywall.comingSoon')}</Text>
            </View>
          ) : (
            <View style={styles.packageList}>
              {packages.map((pkg) => {
                const isSelected = pkg.identifier === selected;
                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    style={[styles.packageCard, isSelected && styles.packageCardActive]}
                    onPress={() => setSelected(pkg.identifier)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radio, isSelected && styles.radioActive]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pkgTitle, isSelected && styles.pkgTitleActive]}>
                        {t(`paywall.plan.${planKey(pkg)}`)}
                      </Text>
                      <Text style={styles.pkgPrice}>
                        {t(`paywall.plan.${planKey(pkg)}Price`, { price: pkg.product.priceString })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* CTA */}
          {packages.length > 0 && (
            <TouchableOpacity
              style={[styles.ctaBtn, (purchasing || !selectedPkg) && { opacity: 0.6 }]}
              onPress={handlePurchase}
              disabled={purchasing || !selectedPkg}
              activeOpacity={0.85}
            >
              {purchasing
                ? <ActivityIndicator size="small" color={th.colors.bg} />
                : <Text style={styles.ctaTxt}>
                    {selectedPkg
                      ? t(`paywall.plan.${planKey(selectedPkg)}Cta`, { price: selectedPkg.product.priceString })
                      : t('paywall.buy')}
                  </Text>
              }
            </TouchableOpacity>
          )}

          {/* Restore + legal */}
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring
              ? <ActivityIndicator size="small" color={th.colors.muted} />
              : <Text style={styles.restoreTxt}>{t('paywall.restore')}</Text>
            }
          </TouchableOpacity>

          {/* Apple 3.1.2: precio, periodo y renovación a la vista, y los dos
              enlaces. El texto cambia con el plan elegido. */}
          {selectedPkg && (
            <Text style={styles.legal}>{t(`paywall.plan.${planKey(selectedPkg)}Legal`, { store })}</Text>
          )}
          <View style={styles.links}>
            <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8}>
              <Text style={styles.link}>{t('paywall.terms')}</Text>
            </TouchableOpacity>
            {/* ponytail: sin URL publicada no sale; ver config/legal.js. */}
            {PRIVACY_URL && (
              <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8}>
                <Text style={styles.link}>{t('paywall.privacy')}</Text>
              </TouchableOpacity>
            )}
          </View>
    </DragSheet>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  // Header
  headerRow: {
    marginBottom: spacing.xl,
  },
  badge: {
    alignSelf:       'flex-start',
    backgroundColor: `${th.colors.accent}22`,
    ...textStyles.caps,
    color:           th.colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     `${th.colors.accent}44`,
    marginBottom:    spacing.xs,
  },
  title:    { ...textStyles.heading, color: th.colors.text },
  subtitle: { ...textStyles.label, color: th.colors.mutedLight, marginTop: 4, maxWidth: 260 },
  // Features
  featureList: {
    gap:          spacing.sm,
    marginBottom: spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  featureEmoji: { fontSize: 18, width: 28 },
  featureTxt:   { ...textStyles.body, color: th.colors.text, flex: 1 },

  // Packages
  packageList: {
    gap:          spacing.sm,
    marginBottom: spacing.lg,
  },
  packageCard: {
    flexDirection:   'row',
    alignItems:      'center',
    padding:         spacing.md,
    borderRadius:    th.radius.md,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface2,
    gap:             spacing.sm,
  },
  packageCardActive: {
    borderColor:     th.colors.accent,
    backgroundColor: `${th.colors.accent}0d`,
  },
  radio: {
    width:        18,
    height:       18,
    borderRadius: 9,
    borderWidth:  borders.medium,
    borderColor:  th.colors.border,
  },
  radioActive: {
    borderColor:     th.colors.accent,
    backgroundColor: th.colors.accent,
  },
  pkgTitle: { ...textStyles.body, color: th.colors.muted },
  pkgTitleActive: {
    color: th.colors.text,
  },
  pkgPrice: { ...textStyles.label, color: th.colors.muted, marginTop: 2 },
  saveBadge: {
    position:        'absolute',
    top:             -1,
    right:           spacing.sm,
    backgroundColor: th.colors.accent,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical:   2,
    borderRadius:    th.radius.xs,
  },
  saveBadgeTxt: { ...textStyles.caps, color: th.colors.bg },

  // CTA
  ctaBtn: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.sm,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    marginBottom:    spacing.md,
  },
  ctaTxt: { ...textStyles.button, color: th.colors.bg },

  // Restore
  restoreBtn: {
    alignItems:      'center',
    paddingVertical: spacing.sm,
    marginBottom:    spacing.sm,
  },
  restoreTxt: { ...textStyles.label, color: th.colors.mutedLight },

  // Legal
  legal: {
    ...textStyles.label,
    color:             th.colors.mutedLight,
    textAlign:         'center',
    lineHeight:        lh(textStyles.label.fontSize),
    paddingHorizontal: spacing.sm,
  },

  links: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            spacing.lg,
    marginTop:      spacing.sm,
  },
  link: { ...textStyles.label, color: th.colors.mutedLight, textDecorationLine: 'underline' },

  // No products
  noProducts: {
    paddingVertical: spacing.xl,
    alignItems:      'center',
  },
  noProductsTxt: { ...textStyles.label, color: th.colors.mutedLight, textAlign: 'center' },
});
