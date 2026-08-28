/**
 * AppHeader — shared header for all main tabs.
 * Shows Forma Fit logo + settings menu (≡).
 * Self-contained: manages settings sheet + import logic internally.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Alert, StyleSheet, ScrollView, TextInput,
} from 'react-native';
import Svg, { Path, G, Circle } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import ImportModal from './ImportModal';
import DragSheet   from './DragSheet';
import TrainerSyncModal      from './TrainerSyncModal';
import DeleteAccountModal    from './DeleteAccountModal';
import PaywallModal from './PaywallModal';
import SegmentedControl from './ui/SegmentedControl';
import { Switch }       from './ui/EditorRows';
import { PencilIcon }   from './ui/EditorIcons';
import { Section, MenuRow, Status, RowIcon } from './ui/MenuList';
import { formatWhen } from '../utils/formatWhen';
import { spacing, typography, textStyles, borders } from '../theme';
import { THEME_LIST } from '../themes';
import { useTheme, useThemedStyles } from '../useTheme';

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
  const th = useTheme();
  const width = height * (378 / 126);
  return (
    <Svg width={width} height={height} viewBox="0 0 378 126" fill="none">
      {/* I */}
      <Path d="M184.827 126H163.739C162.466 126 161.512 124.836 161.762 123.589L186.155 1.62099C186.344 0.678667 187.171 0.000366211 188.132 0.000366211H209.22C210.492 0.000366211 211.447 1.16425 211.197 2.41173L186.804 124.379C186.615 125.322 185.788 126 184.827 126Z" fill={th.colors.accent} />
      {/* T */}
      <Path d="M375.097 0C376.369 0 377.323 1.16388 377.074 2.41136L372.84 23.5796C372.652 24.5219 371.824 25.2002 370.863 25.2002H318.729C317.768 25.2002 316.941 25.8785 316.752 26.8208L297.24 124.379C297.052 125.322 296.225 126 295.264 126H274.175C272.903 126 271.949 124.836 272.198 123.589L291.394 27.6116C291.644 26.3641 290.689 25.2002 289.417 25.2002H243.936C242.664 25.2002 241.71 24.0363 241.959 22.7888L246.193 1.62062C246.381 0.678299 247.209 0 248.17 0H375.097Z" fill={th.colors.accent} />
      {/* F */}
      <Path d="M23.5472 126H2.45912C1.18693 126 0.232776 124.836 0.482272 123.589L20.338 24.3097C23.165 10.1749 35.5759 0.000366211 49.9907 0.000366211H138.66C139.933 0.000366211 140.887 1.16425 140.637 2.41173L136.404 23.5797C136.215 24.522 135.388 25.2003 134.427 25.2003H53.8989C48.9714 25.2003 44.7661 28.7627 43.956 33.6231L40.7111 53.0928C40.5063 54.3216 41.4539 55.4402 42.6997 55.4402H98.2176C99.5292 55.4402 100.492 56.6727 100.173 57.9451L96.1414 74.0731C95.9171 74.9705 95.1107 75.6001 94.1856 75.6001H36.9326C35.9716 75.6001 35.1442 76.2784 34.9558 77.2207L25.524 124.379C25.3356 125.322 24.5082 126 23.5472 126Z" fill={th.colors.accent} />
    </Svg>
  );
}

