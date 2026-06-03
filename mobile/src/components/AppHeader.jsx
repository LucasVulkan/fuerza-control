/**
 * AppHeader — shared header for all main tabs.
 * Shows Forma Fit logo + settings menu (≡).
 * Self-contained: manages settings sheet + import logic internally.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Alert, StyleSheet, ScrollView,
  Animated, PanResponder,
} from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import ImportModal from './ImportModal';
import DriveBackupModal from './DriveBackupModal';
import ClientCodeModal from './ClientCodeModal';
import TrainerSyncModal from './TrainerSyncModal';
import PaywallModal from './PaywallModal';
import { colors, spacing, typography, borders, radius } from '../theme';

// ── Clock formatter ───────────────────────────────────────────────────────────

const WDAYS_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const WDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatClock(date, lang) {
  const h   = date.getHours();
  const m   = String(date.getMinutes()).padStart(2, '0');
  const dow = date.getDay();
  const d   = date.getDate();
  const mo  = date.getMonth();

  if (lang === 'en') {
    const h12  = h % 12 || 12;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h12}:${m} ${ampm} · ${WDAYS_EN[dow]} ${MONTHS_EN[mo]} ${d}`;
  }
  return `${String(h).padStart(2, '0')}:${m} · ${WDAYS_ES[dow]} ${d} ${MONTHS_ES[mo]}`;
}

// ── Parse import file ──────────────────────────────────────────────────────────

function parseImportFile(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.version) return { ok: false, error: 'El archivo no tiene campo "version".' };
    if (!['1', '2'].includes(String(parsed.version))) return { ok: false, error: `Versión ${parsed.version} no compatible.` };
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
}

// ── FIT logo (SVG paths) ───────────────────────────────────────────────────────

function FitLogo({ height = 22 }) {
  const width = height * (378 / 126);
  return (
    <Svg width={width} height={height} viewBox="0 0 378 126" fill="none">
      {/* I */}
      <Path d="M184.827 126H163.739C162.466 126 161.512 124.836 161.762 123.589L186.155 1.62099C186.344 0.678667 187.171 0.000366211 188.132 0.000366211H209.22C210.492 0.000366211 211.447 1.16425 211.197 2.41173L186.804 124.379C186.615 125.322 185.788 126 184.827 126Z" fill={colors.accent} />
      {/* T */}
      <Path d="M375.097 0C376.369 0 377.323 1.16388 377.074 2.41136L372.84 23.5796C372.652 24.5219 371.824 25.2002 370.863 25.2002H318.729C317.768 25.2002 316.941 25.8785 316.752 26.8208L297.24 124.379C297.052 125.322 296.225 126 295.264 126H274.175C272.903 126 271.949 124.836 272.198 123.589L291.394 27.6116C291.644 26.3641 290.689 25.2002 289.417 25.2002H243.936C242.664 25.2002 241.71 24.0363 241.959 22.7888L246.193 1.62062C246.381 0.678299 247.209 0 248.17 0H375.097Z" fill={colors.accent} />
      {/* F */}
      <Path d="M23.5472 126H2.45912C1.18693 126 0.232776 124.836 0.482272 123.589L20.338 24.3097C23.165 10.1749 35.5759 0.000366211 49.9907 0.000366211H138.66C139.933 0.000366211 140.887 1.16425 140.637 2.41173L136.404 23.5797C136.215 24.522 135.388 25.2003 134.427 25.2003H53.8989C48.9714 25.2003 44.7661 28.7627 43.956 33.6231L40.7111 53.0928C40.5063 54.3216 41.4539 55.4402 42.6997 55.4402H98.2176C99.5292 55.4402 100.492 56.6727 100.173 57.9451L96.1414 74.0731C95.9171 74.9705 95.1107 75.6001 94.1856 75.6001H36.9326C35.9716 75.6001 35.1442 76.2784 34.9558 77.2207L25.524 124.379C25.3356 125.322 24.5082 126 23.5472 126Z" fill={colors.accent} />
    </Svg>
  );
}

// ── Icon ───────────────────────────────────────────────────────────────────────

function Icon({ d, size = 18 }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.accent}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={d} />
    </Svg>
  );
}

// ── MenuItem ──────────────────────────────────────────────────────────────────

