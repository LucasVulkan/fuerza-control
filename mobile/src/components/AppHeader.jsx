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
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import ImportModal from './ImportModal';
import DriveBackupModal from './DriveBackupModal';
import ClientCodeModal from './ClientCodeModal';
import TrainerSyncModal from './TrainerSyncModal';
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

function MenuItem({ icon, label, onPress, disabled, badge }) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, disabled && styles.menuItemDisabled]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={0.65}
    >
      <View style={styles.menuItemIcon}>{icon}</View>
      <Text style={styles.menuItemText}>{label}</Text>
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
  const [exporting, setExporting] = useState(null);

  const profile              = useStore((s) => s.profile);
  const setProfile           = useStore((s) => s.setProfile);
  const setLanguage          = useStore((s) => s.setLanguage);
  const navigate             = useStore((s) => s.navigate);
  const exportFullBackup     = useStore((s) => s.exportFullBackup);
  const exportProgramWithLog = useStore((s) => s.exportProgramWithLog);
  const clientSync           = useStore((s) => s.clientSync);
  const unlinkFromTrainer    = useStore((s) => s.unlinkFromTrainer);
  const trainerSync          = useStore((s) => s.trainerSync);

  const lang  = profile.language   ?? 'es';
  const unit  = profile.weightUnit ?? 'kg';
  const isPro = profile.isPro      ?? true;

  // ── Easter egg: 5 taps rápidos en "Plan actual" para toggle Pro (testing en prod) ──
  const planTapCount = useRef(0);
  const planTapTimer = useRef(null);
  const showToast    = useStore((s) => s.showToast);
  function handlePlanTap() {
    planTapCount.current += 1;
    clearTimeout(planTapTimer.current);
    if (planTapCount.current >= 5) {
      planTapCount.current = 0;
      setProfile({ isPro: !isPro });
      showToast(isPro ? 'Plan: FREE (test)' : 'Plan: PRO (test)');
    } else {
      planTapTimer.current = setTimeout(() => { planTapCount.current = 0; }, 1500);
    }
  }

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
              icon={<Icon d="M12 3v12m0 0l-4-4m4 4l4-4M3 20h18" />}
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
              icon={<Icon d="M12 15V3m0 0L8 7m4-4l4 4M3 20h18" />}
              label={t('header.importFile')}
              onPress={() => { onClose(); onImport(); }}
            />
            <MenuItem
              icon={<Icon d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />}
              label={t('header.driveBackup')}
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
          </CategoryCard>

          {/* ── CUENTA ── */}
          <CategoryCard title={t('header.sectionAccount')}>
            <MenuItem
              icon={<Icon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />}
              label={t('header.currentPlan')}
              badge={isPro ? 'PRO' : 'FREE'}
              onPress={handlePlanTap}
            />
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
          </CategoryCard>

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
        type: ['application/json', '*/*'],
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
          <Text style={styles.appNameFit}> Fit</Text>
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
    alignItems:    'baseline',
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
    fontWeight:    typography.heavy,
    color:         colors.accent,
    letterSpacing: 0.5,
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
    flex:       1,
    fontSize:   typography.base,
    color:      colors.text,
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