// ── Menu icon ────────────────────────────────────────────────────────────────
// "Menu 2" de Figma: 3 barras accent alineadas a la derecha, anchos crecientes,
// con el extremo IZQUIERDO cortado en diagonal (forman una línea inclinada) y
// esquinas ligeramente redondeadas (strokeLinejoin/cap round, no pill completa).
function MenuIcon({ size = 24 }) {
  const th = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path d="M10 4.5 H24.5 V7.5 H8 Z"      fill={th.colors.accent} stroke={th.colors.accent} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M6 11.1 H24.5 V14.1 H4 Z"     fill={th.colors.accent} stroke={th.colors.accent} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M2.4 17.7 H24.5 V20.7 H0.4 Z" fill={th.colors.accent} stroke={th.colors.accent} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// ── Iconos de fila ────────────────────────────────────────────────────────────
// Van en GRIS, no en lima: son decoración funcional, y con 12 iconos lima el
// menú parecía un árbol de Navidad. El lima queda para lo que informa (estado,
// badge PRO, tema activo).

const ICON_NEW      = <Path d="M12 5v14M5 12h14" />;
const ICON_ARCHIVED = <Path d="M4 7h16M4 12h16M4 17h10" />;
const ICON_TRAINER  = <G><Circle cx="12" cy="8" r="3.2" /><Path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></G>;
const ICON_CLOUD    = <Path d="M6 18a4 4 0 0 1 .6-8 6 6 0 0 1 11.5 2A3.5 3.5 0 0 1 17.5 18z" />;
const ICON_SYNC     = <G><Path d="M20.5 12a8.5 8.5 0 0 1-14 6.4" /><Path d="M3.5 12a8.5 8.5 0 0 1 14-6.4" /><Path d="M17 2.5v3.2h-3.2M7 21.5v-3.2h3.2" /></G>;
const ICON_EXPORT   = <Path d="M12 19V5M6 11l6-6 6 6" />;
const ICON_IMPORT   = <Path d="M12 5v14M6 13l6 6 6-6" />;
const ICON_PLAN     = <Path d="m12 3.5 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9z" />;
const ICON_DOCS     = <G><Circle cx="12" cy="12" r="9" /><Path d="M12 16v-4M12 8h.01" /></G>;
const ICON_TRASH    = <G><Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></G>;

// ── Bloque de identidad (solo PRO) ────────────────────────────────────────────
// Quién eres va arriba, con el badge PRO al lado, no perdido en una sección
// "Cuenta" a tres scrolls. La 2ª línea explica por qué ese nombre importa.
// Sin avatar (decisión del usuario: no hay icono de perfil).

function IdentityBlock() {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  const trainerName    = useStore((s) => s.trainerSync?.trainerName);
  const setTrainerName = useStore((s) => s.setTrainerName);

  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(trainerName ?? '');

  function startEditing() { setDraft(trainerName ?? ''); setEditing(true); }
  function commit() { setTrainerName(draft); setEditing(false); }

  return (
    <View style={styles.me}>
      <View style={styles.meWho}>
        {editing ? (
          <TextInput
            autoFocus
            style={styles.meNameInput}
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            placeholder={t('header.namePlaceholder')}
            placeholderTextColor={th.colors.muted}
            returnKeyType="done"
            maxLength={40}
          />
        ) : (
          <View style={styles.meNameRow}>
            <Text
              style={[styles.meName, !trainerName && styles.meNameEmpty]}
              numberOfLines={1}
              onPress={startEditing}
              suppressHighlighting
            >
              {trainerName || t('header.namePlaceholder')}
            </Text>
            <TouchableOpacity hitSlop={12} onPress={startEditing}>
              <PencilIcon size={11} color={th.colors.muted} />
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.meRole} numberOfLines={1}>{t('header.identityRole')}</Text>
      </View>
      <View style={styles.plan}>
        <Text style={styles.planText}>PRO</Text>
      </View>
    </View>
  );
}

// ── Selector de tema con muestras ─────────────────────────────────────────────
// Un selector de temas debe enseñar los temas: cada muestra usa el `surface` y
// el `accent` de SU tema, y el activo se marca con un anillo lima.

function ThemeSwatches() {
  const th       = useTheme();
  const styles   = useThemedStyles(makeStyles);
  const theme    = useStore((s) => s.theme ?? 'dark');
  const setTheme = useStore((s) => s.setTheme);

  return (
    <View style={styles.themes}>
      {THEME_LIST.map((item) => {
        const active = theme === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.theme}
            onPress={() => { if (!active) setTheme(item.id); }}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.chip,
                { backgroundColor: item.colors.surface },
                active && { borderColor: th.colors.accent },
              ]}
            >
              <View style={[styles.chipStripe, { backgroundColor: item.colors.accent }]} />
            </View>
            <Text style={[styles.themeName, active && styles.themeNameActive]} numberOfLines={1}>
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Archived programs modal ───────────────────────────────────────────────────

function ArchivedProgramsModal({ onClose }) {
  const styles = useThemedStyles(makeStyles);
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
                    onPress={() => { restoreProgram(p.id); showToast(t('header.toastRestored'), 2200, 'success'); onClose(); }}
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

// ── Hoja de exportar ──────────────────────────────────────────────────────────
// Exportar backup y Exportar programa + historial son la misma acción con
// distinto alcance: una sola fila en el menú y la decisión aquí, en el momento
// de decidir.

function ExportSheet({ visible, onClose }) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const exportFullBackup     = useStore((s) => s.exportFullBackup);
  const exportProgramWithLog = useStore((s) => s.exportProgramWithLog);
  const [exporting, setExporting] = useState(null);

  async function run(type) {
    setExporting(type);
    try {
      if (type === 'full') await exportFullBackup();
      else                 await exportProgramWithLog();
    } finally {
      setExporting(null);
      onClose();
    }
  }

  return (
    <DragSheet visible={visible} onClose={onClose} title={t('header.exportSheetTitle')}>
      <View style={styles.group}>
        <MenuRow
          isFirst
          icon={<RowIcon>{ICON_EXPORT}</RowIcon>}
          label={exporting === 'full' ? t('header.exporting') : t('header.exportBackup')}
          sub={t('header.exportBackupSub')}
          minHeight={62}
          disabled={!!exporting}
          onPress={() => run('full')}
        />
        <MenuRow
          isLast
          icon={<RowIcon>{ICON_ARCHIVED}</RowIcon>}
          label={exporting === 'log' ? t('header.exporting') : t('header.exportProgramHistory')}
          sub={t('header.exportProgramHistorySub')}
          minHeight={62}
          disabled={!!exporting}
          onPress={() => run('log')}
        />
      </View>
    </DragSheet>
  );
}

// ── Settings Sheet ─────────────────────────────────────────────────────────────

function SettingsSheet({ visible, onClose, onImport, onShowArchived, onShowExport, onChangeSyncMode, onDeleteAccount }) {
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);
  const { t }      = useTranslation();
  const navigation = useNavigation();
  const [showPaywall, setShowPaywall] = useState(false);

  const profile     = useStore((s) => s.profile);
  const setProfile  = useStore((s) => s.setProfile);
  const setLanguage = useStore((s) => s.setLanguage);
  const navigate    = useStore((s) => s.navigate);
  const clientSync  = useStore((s) => s.clientSync);
  const trainerSync = useStore((s) => s.trainerSync);
  const driveBackup = useStore((s) => s.driveBackup);
  const archivedCount = useStore((s) => Object.values(s.programs ?? {})
    .filter((p) => p.status === 'archived' && p.mode !== 'managed').length);

  const lang          = profile.language      ?? 'es';
  const unit          = profile.weightUnit    ?? 'kg';
  const isPro         = profile.isPro         ?? false;
  const proTabsHidden = profile.proTabsHidden ?? false;

  function go(route) { onClose(); navigation.navigate(route); }

  // ── Conexiones: estado visible en la propia fila ─────────────────────────────
  const trainerConnected = !!clientSync?.slotId;
  const trainerSub = trainerConnected
    ? [clientSync.trainerName, clientSync.googleLinked ? t('header.trainerSubGoogle') : t('header.trainerSubCode')]
        .filter(Boolean).join(' · ')
    : t('header.trainerSubOff');

  const driveWhen  = formatWhen(driveBackup?.lastBackup, lang, t('dayCard.today'), t('dayCard.yesterday'));
  const driveTone  = driveBackup?.needsReconnect ? 'warn' : driveBackup?.enabled ? 'on' : 'off';
  const driveSub   = driveBackup?.needsReconnect ? t('header.driveSubReconnect')
    : !driveBackup?.enabled                      ? t('header.driveSubOff')
    : driveWhen                                  ? t('header.driveSubLast', { when: driveWhen })
    :                                              t('header.driveSubNever');

  const syncMode   = trainerSync?.mode ?? null;
  const syncActive = !!syncMode && syncMode !== 'offline';
  const syncSub    = syncMode === 'google'  ? t('header.syncSubGoogle')
    : syncMode === 'apple'   ? t('header.syncSubApple')
    : syncMode === 'code'    ? t('header.syncSubCode')
    : syncMode === 'offline' ? t('header.syncSubOffline')
    :                          t('header.syncSubNone');

  return (
    <DragSheet visible={visible} onClose={onClose}>
      {/* El bloque de identidad es la cabecera del menú y solo existe en PRO;
          una cuenta free entra directa a los ajustes. */}
      {isPro && <IdentityBlock />}

      <Section title={t('header.sectionPrograms')}>
        <MenuRow
          icon={<RowIcon>{ICON_NEW}</RowIcon>}
          label={t('header.newProgramItem')}
          onPress={() => {
            if (clientSync?.slotId) {
              Alert.alert(
                t('header.newProgramWarnTitle'),
                t('header.newProgramWarnBody'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('common.continue'),
                    style: 'destructive',
                    onPress: () => { onClose(); navigate('onboarding'); },
                  },
                ],
              );
            } else {
              onClose();
              navigate('onboarding');
            }
          }}
        />
        <MenuRow
          icon={<RowIcon>{ICON_ARCHIVED}</RowIcon>}
          label={t('header.archivedProgramsItem')}
          value={archivedCount > 0 ? String(archivedCount) : null}
          onPress={() => { onClose(); onShowArchived(); }}
        />
      </Section>

      {/* Drive va con Entrenador (las dos son conexiones externas); en DATOS
          quedan solo las acciones manuales. */}
      <Section title={t('header.sectionConnections')}>
        <MenuRow
          icon={<RowIcon>{ICON_TRAINER}</RowIcon>}
          label={t('header.trainerRow')}
          sub={trainerSub}
          minHeight={62}
          status={<Status tone={trainerConnected ? 'on' : 'off'} label={trainerConnected ? t('header.statusConnected') : t('header.statusConnect')} />}
          onPress={() => go('TrainerConnection')}
        />
        <MenuRow
          icon={<RowIcon>{ICON_CLOUD}</RowIcon>}
          label={t('header.driveRow')}
          sub={driveSub}
          minHeight={62}
          status={<Status tone={driveTone} label={
            driveTone === 'on'   ? t('header.statusActive')
            : driveTone === 'warn' ? t('header.statusReconnect')
            :                        t('header.statusActivate')
          } />}
          onPress={() => go('DriveBackup')}
        />
        {isPro && (
          <MenuRow
            icon={<RowIcon>{ICON_SYNC}</RowIcon>}
            label={t('header.clientSyncRow')}
            sub={syncSub}
            minHeight={62}
            status={<Status tone={syncActive ? 'on' : 'off'} label={syncActive ? t('header.statusActive') : t('header.statusSetUp')} />}
            onPress={() => { onClose(); onChangeSyncMode(); }}
          />
        )}
      </Section>

      <Section title={t('header.sectionData')}>
        <MenuRow
          icon={<RowIcon>{ICON_EXPORT}</RowIcon>}
          label={t('header.exportRow')}
          value={t('header.exportRowValue')}
          onPress={() => { onClose(); onShowExport(); }}
        />
        <MenuRow
          icon={<RowIcon>{ICON_IMPORT}</RowIcon>}
          label={t('header.importFile')}
          onPress={() => { onClose(); onImport(); }}
        />
      </Section>

      {/* Controles inline: unidades e idioma se cambian aquí mismo, sin navegar.
          El idioma va como ES/EN, sin banderas (una bandera no es un idioma). */}
      <Section title={t('header.sectionPreferences')}>
        <MenuRow
          label={t('header.units')}
          minHeight={58}
          control={(
            <View style={styles.segWrap}>
              <SegmentedControl
                options={[{ id: 'kg', label: 'KG' }, { id: 'lb', label: 'LB' }]}
                value={unit}
                onChange={(u) => { if (u !== unit) setProfile({ weightUnit: u }); }}
              />
            </View>
          )}
        />
        <MenuRow
          label={t('header.language')}
          minHeight={58}
          control={(
            <View style={styles.segWrap}>
              <SegmentedControl
                options={[{ id: 'es', label: 'ES' }, { id: 'en', label: 'EN' }]}
                value={lang}
                onChange={(l) => { if (l !== lang) setLanguage(l); }}
              />
            </View>
          )}
        />
        <MenuRow
          label={t('header.theme')}
          minHeight={86}
          control={<ThemeSwatches />}
        />
        {!isPro && (
          <MenuRow
            label={t('header.proTabsLabel')}
            sub={t('header.proTabsHint')}
            minHeight={62}
            control={<Switch value={!proTabsHidden} />}
            onPress={() => setProfile({ proTabsHidden: !proTabsHidden })}
          />
        )}
      </Section>

      <Section title={t('header.sectionAccount')}>
        <MenuRow
          icon={<RowIcon>{ICON_PLAN}</RowIcon>}
          label={t('header.planRow')}
          badge={isPro ? 'PRO' : 'FREE'}
          badgeMuted={!isPro}
          onPress={isPro ? undefined : () => setShowPaywall(true)}
        />
        <MenuRow
          icon={<RowIcon>{ICON_DOCS}</RowIcon>}
          label={t('header.docsRow')}
          onPress={() => go('Docs')}
        />
        {/* Apple pide (5.1.1(v)) que borrar la cuenta se encuentre desde
            dentro. Va aquí, en CUENTA, y no dentro de Sincronización: esa
            fila es solo para Pro y se abre desde Clientes. */}
        <MenuRow
          icon={<RowIcon color={th.tint.red50}>{ICON_TRASH}</RowIcon>}
          label={t('header.deleteAccountRow')}
          labelColor={th.tint.red50}
          sub={t('header.deleteAccountSub')}
          subLines={0}
          minHeight={62}
          onPress={() => { onClose(); onDeleteAccount(); }}
        />
      </Section>

      {__DEV__ && (
        <Section title={t('header.sectionDeveloper')}>
          <MenuRow
            label={`${t('header.plan')} ${isPro ? 'PRO' : 'FREE'}`}
            value={isPro ? t('header.switchToFree') : t('header.switchToPro')}
            onPress={() => setProfile({ isPro: !isPro })}
          />
        </Section>
      )}

      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
    </DragSheet>
  );
}


// ── AppHeader ──────────────────────────────────────────────────────────────────

export default function AppHeader() {
  const { t }                 = useTranslation();
  const th                    = useTheme();
  const styles                = useThemedStyles(makeStyles);
  const [settingsOpen,      setSettingsOpen]      = useState(false);
  const [importState,       setImportState]       = useState(null);
  const [picking,           setPicking]           = useState(false);
  const [showArchived,      setShowArchived]       = useState(false);
  const [showExport,        setShowExport]         = useState(false);
  const [showSyncMode,      setShowSyncMode]       = useState(false);
  const [showDeleteAccount, setShowDeleteAccount]  = useState(false);
  const [now,               setNow]               = useState(() => new Date());

  const importData                = useStore((s) => s.importData);
  const showToast                 = useStore((s) => s.showToast);
  const navigate                  = useStore((s) => s.navigate);
  const language                  = useStore((s) => s.profile?.language ?? 'es');
  const pendingUpload             = useStore((s) => s.clientSync?.pendingUpload);
  const uploadHistoryToTrainer    = useStore((s) => s.uploadHistoryToTrainer);
  const pendingExternalImport     = useStore((s) => s.pendingExternalImport);
  const clearPendingExternalImport = useStore((s) => s.clearPendingExternalImport);

  const [retrying, setRetrying] = useState(false);

  async function handleRetryUpload() {
    setRetrying(true);
    try {
      await uploadHistoryToTrainer();
      showToast(t('header.toastSynced'), 2200, 'success');
    } catch {
      showToast(t('header.toastSyncFailed'), 2200, 'error');
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Watch for files opened externally (intent / share sheet).
  // App.js reads the file and sets pendingExternalImport; we parse + show modal.
  useEffect(() => {
    if (!pendingExternalImport) return;
    const { rawContent, fileName } = pendingExternalImport;
    clearPendingExternalImport();                         // consume immediately
    const parsed = parseImportFile(rawContent);
    if (!parsed.ok) {
      Alert.alert('Archivo no válido', parsed.error);
      return;
    }
    setImportState({ fileName, parsedData: parsed.data });
  }, [pendingExternalImport]); // eslint-disable-line react-hooks/exhaustive-deps

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
    showToast(t('header.toastImported'), 2200, 'success');
    // If a program was imported, navigate to home so the new program is visible.
    if (sections.program) navigate('home');
  }

  return (
    <>
      <View style={[styles.header, { backgroundColor: th.colors.headerBg }]}>
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
          <MenuIcon size={24} />
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
        onShowExport={() => setShowExport(true)}
        onChangeSyncMode={() => setShowSyncMode(true)}
        onDeleteAccount={() => setShowDeleteAccount(true)}
      />

      {showArchived && (
        <ArchivedProgramsModal onClose={() => setShowArchived(false)} />
      )}

      <ExportSheet visible={showExport} onClose={() => setShowExport(false)} />

      <TrainerSyncModal
        visible={showSyncMode}
        onClose={() => setShowSyncMode(false)}
        isFirstTime={false}
      />

      <DeleteAccountModal
        visible={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
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

const makeStyles = (th) => StyleSheet.create({
  // Header row — sin línea divisoria (Figma: top y cuerpo sin separador)
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm, // menos aire bajo el top bar (antes md)
  },
  appNameContainer: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    minWidth:      88,
  },
  // "Forma" — Inter Black Italic 19px, tracking -1.14 (Figma logo)
  appNameForma: {
    fontFamily:    'Inter_900Black_Italic',
    fontSize:      19,
    color:         th.colors.text,
    letterSpacing: -1.14,
  },
  appNameFit: {
    fontSize:      typography.xl,
    fontFamily:    'BarlowCondensed_800ExtraBold_Italic',
    color:         th.colors.accent,
    letterSpacing: 2,
  },
  // Fecha — Inter Bold 10px, tracking 0.4, mutedLight (Figma)
  clockText: {
    flex:          1,
    fontFamily:    'Inter_700Bold',
    fontSize:      10,
    color:         th.colors.mutedLight,
    textAlign:     'center',
    letterSpacing: 0.4,
  },
  menuBtn: {
    padding:  spacing.xs,
    minWidth: 36,
    alignItems: 'flex-end',
  },

  // Pending upload banner
  pendingBanner: {
    backgroundColor:   `${th.colors.orange}1e`,
    borderBottomWidth: borders.thin,
    borderBottomColor: `${th.colors.orange}4d`,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.sm,
  },
  pendingBannerText: {
    fontSize:   typography.xs,
    color:      th.colors.orange,
    textAlign:  'center',
    lineHeight: typography.xs * 1.5,
  },

  // ── Bloque de identidad ─────────────────────────────────────────────────────
  // Medidas de la referencia (v29): fila con el badge a la derecha, 20 de aire
  // por debajo antes de la primera etiqueta de sección.
  me: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.xs2,
    paddingBottom:     spacing.xl,
  },
  meWho:     { flex: 1, minWidth: 0 },
  meNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  // 17px Black con tracking -0.01em: no hay token de Figma para este tamaño.
  meName: {
    fontFamily:    'Inter_900Black',
    fontSize:      17,
    letterSpacing: -0.17,
    color:         th.colors.text,
    flexShrink:    1,
  },
  meNameEmpty: { color: th.colors.mutedLight },
  meNameInput: {
    fontFamily:    'Inter_900Black',
    fontSize:      17,
    letterSpacing: -0.17,
    color:         th.colors.text,
    padding:       0,
  },
  meRole: {
    fontFamily:    'Inter_600SemiBold',
    fontSize:      12,
    color:         th.colors.mutedLight,
    marginTop:     spacing.xs,
  },
  plan: {
    height:           28,
    borderRadius:     9,
    backgroundColor:  th.tint.accent10,
    paddingHorizontal: 11,
    alignItems:       'center',
    justifyContent:   'center',
    flexShrink:       0,
  },
  planText: {
    fontFamily:    'Inter_900Black',
    fontSize:      11,
    letterSpacing: 0.88,
    color:         th.colors.accent,
  },

  // Segmentado pequeño dentro de la fila (unidades / idioma)
  segWrap: { width: 104, flexShrink: 0 },

  // Muestras de tema
  themes:    { flexDirection: 'row', gap: spacing.md, flexShrink: 0 },
  theme:     { alignItems: 'center', gap: spacing.sm },
  chip: {
    width:        38,
    height:       38,
    borderRadius: 12,
    overflow:     'hidden',
    borderWidth:  borders.medium,
    borderColor:  'transparent',
  },
  chipStripe: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 13 },
  themeName:  { ...textStyles.tag, color: th.colors.muted },
  themeNameActive: { fontFamily: 'Inter_900Black', color: th.colors.accent },

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
    backgroundColor: th.colors.bg,
    borderRadius:    th.radius.lg,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    padding:         spacing.xl,
    gap:             spacing.md,
  },
  archivedTitle: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         th.colors.muted,
    letterSpacing: 2,
  },
  archivedEmpty: {
    fontSize:  typography.sm,
    color:     th.colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  archivedRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
    gap:             spacing.sm,
  },
  archivedName: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  archivedDate: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 2,
  },
  restoreBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      th.radius.sm,
    backgroundColor:   `${th.colors.accent}18`,
    borderWidth:       borders.thin,
    borderColor:       `${th.colors.accent}40`,
  },
  restoreBtnText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.accent,
  },
  archivedCloseBtn: {
    paddingVertical: spacing.md,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    alignItems:      'center',
  },
  archivedCloseBtnText: {
    fontSize:   typography.base,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },
});