function MenuItem({ icon, label, subtitle, onPress, disabled, badge }) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, disabled && styles.menuItemDisabled]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={0.65}
    >
      <View style={styles.menuItemIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.menuItemText}>{label}</Text>
        {subtitle != null && (
          <Text style={styles.menuItemSubtitle} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
      {badge != null && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── CategoryCard ──────────────────────────────────────────────────────────────

function CategoryCard({ title, children }) {
  return (
    <View style={styles.category}>
      <Text style={styles.categoryTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ── Archived programs modal ───────────────────────────────────────────────────

function ArchivedProgramsModal({ onClose }) {
  const { t }          = useTranslation();
  const programs       = useStore((s) => s.programs);
  const restoreProgram = useStore((s) => s.restoreProgram);
  const showToast      = useStore((s) => s.showToast);

  const archivedList = useMemo(
    () => Object.values(programs ?? {})
      .filter((p) => p.status === 'archived' && p.mode !== 'managed')
      .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [programs],
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.archivedOuter}>
        <View style={styles.archivedModal}>
          <Text style={styles.archivedTitle}>{t('archived.title')}</Text>

          {archivedList.length === 0 ? (
            <Text style={styles.archivedEmpty}>{t('archived.empty')}</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
              {archivedList.map((p) => (
                <View key={p.id} style={styles.archivedRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.archivedName} numberOfLines={1}>{p.name}</Text>
                    {p.archivedAt && (
                      <Text style={styles.archivedDate}>{p.archivedAt}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={() => { restoreProgram(p.id); showToast(t('header.toastRestored')); onClose(); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.restoreBtnText}>{t('archived.restore')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.archivedCloseBtn} onPress={onClose}>
            <Text style={styles.archivedCloseBtnText}>{t('archived.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Settings Sheet ─────────────────────────────────────────────────────────────

function SettingsSheet({ visible, onClose, onImport, onShowArchived, onShowDrive, onConnectTrainer, onChangeSyncMode }) {
  const { t }         = useTranslation();
  const insets        = useSafeAreaInsets();
  const [exporting,    setExporting]   = useState(null);
  const [showPaywall,  setShowPaywall] = useState(false);

  const profile              = useStore((s) => s.profile);
  const setProfile           = useStore((s) => s.setProfile);
  const setLanguage          = useStore((s) => s.setLanguage);
  const navigate             = useStore((s) => s.navigate);
  const exportFullBackup     = useStore((s) => s.exportFullBackup);
  const exportProgramWithLog = useStore((s) => s.exportProgramWithLog);
  const clientSync           = useStore((s) => s.clientSync);
  const unlinkFromTrainer    = useStore((s) => s.unlinkFromTrainer);
  const trainerSync          = useStore((s) => s.trainerSync);
  const driveBackup          = useStore((s) => s.driveBackup);

  const lang           = profile.language      ?? 'es';
  const unit           = profile.weightUnit    ?? 'kg';
  const isPro          = profile.isPro         ?? true;
  const proTabsHidden  = profile.proTabsHidden ?? false;

  // ── Drag-to-close ────────────────────────────────────────────────────────────
  const translateY      = useRef(new Animated.Value(900)).current;
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, 300], outputRange: [1, 0], extrapolate: 'clamp',
  });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120 || gs.vy > 0.8) {
          Animated.timing(translateY, {
            toValue: 900, duration: 240, useNativeDriver: true,
          }).start(() => { onClose(); });
        } else {
          Animated.spring(translateY, {
            toValue: 0, useNativeDriver: true, tension: 80, friction: 10,
          }).start();
        }
      },
    })
  ).current;

  // Slide-in al abrir (animationType="none" en el Modal — evita conflicto entre
  // la animación nativa del Modal y el transform nativo de Animated)
  useEffect(() => {
    if (visible) {
      translateY.setValue(900);
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    }
  }, [visible]);

  async function handleExport(type) {
    setExporting(type);
    try {
      if (type === 'full') await exportFullBackup();
      else                 await exportProgramWithLog();
    } finally {
      setExporting(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop — opacidad sincronizada con el gesto de arrastre */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="box-none">
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
      </Animated.View>
      {/* Layout shell — posiciona el sheet en la parte inferior */}
      <View style={styles.sheetOverlay} pointerEvents="box-none">
        <Animated.View
          style={[styles.settingsSheet, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xxl), transform: [{ translateY }] }]}
        >
          {/* Drag handle */}
          <View {...panResponder.panHandlers}>
            <View style={styles.dragHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>
            <Text style={styles.settingsTitle}>{t('header.settings')}</Text>
          </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

          {/* ── PROGRAMAS ── */}
          <CategoryCard title={t('header.sectionPrograms')}>
            <MenuItem
              icon={<Icon d="M12 5v14M5 12h14" />}
              label={t('header.newProgramItem')}
              onPress={() => { onClose(); navigate('onboarding'); }}
            />
            <MenuItem
              icon={<Icon d="M4 6h16M4 10h16M4 14h10" />}
              label={t('header.archivedProgramsItem')}
              onPress={() => { onClose(); onShowArchived(); }}
            />
            {clientSync?.slotId ? (
              <>
                <MenuItem
                  icon={<Icon d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />}
                  label={t('header.changeTrainer')}
                  subtitle="Conectado"
                  onPress={() => { onClose(); onConnectTrainer(); }}
                />
                <MenuItem
                  icon={<Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />}
                  label={t('header.disconnectTrainer')}
                  onPress={() => { unlinkFromTrainer(); onClose(); }}
                />
              </>
            ) : (
              <MenuItem
                icon={<Icon d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" />}
                label={t('header.connectTrainer')}
                onPress={() => { onClose(); onConnectTrainer(); }}
              />
            )}
          </CategoryCard>

          {/* ── DATOS ── */}
          <CategoryCard title={t('header.sectionData')}>
            <MenuItem
              icon={<Icon d="M12 15V3m0 0L8 7m4-4l4 4M3 20h18" />}
              label={exporting === 'full' ? t('header.exporting') : t('header.exportBackup')}
              onPress={() => handleExport('full')}
              disabled={!!exporting}
            />
            <MenuItem
              icon={<Icon d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />}
              label={exporting === 'log' ? t('header.exporting') : t('header.exportProgramHistory')}
              onPress={() => handleExport('log')}
              disabled={!!exporting}
            />
            <MenuItem
              icon={<Icon d="M12 3v12m0 0l-4-4m4 4l4-4M3 20h18" />}
              label={t('header.importFile')}
              onPress={() => { onClose(); onImport(); }}
            />
            <MenuItem
              icon={<Icon d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />}
              label={t('header.driveBackup')}
              subtitle={driveBackup?.enabled && driveBackup?.email ? driveBackup.email : null}
              onPress={() => { onClose(); onShowDrive(); }}
            />
          </CategoryCard>

          {/* ── CONFIGURACIÓN ── */}
          <CategoryCard title={t('header.sectionConfig')}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('header.language')}</Text>
              <View style={styles.toggleBtns}>
                {['es', 'en'].map((l) => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.toggleBtn, lang === l && styles.toggleBtnActive]}
                    onPress={() => { if (lang !== l) setLanguage(l); }}
                  >
                    <Text style={[styles.toggleBtnText, lang === l && styles.toggleBtnTextActive]}>
                      {l === 'es' ? '🇪🇸 ES' : '🇺🇸 EN'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('header.units')}</Text>
              <View style={styles.toggleBtns}>
                {['kg', 'lb'].map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.toggleBtn, unit === u && styles.toggleBtnActive]}
                    onPress={() => { if (unit !== u) setProfile({ weightUnit: u }); }}
                  >
                    <Text style={[styles.toggleBtnText, unit === u && styles.toggleBtnTextActive]}>
                      {u.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {!isPro && (
              <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.toggleLabel}>{t('header.proTabsLabel')}</Text>
                <TouchableOpacity
                  style={[styles.toggleBtn, !proTabsHidden && styles.toggleBtnActive]}
                  onPress={() => setProfile({ proTabsHidden: !proTabsHidden })}
                >
                  <Text style={[styles.toggleBtnText, !proTabsHidden && styles.toggleBtnTextActive]}>
                    {proTabsHidden ? t('header.proTabsHidden') : t('header.proTabsVisible')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </CategoryCard>

          {/* ── CUENTA ── */}
          <CategoryCard title={t('header.sectionAccount')}>
            <MenuItem
              icon={<Icon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />}
              label={t('header.currentPlan')}
              badge={isPro ? 'PRO' : 'FREE'}
              onPress={isPro ? undefined : () => setShowPaywall(true)}
            />
            {isPro && (
              <MenuItem
                icon={<Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                label={t('header.trainerSync')}
                badge={
                  trainerSync.mode === 'google'  ? 'GOOGLE' :
                  trainerSync.mode === 'code'    ? 'CÓDIGO' :
                  trainerSync.mode === 'offline' ? 'OFFLINE' : null
                }
                onPress={() => { onClose(); onChangeSyncMode(); }}
              />
            )}
          </CategoryCard>
          {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}

          {/* ── DESARROLLADOR — solo en dev builds ── */}
          {__DEV__ && (
            <CategoryCard title={t('header.sectionDeveloper')}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{t('header.plan')} {isPro ? 'PRO' : 'FREE'}</Text>
                <TouchableOpacity
                  style={[styles.toggleBtn, isPro && styles.toggleBtnActive]}
                  onPress={() => setProfile({ isPro: !isPro })}
                >
                  <Text style={[styles.toggleBtnText, isPro && styles.toggleBtnTextActive]}>
                    {isPro ? t('header.switchToFree') : t('header.switchToPro')}
                  </Text>
                </TouchableOpacity>
              </View>
            </CategoryCard>
          )}

        </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── AppHeader ──────────────────────────────────────────────────────────────────

export default function AppHeader() {
  const { t }                 = useTranslation();
  const [settingsOpen,      setSettingsOpen]      = useState(false);
  const [importState,       setImportState]       = useState(null);
  const [picking,           setPicking]           = useState(false);
  const [showArchived,      setShowArchived]       = useState(false);
  const [showDrive,         setShowDrive]          = useState(false);
  const [showClientCode,    setShowClientCode]     = useState(false);
  const [showSyncMode,      setShowSyncMode]       = useState(false);
  const [now,               setNow]               = useState(() => new Date());

  const importData            = useStore((s) => s.importData);
  const showToast             = useStore((s) => s.showToast);
  const language              = useStore((s) => s.profile?.language ?? 'es');
  const pendingUpload         = useStore((s) => s.clientSync?.pendingUpload);
  const uploadHistoryToTrainer = useStore((s) => s.uploadHistoryToTrainer);

  const [retrying, setRetrying] = useState(false);

  async function handleRetryUpload() {
    setRetrying(true);
    try {
      await uploadHistoryToTrainer();
      showToast(t('header.toastSynced'));
    } catch {
      showToast(t('header.toastSyncFailed'));
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  async function handlePickFile() {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-fitdata', 'application/json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed = parseImportFile(raw);
      if (!parsed.ok) {
        Alert.alert('Archivo no válido', parsed.error);
        return;
      }
      setImportState({ fileName: result.assets[0].name, parsedData: parsed.data });
    } catch (err) {
      if (!err?.message?.includes('cancel')) {
        Alert.alert('Error', err?.message ?? t('errors.cannotReadFile'));
      }
    } finally {
      setPicking(false);
    }
  }

  function handleImport(parsedData, sections) {
    setImportState(null);
    importData(parsedData, sections, { silent: true }); // caller shows its own toast below
    showToast(t('header.toastImported'));
  }

  return (
    <>
      <View style={styles.header}>
        <View style={styles.appNameContainer}>
          <Text style={styles.appNameForma}>Forma</Text>
          <View style={{ marginTop: 4 }}><FitLogo height={14} /></View>
        </View>
        <Text style={styles.clockText}>{formatClock(now, language)}</Text>
        <TouchableOpacity
          onPress={() => setSettingsOpen(true)}
          hitSlop={12}
          style={styles.menuBtn}
        >
          <Text style={styles.menuIcon}>≡</Text>
        </TouchableOpacity>
      </View>

      {/* Pending upload banner — shown when client's last history upload failed */}
      {pendingUpload && (
        <TouchableOpacity
          style={styles.pendingBanner}
          onPress={handleRetryUpload}
          activeOpacity={0.8}
          disabled={retrying}
        >
          <Text style={styles.pendingBannerText}>
            {retrying ? t('header.pendingBannerSyncing') : t('header.pendingBanner')}
          </Text>
        </TouchableOpacity>
      )}

      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onImport={handlePickFile}
        onShowArchived={() => setShowArchived(true)}
        onShowDrive={() => setShowDrive(true)}
        onConnectTrainer={() => setShowClientCode(true)}
        onChangeSyncMode={() => setShowSyncMode(true)}
      />

      {showArchived && (
        <ArchivedProgramsModal onClose={() => setShowArchived(false)} />
      )}

      {showDrive && (
        <DriveBackupModal onClose={() => setShowDrive(false)} />
      )}

      <ClientCodeModal
        visible={showClientCode}
        onClose={() => setShowClientCode(false)}
      />

      <TrainerSyncModal
        visible={showSyncMode}
        onClose={() => setShowSyncMode(false)}
        isFirstTime={false}
      />

      {importState && (
        <ImportModal
          fileName={importState.fileName}
          parsedData={importState.parsedData}
          onImport={handleImport}
          onClose={() => setImportState(null)}
        />
      )}
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header row
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  appNameContainer: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    minWidth:      88,
  },
  appNameForma: {
    fontSize:      typography.xl,
    fontWeight:    typography.heavy,
    color:         colors.text,
    letterSpacing: 0.5,
  },
  appNameFit: {
    fontSize:      typography.xl,
    fontFamily:    'BarlowCondensed_800ExtraBold_Italic',
    color:         colors.accent,
    letterSpacing: 2,
  },
  clockText: {
    flex:       1,
    fontSize:   typography.xs,
    color:      colors.muted,
    textAlign:  'center',
    letterSpacing: 0.3,
  },
  menuBtn: {
    padding:  spacing.xs,
    minWidth: 36,
    alignItems: 'flex-end',
  },
  menuIcon: {
    fontSize:   26,
    color:      colors.muted,
    lineHeight: 28,
  },

  // Pending upload banner
  pendingBanner: {
    backgroundColor:   `${colors.orange}1e`,
    borderBottomWidth: borders.thin,
    borderBottomColor: `${colors.orange}4d`,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.sm,
  },
  pendingBannerText: {
    fontSize:   typography.xs,
    color:      colors.orange,
    textAlign:  'center',
    lineHeight: typography.xs * 1.5,
  },

  // Settings sheet
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetOverlay: {
    flex:           1,
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    maxHeight:            '88%',
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal:    spacing.lg,
    paddingTop:           spacing.sm,
  },
  dragHandleWrap: {
    paddingVertical: spacing.sm,
    alignItems:      'center',
  },
  sheetHandle: {
    width:           40,
    height:          4,
    backgroundColor: colors.border,
    borderRadius:    2,
  },
  settingsTitle: {
    fontSize:      typography.sm,
    fontWeight:    typography.heavy,
    color:         colors.muted,
    letterSpacing: 2,
    marginBottom:  spacing.md,
  },

  // Category card
  category: {
    backgroundColor: colors.surface2,
    borderWidth:     1,
    borderColor:     `${colors.accent}2e`,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
    gap:             6,
  },
  categoryTitle: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 2,
    marginBottom:  2,
  },

  // Menu item
  menuItem: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.sm,
    paddingVertical:   spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius:   radius.md,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth:    1,
    borderColor:    'rgba(255,255,255,0.05)',
  },
  menuItemDisabled: {
    opacity: 0.45,
  },
  menuItemIcon: {
    width:           24,
    height:          24,
    alignItems:      'center',
    justifyContent:  'center',
  },
  menuItemText: {
    fontSize:   typography.base,
    color:      colors.text,
  },
  menuItemSubtitle: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 1,
  },

  // Badge
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
    borderRadius:      999,
    borderWidth:       1,
    borderColor:       `${colors.accent}59`,
    backgroundColor:   `${colors.accent}0f`,
  },
  badgeText: {
    fontSize:   typography.xs,
    fontWeight: typography.bold,
    color:      colors.accent,
  },

  // Toggles (inside category cards)
  toggleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  toggleLabel: {
    fontSize: typography.base,
    color:    colors.text,
    flex:     1,
  },
  toggleBtns: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  toggleBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
  },
  toggleBtnActive: {
    borderColor:     colors.accent,
    backgroundColor: `${colors.accent}18`,
  },
  toggleBtnText: {
    fontSize: typography.sm,
    color:    colors.muted,
  },
  toggleBtnTextActive: {
    color: colors.accent,
  },

  // Archived programs modal
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  archivedOuter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
  },
  archivedModal: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    padding:         spacing.xl,
    gap:             spacing.md,
  },
  archivedTitle: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.muted,
    letterSpacing: 2,
  },
  archivedEmpty: {
    fontSize:  typography.sm,
    color:     colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  archivedRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
    gap:             spacing.sm,
  },
  archivedName: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  archivedDate: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 2,
  },
  restoreBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      radius.sm,
    backgroundColor:   `${colors.accent}18`,
    borderWidth:       borders.thin,
    borderColor:       `${colors.accent}40`,
  },
  restoreBtnText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.accent,
  },
  archivedCloseBtn: {
    paddingVertical: spacing.md,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    alignItems:      'center',
  },
  archivedCloseBtnText: {
    fontSize:   typography.base,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
});
