/**
 * AppHeader — shared header for all main tabs.
 * Shows Forma Fit logo + settings menu (≡).
 * Self-contained: manages settings sheet + import logic internally.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Alert, StyleSheet, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import ImportModal from './ImportModal';
import DriveBackupModal from './DriveBackupModal';
import ClientCodeModal from './ClientCodeModal';
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

// ── Settings sub-components ────────────────────────────────────────────────────

function SectionLabel({ label }) {
  return <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>;
}

function SettingsBtn({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.settingsBtn, disabled && { opacity: 0.5 }]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.settingsBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Archived programs modal ───────────────────────────────────────────────────

function ArchivedProgramsModal({ onClose }) {
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
          <Text style={styles.archivedTitle}>PROGRAMAS ARCHIVADOS</Text>

          {archivedList.length === 0 ? (
            <Text style={styles.archivedEmpty}>No hay programas archivados</Text>
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
                    onPress={() => { restoreProgram(p.id); showToast('✓ Programa restaurado'); onClose(); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.restoreBtnText}>Restaurar</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.archivedCloseBtn} onPress={onClose}>
            <Text style={styles.archivedCloseBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Settings Sheet ─────────────────────────────────────────────────────────────

function SettingsSheet({ visible, onClose, onImport, onShowArchived, onShowDrive, onConnectTrainer }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [exporting, setExporting] = useState(null); // 'full' | 'log'

  const profile              = useStore((s) => s.profile);
  const setProfile           = useStore((s) => s.setProfile);
  const setLanguage          = useStore((s) => s.setLanguage);
  const navigate             = useStore((s) => s.navigate);
  const exportFullBackup     = useStore((s) => s.exportFullBackup);
  const exportProgramWithLog = useStore((s) => s.exportProgramWithLog);
  const clientSync           = useStore((s) => s.clientSync);
  const unlinkFromTrainer    = useStore((s) => s.unlinkFromTrainer);

  const lang  = profile.language   ?? 'es';
  const unit  = profile.weightUnit ?? 'kg';
  const isPro = profile.isPro      ?? true;

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.settingsSheet, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xxl) }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.settingsTitle}>AJUSTES</Text>

        {/* Programa */}
        <SectionLabel label="Programa" />
        <SettingsBtn label="Nuevo programa"          onPress={() => { onClose(); navigate('onboarding'); }} />
        <SettingsBtn label="Programas archivados"    onPress={() => { onClose(); onShowArchived(); }} />
        {clientSync?.slotId ? (
          <>
            <SettingsBtn label="Cambiar de entrenador"       onPress={() => { onClose(); onConnectTrainer(); }} />
            <SettingsBtn label="Desconectarse del entrenador" onPress={() => { unlinkFromTrainer(); onClose(); }} />
          </>
        ) : (
          <SettingsBtn label="Conectar con entrenador" onPress={() => { onClose(); onConnectTrainer(); }} />
        )}

        {/* Exportar */}
        <SectionLabel label="Exportar" />
        <SettingsBtn
          label={exporting === 'full' ? 'Exportando…' : 'Backup completo (.json)'}
          onPress={() => handleExport('full')}
          disabled={!!exporting}
        />
        <SettingsBtn
          label={exporting === 'log' ? 'Exportando…' : 'Programa + historial (.json)'}
          onPress={() => handleExport('log')}
          disabled={!!exporting}
        />

        {/* Importar */}
        <SectionLabel label="Importar" />
        <SettingsBtn label="Importar archivo .json" onPress={() => { onClose(); onImport(); }} />

        {/* Drive backup */}
        <SectionLabel label="Backup en la nube" />
        <SettingsBtn label="Google Drive backup" onPress={() => { onClose(); onShowDrive(); }} />

        {/* Configuración */}
        <SectionLabel label="Configuración" />

        {/* Language */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Idioma</Text>
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

        {/* Weight unit */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Unidad de peso</Text>
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

        {/* PRO toggle (developer) */}
        <SectionLabel label="Desarrollador" />
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Plan: {isPro ? 'PRO' : 'FREE'}</Text>
          <TouchableOpacity
            style={[styles.toggleBtn, isPro && styles.toggleBtnActive]}
            onPress={() => setProfile({ isPro: !isPro })}
          >
            <Text style={[styles.toggleBtnText, isPro && styles.toggleBtnTextActive]}>
              {isPro ? 'Cambiar a FREE' : 'Cambiar a PRO'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── AppHeader ──────────────────────────────────────────────────────────────────

export default function AppHeader() {
  const [settingsOpen,      setSettingsOpen]      = useState(false);
  const [importState,       setImportState]       = useState(null);
  const [picking,           setPicking]           = useState(false);
  const [showArchived,      setShowArchived]       = useState(false);
  const [showDrive,         setShowDrive]          = useState(false);
  const [showClientCode,    setShowClientCode]     = useState(false);
  const [now,               setNow]               = useState(() => new Date());

  const importData            = useStore((s) => s.importData);
  const showToast             = useStore((s) => s.showToast);
  const language              = useStore((s) => s.profile?.language ?? 'es');
  const pendingUpload         = useStore((s) => s.clientSync.pendingUpload);
  const uploadHistoryToTrainer = useStore((s) => s.uploadHistoryToTrainer);

  const [retrying, setRetrying] = useState(false);

  async function handleRetryUpload() {
    setRetrying(true);
    try {
      await uploadHistoryToTrainer();
      showToast('✓ Historial sincronizado');
    } catch {
      showToast('⚠️ No se pudo sincronizar');
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
        Alert.alert('Error', err?.message ?? 'No se pudo leer el archivo');
      }
    } finally {
      setPicking(false);
    }
  }

  function handleImport(parsedData, sections) {
    setImportState(null);
    importData(parsedData, sections);
    showToast('✓ Datos importados');
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
            {retrying ? 'Sincronizando…' : '⚠️ Última sesión no enviada al entrenador — Toca para reintentar'}
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
  settingsSheet: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: colors.surface,
    borderTopLeftRadius:  radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.xxl,
    paddingTop:        spacing.sm,
  },
  sheetHandle: {
    width:           40,
    height:          4,
    backgroundColor: colors.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    spacing.md,
  },
  settingsTitle: {
    fontSize:      typography.sm,
    fontWeight:    typography.heavy,
    color:         colors.muted,
    letterSpacing: 2,
    marginBottom:  spacing.md,
  },
  sectionLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.muted,
    letterSpacing: 1.5,
    marginTop:     spacing.md,
    marginBottom:  spacing.xs,
  },
  settingsBtn: {
    paddingVertical:   spacing.sm + 2,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  settingsBtnText: {
    fontSize: typography.base,
    color:    colors.text,
  },
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
