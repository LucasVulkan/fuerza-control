/**
 * PaywallModal.jsx
 * Shown when a free user tries to access a PRO feature.
 * Fetches the current RevenueCat offering and displays available packages.
 * Falls back gracefully when native module isn't loaded (Expo Go).
 */

import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';

import { useStore }                                     from '../../store/useStore';
import { colors, spacing, typography, borders, radius } from '../theme';

// ── Feature list ──────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  { emoji: '👥', text: 'Gestión completa de clientes' },
  { emoji: '📋', text: 'Asignar programas a clientes' },
  { emoji: '📈', text: 'Ver el progreso de tus clientes en tiempo real' },
  { emoji: '💶', text: 'Registro de facturación' },
  { emoji: '📐', text: 'Crear plantillas de entrenamiento' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PaywallModal({ onClose }) {
  const getOffering     = useStore((s) => s.getOffering);
  const purchasePackage = useStore((s) => s.purchasePackage);
  const restorePurchases = useStore((s) => s.restorePurchases);

  const [offering, setOffering]       = useState(null);
  const [selected, setSelected]       = useState(null); // selected package key
  const [loading, setLoading]         = useState(true);
  const [purchasing, setPurchasing]   = useState(false);
  const [restoring, setRestoring]     = useState(false);

  useEffect(() => {
    (async () => {
      const o = await getOffering();
      setOffering(o);
      // Pre-select the first available package
      if (o?.availablePackages?.length) {
        setSelected(o.availablePackages[0].identifier);
      }
      setLoading(false);
    })();
  }, []);

  const packages = offering?.availablePackages ?? [];
  const selectedPkg = packages.find((p) => p.identifier === selected) ?? packages[0] ?? null;

  async function handlePurchase() {
    if (!selectedPkg) return;
    setPurchasing(true);
    try {
      const result = await purchasePackage(selectedPkg);
      if (result.ok) {
        onClose();
      } else if (!result.cancelled) {
        Alert.alert('Error', result.error ?? 'No se pudo completar la compra.');
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

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.badge}>PRO</Text>
              <Text style={styles.title}>Desbloquea Forma Pro</Text>
              <Text style={styles.subtitle}>Todo lo que necesitas para entrenar y gestionar clientes</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Feature list */}
          <View style={styles.featureList}>
            {PRO_FEATURES.map((f) => (
              <View key={f.text} style={styles.featureRow}>
                <Text style={styles.featureEmoji}>{f.emoji}</Text>
                <Text style={styles.featureTxt}>{f.text}</Text>
              </View>
            ))}
          </View>

          {/* Packages */}
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.xl }} />
          ) : packages.length === 0 ? (
            <View style={styles.noProducts}>
              <Text style={styles.noProductsTxt}>
                Forma Pro próximamente
              </Text>
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
                        {pkg.product.title || 'Forma Pro'}
                      </Text>
                      <Text style={styles.pkgPrice}>
                        {pkg.product.priceString} · Pago único
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
                ? <ActivityIndicator size="small" color={colors.bg} />
                : <Text style={styles.ctaTxt}>
                    {selectedPkg
                      ? `Comprar por ${selectedPkg.product.priceString}`
                      : 'Comprar Forma Pro'}
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
              ? <ActivityIndicator size="small" color={colors.muted} />
              : <Text style={styles.restoreTxt}>Restaurar compra anterior</Text>
            }
          </TouchableOpacity>

          <Text style={styles.legal}>
            Pago único. Sin suscripciones. El acceso a Forma Pro es permanente.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal:    spacing.xl,
    paddingBottom:        spacing.xxl,
    paddingTop:           spacing.sm,
    maxHeight:            '90%',
  },
  handle: {
    width:           40,
    height:          4,
    backgroundColor: colors.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    spacing.md,
  },

  // Header
  headerRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   spacing.xl,
    gap:            spacing.md,
  },
  badge: {
    alignSelf:       'flex-start',
    backgroundColor: `${colors.accent}22`,
    color:           colors.accent,
    fontSize:        typography.xs,
    fontWeight:      typography.heavy,
    letterSpacing:   2,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     `${colors.accent}44`,
    marginBottom:    spacing.xs,
  },
  title: {
    fontSize:   typography.xl,
    fontWeight: typography.heavy,
    color:      colors.text,
  },
  subtitle: {
    fontSize:  typography.sm,
    color:     colors.muted,
    marginTop: 4,
    maxWidth:  260,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeX: {
    fontSize: typography.base,
    color:    colors.muted,
  },

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
  featureEmoji: {
    fontSize: typography.lg,
    width:    28,
  },
  featureTxt: {
    fontSize: typography.base,
    color:    colors.text,
    flex:     1,
  },

  // Packages
  packageList: {
    gap:          spacing.sm,
    marginBottom: spacing.lg,
  },
  packageCard: {
    flexDirection:   'row',
    alignItems:      'center',
    padding:         spacing.md,
    borderRadius:    radius.md,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface2,
    gap:             spacing.sm,
  },
  packageCardActive: {
    borderColor:     colors.accent,
    backgroundColor: `${colors.accent}0d`,
  },
  radio: {
    width:        18,
    height:       18,
    borderRadius: 9,
    borderWidth:  borders.medium,
    borderColor:  colors.border,
  },
  radioActive: {
    borderColor:     colors.accent,
    backgroundColor: colors.accent,
  },
  pkgTitle: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.muted,
  },
  pkgTitleActive: {
    color: colors.text,
  },
  pkgPrice: {
    fontSize:  typography.sm,
    color:     colors.muted,
    marginTop: 2,
  },
  saveBadge: {
    position:        'absolute',
    top:             -1,
    right:           spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical:   2,
    borderRadius:    radius.xs,
  },
  saveBadgeTxt: {
    fontSize:   typography.xs - 1,
    fontWeight: typography.heavy,
    color:      colors.bg,
    letterSpacing: 0.5,
  },

  // CTA
  ctaBtn: {
    backgroundColor: colors.accent,
    borderRadius:    radius.sm,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    marginBottom:    spacing.md,
  },
  ctaTxt: {
    fontSize:   typography.base,
    fontWeight: typography.heavy,
    color:      colors.bg,
  },

  // Restore
  restoreBtn: {
    alignItems:      'center',
    paddingVertical: spacing.sm,
    marginBottom:    spacing.sm,
  },
  restoreTxt: {
    fontSize: typography.sm,
    color:    colors.muted,
  },

  // Legal
  legal: {
    fontSize:    typography.xs,
    color:       colors.muted2,
    textAlign:   'center',
    lineHeight:  typography.xs * 1.6,
    paddingHorizontal: spacing.sm,
  },

  // No products
  noProducts: {
    paddingVertical: spacing.xl,
    alignItems:      'center',
  },
  noProductsTxt: {
    fontSize:  typography.sm,
    color:     colors.muted,
    textAlign: 'center',
  },
});
