/**
 * AppHeader — shared header for all main tabs.
 * Shows Forma Fit logo + settings menu (≡).
 * Self-contained: manages settings sheet + import logic internally.
 */

import { useState, useEffect, useMemo } from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Text, TextInput } from './ui/Text';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import { parseImportFile } from '../utils/importFile';
import { parseBodyWeight } from '../utils/bodyWeight';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { programsOf } from '../utils/programOwnership';
import ImportModal from './ImportModal';
import DragSheet   from './DragSheet';
import ArchivedProgramsSheet from './ArchivedProgramsSheet';
import SegmentedControl from './ui/SegmentedControl';
import { Switch }       from './ui/EditorRows';
import { ArrowIcon }    from './ui/EditorIcons';
import { Section, MenuRow, Status, RowIcon, SheetSlide, ROW_CHEVRON } from './ui/MenuList';
import { ROW_ICON } from './ui/rowIcons';
import FitLogo from './ui/FitLogo';
import { formatWhen } from '../utils/formatWhen';
import { spacing, textStyles, borders, lh } from '../theme';
import { THEME_LIST } from '../themes';
import { useTheme, useThemedStyles } from '../useTheme';

import { showDialog } from './ui/dialog';
import { startNewProgram } from '../utils/startNewProgram';
import { useDisconnectFromTrainer } from '../hooks/useDisconnectFromTrainer';
import { useFreeGates } from '../useFreeGates';
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
// badge PRO, tema activo). Los trazos viven en `ui/rowIcons`, compartidos con
// las hojas de opciones.

// ── Fila de «Mi cuenta» ────────────────────────────────────────────────────────
// Va arriba del todo, con o sin PRO, y abre la página (M03-02 §6.2): nombre del
// entrenador (o «Mi cuenta» sin cuenta), cómo entra, y la chapa FREE/PRO.
// Sin avatar (decisión del usuario: no hay icono de perfil).

function AccountRow({ onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  const mode        = useStore((s) => s.trainerSync?.mode);
  const trainerName = useStore((s) => s.trainerSync?.trainerName);
  const isPro       = useStore((s) => s.profile.isPro ?? false);
  const hasAccount  = !!mode && mode !== 'offline';

  return (
    <SheetSlide>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.acct, pressed && styles.acctPressed]}>
        <View style={styles.acctMeta}>
          <Text style={styles.acctName} numberOfLines={1}>
            {(hasAccount && trainerName) || t('account.rowTitleNone')}
          </Text>
          <Text style={styles.acctSub} numberOfLines={1}>
            {hasAccount ? t('account.rowSubTrainer', { how: t(`account.short.${mode}`) }) : t('account.rowSubNone')}
          </Text>
        </View>
        <View style={[styles.acctChip, !isPro && styles.acctChipOff]}>
          <Text style={[styles.acctChipText, !isPro && styles.acctChipTextOff]}>{isPro ? 'PRO' : 'FREE'}</Text>
        </View>
        <ArrowIcon size={ROW_CHEVRON} color={th.colors.muted} />
      </Pressable>
    </SheetSlide>
  );
}

// ── Selector de tema con muestras ─────────────────────────────────────────────
// Un selector de temas debe enseñar los temas: cada muestra usa el `surface` y
// el `accent` de SU tema, y el activo se marca con un anillo del acento. Las
// muestras van sin nombre —seis no cabían—: el del activo va bajo «Tema».

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
            onPress={() => { if (!active) setTheme(item.id); }}
            activeOpacity={0.8}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            accessibilityState={{ selected: active }}
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
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Programas archivados ──────────────────────────────────────────────────────

// Los tuyos: la misma hoja que la ficha de cliente (`ArchivedProgramsSheet`),
// con las confirmaciones y los avisos de aquí.
function MyArchivedPrograms({ onClose }) {
  const { t }  = useTranslation();
  const programs        = useStore((s) => s.programs);
  const workoutLog      = useStore((s) => s.workoutLog);
  const proTabsHidden   = useStore((s) => s.profile?.proTabsHidden ?? false);
  const { gates, gate } = useFreeGates();
  const restoreProgram            = useStore((s) => s.restoreProgram);
  const deleteProgram             = useStore((s) => s.deleteProgram);
  const exportSpecificProgram     = useStore((s) => s.exportSpecificProgram);
  const cloneProgramFromTemplate  = useStore((s) => s.cloneProgramFromTemplate);
  const setPrintingProgram        = useStore((s) => s.setPrintingProgram);
  const showToast                 = useStore((s) => s.showToast);
  const { guardProgramChange }    = useDisconnectFromTrainer();

  // `programsOf` excluye las plantillas: sin eso, una plantilla archivada
  // pasaría por `restoreProgram` y se convertiría en el programa activo.
  const archived = useMemo(
    () => programsOf(programs, 'me').filter((p) => p.status === 'archived'),
    [programs],
  );

  const reactivate = (program) => guardProgramChange(program.id, () => {
    const run = () => { restoreProgram(program.id); showToast(t('header.toastRestored'), 2200, 'success'); };
    // Con otro programa activo, el cambio lo archiva: se avisa antes.
    if (!useStore.getState().profile?.activeProgramId) { run(); return; }
    showDialog(
      t('clients.reactivateTitle'),
      t('clients.reactivateConfirm', { name: program.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('clients.menuReactivate'), onPress: run },
      ],
    );
  });

  const confirmDelete = (program) => showDialog(
    t('clients.deleteProgramTitle'),
    t('clients.deleteProgramConfirm', { name: program.name }),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('clients.menuDelete'), style: 'destructive', onPress: () => deleteProgram(program.id, false) },
    ],
  );

  return (
    <ArchivedProgramsSheet
      visible
      onClose={onClose}
      programs={archived}
      log={workoutLog}
      onReactivate={reactivate}
      onView={(p) => setPrintingProgram(p.id)}
      onExport={(p) => exportSpecificProgram(p.id, true)}
      // Con las pestañas de entrenador ocultas, la plantilla iría a donde no
      // se ve: la fila no sale. El límite del plan gratis lo pone el store.
      saveTemplateLocked={!!gates.newProgramTemplate}
      onSaveTemplate={proTabsHidden ? undefined : gate(gates.newProgramTemplate, (p) => {
        if (cloneProgramFromTemplate(p.id, { kind: 'template', name: p.name })) showToast(t('clients.toastSavedTemplate'));
      })}
      onDelete={confirmDelete}
    />
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
      <Section style={styles.exportRows}>
        <MenuRow
          icon={<RowIcon>{ROW_ICON.export}</RowIcon>}
          label={exporting === 'full' ? t('header.exporting') : t('header.exportBackup')}
          sub={t('header.exportBackupSub')}
          minHeight={62}
          disabled={!!exporting}
          onPress={() => run('full')}
        />
        <MenuRow
          icon={<RowIcon>{ROW_ICON.archived}</RowIcon>}
          label={exporting === 'log' ? t('header.exporting') : t('header.exportProgramHistory')}
          sub={t('header.exportProgramHistorySub')}
          minHeight={62}
          disabled={!!exporting}
          onPress={() => run('log')}
        />
      </Section>
    </DragSheet>
  );
}

// ── Peso corporal ──────────────────────────────────────────────────────────────
// Campo a mano en la fila de Preferencias (progresion-clara §9.3). Al salir del
// campo guarda en kg si vale; si no, vuelve al peso de antes: no se puede borrar.

function BodyWeightField() {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const bodyWeight = useStore((s) => s.profile.bodyWeight);
  const setProfile = useStore((s) => s.setProfile);
  const { unit, toDisplay, toKg } = useWeightUnit();

  const shown = bodyWeight != null ? String(toDisplay(bodyWeight)) : '';
  // null = no se está escribiendo: se enseña el peso guardado (así sigue a KG/LB
  // y al recap sin sincronizar nada).
  const [draft, setDraft] = useState(null);

  function commit() {
    const kg = draft == null || draft === shown ? null : parseBodyWeight(draft, toKg);
    if (kg != null) setProfile({ bodyWeight: kg });
    setDraft(null);
  }

  return (
    <View style={styles.bwWrap}>
      <TextInput
        style={styles.bwInput}
        value={draft ?? shown}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        placeholder="—"
        placeholderTextColor={th.colors.muted}
        keyboardType="decimal-pad"
        returnKeyType="done"
        selectTextOnFocus
        maxLength={6}
        accessibilityLabel={t('header.bodyWeight')}
      />
      <Text style={styles.bwUnit}>{unit}</Text>
    </View>
  );
}

// ── Settings Sheet ─────────────────────────────────────────────────────────────

function SettingsSheet({ visible, onClose, onImport, onShowArchived, onShowExport }) {
  const styles     = useThemedStyles(makeStyles);
  const { t }      = useTranslation();
  const navigation = useNavigation();
  const themeName  = useTheme().name;

  const profile     = useStore((s) => s.profile);
  const setProfile  = useStore((s) => s.setProfile);
  const setLanguage = useStore((s) => s.setLanguage);
  const navigate    = useStore((s) => s.navigate);
  const clientSync  = useStore((s) => s.clientSync);
  const driveBackup = useStore((s) => s.driveBackup);
  const { guardProgramChange } = useDisconnectFromTrainer();
  const archivedCount = useStore((s) => programsOf(s.programs, 'me')
    .filter((p) => p.status === 'archived').length);

  const lang          = profile.language      ?? 'es';
  const unit          = profile.weightUnit    ?? 'kg';
  const isPro         = profile.isPro         ?? false;
  const proTabsHidden = profile.proTabsHidden ?? false;
  const scrubRuler    = profile.scrubRuler    ?? true;
  const homeTabs      = (profile.homeView ?? 'cards') === 'tabs';

  function go(route) { onClose(); navigation.navigate(route); }

  // ── Conexiones: estado visible en la propia fila ─────────────────────────────
  // Desconectada por su entrenador (C09 §4.3): ni «Conectado» ni «Conectar».
  const trainerLost      = !!clientSync?.slotId && !!clientSync.lostAt;
  const trainerConnected = !!clientSync?.slotId && !trainerLost;
  const trainerSub = trainerLost
    ? t('header.trainerSubLost')
    : trainerConnected
    ? [clientSync.trainerName, clientSync.googleLinked ? t('header.trainerSubGoogle') : t('header.trainerSubCode')]
        .filter(Boolean).join(' · ')
    : t('header.trainerSubOff');

  const driveWhen  = formatWhen(driveBackup?.lastBackup, lang, t('dayCard.today'), t('dayCard.yesterday'));
  const driveTone  = driveBackup?.needsReconnect ? 'warn' : driveBackup?.enabled ? 'on' : 'off';
  const driveSub   = driveBackup?.needsReconnect ? t('header.driveSubReconnect')
    : !driveBackup?.enabled                      ? t('header.driveSubOff')
    : driveWhen                                  ? t('header.driveSubLast', { when: driveWhen })
    :                                              t('header.driveSubNever');

  return (
    <DragSheet visible={visible} onClose={onClose}>
      {/* «Mi cuenta» es la cabecera del menú, con o sin PRO. */}
      <AccountRow onPress={() => go('Account')} />

      <Section title={t('header.sectionPrograms')}>
        <MenuRow
          icon={<RowIcon>{ROW_ICON.new}</RowIcon>}
          label={t('header.newProgramItem')}
          onPress={() => startNewProgram(guardProgramChange, navigate, onClose)}
        />
        <MenuRow
          icon={<RowIcon>{ROW_ICON.archived}</RowIcon>}
          label={t('header.archivedProgramsItem')}
          value={archivedCount > 0 ? String(archivedCount) : null}
          onPress={() => { onClose(); onShowArchived(); }}
        />
      </Section>

      {/* Drive va con Entrenador (las dos son conexiones externas); en DATOS
          quedan solo las acciones manuales. */}
      <Section title={t('header.sectionConnections')}>
        <MenuRow
          icon={<RowIcon>{ROW_ICON.user}</RowIcon>}
          label={t('header.trainerRow')}
          sub={trainerSub}
          minHeight={62}
          status={<Status
            tone={trainerLost ? 'warn' : trainerConnected ? 'on' : 'off'}
            label={trainerLost ? t('header.statusReconnect') : trainerConnected ? t('header.statusConnected') : t('header.statusConnect')}
          />}
          onPress={() => go('TrainerConnection')}
        />
        <MenuRow
          icon={<RowIcon>{ROW_ICON.cloud}</RowIcon>}
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
      </Section>

      <Section title={t('header.sectionData')}>
        <MenuRow
          icon={<RowIcon>{ROW_ICON.export}</RowIcon>}
          label={t('header.exportRow')}
          value={t('header.exportRowValue')}
          onPress={() => { onClose(); onShowExport(); }}
        />
        <MenuRow
          icon={<RowIcon>{ROW_ICON.import}</RowIcon>}
          label={t('header.importFile')}
          // En iOS el selector no sale si se abre mientras la hoja se cierra, y su
          // promesa se queda colgada: el segundo toque da «Different document
          // picking in progress». Espera a la hoja, como en la ficha del cliente.
          onPress={() => { onClose(); setTimeout(onImport, 250); }}
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
          value={themeName}
          valueBelow
          control={<ThemeSwatches />}
        />
        <MenuRow
          label={t('header.bodyWeight')}
          minHeight={58}
          control={<BodyWeightField />}
        />
        <MenuRow
          label={t('header.proTabsLabel')}
          sub={t('header.proTabsHint')}
          minHeight={62}
          control={<Switch value={!proTabsHidden} />}
          onPress={() => setProfile({ proTabsHidden: !proTabsHidden })}
        />
        {/* Cómo se ven las sesiones en Inicio (U13): la lista plegable o una
            sola tarjeta con una pestaña por sesión. */}
        <MenuRow
          label={t('header.homeTabsLabel')}
          sub={t('header.homeTabsHint')}
          minHeight={62}
          control={<Switch value={homeTabs} />}
          onPress={() => setProfile({ homeView: homeTabs ? 'cards' : 'tabs' })}
        />
        <MenuRow
          label={t('header.scrubRulerLabel')}
          sub={t('header.scrubRulerHint')}
          minHeight={62}
          control={<Switch value={scrubRuler} />}
          onPress={() => setProfile({ scrubRuler: !scrubRuler })}
        />
      </Section>

      <Section title={t('header.sectionSupport')}>
        <MenuRow
          icon={<RowIcon>{ROW_ICON.docs}</RowIcon>}
          label={t('header.docsRow')}
          onPress={() => go('Docs')}
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
  const [now,               setNow]               = useState(() => new Date());

  const importData                = useStore((s) => s.importData);
  const showToast                 = useStore((s) => s.showToast);
  const navigate                  = useStore((s) => s.navigate);
  const language                  = useStore((s) => s.profile?.language ?? 'es');
  const pendingUpload             = useStore((s) => s.clientSync?.pendingUpload);
  const trainerLost               = useStore((s) => !!s.clientSync?.slotId && !!s.clientSync.lostAt);
  const uploadHistoryToTrainer    = useStore((s) => s.uploadHistoryToTrainer);
  const headerNavigation          = useNavigation();
  const { guardProgramChange }    = useDisconnectFromTrainer();

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

  // El archivo abierto desde fuera lo atiende `ExternalImportModal`, montado
  // una sola vez en `RootNavigator`: esta cabecera va en seis pantallas y todas
  // abrían su propio modal (fallo 11). Aquí se queda `handlePickFile`, que sí
  // es local: el "importar" del menú.

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
        showDialog(t('errors.invalidFile'), t(parsed.errorKey, parsed.errorParams));
        return;
      }
      setImportState({ fileName: result.assets[0].name, parsedData: parsed.data });
    } catch (err) {
      if (!err?.message?.includes('cancel')) {
        showDialog(t('common.error'), err?.message ?? t('errors.cannotReadFile'));
      }
    } finally {
      setPicking(false);
    }
  }

  function handleImport(parsedData, sections) {
    setImportState(null);
    const run = () => {
      importData(parsedData, sections, { silent: true }); // caller shows its own toast below
      showToast(t('header.toastImported'), 2200, 'success');
      // If a program was imported, navigate to home so the new program is visible.
      if (sections.program) navigate('home');
    };
    // Importar un programa es usar otro: con entrenador, antes se pregunta (R1).
    if (sections.program) guardProgramChange(parsedData.program?.id, run); else run();
  }

  return (
    <>
      <View style={[styles.header, { backgroundColor: th.colors.headerBg }]}>
        <View style={styles.appNameContainer}>
          <Text style={styles.appNameForma}>Forma</Text>
          <FitLogo height={14} />
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

      {/* Desconectada por su entrenador (C09 §4.3): en todas las pantallas, no
          solo dentro de Entrenador. Lleva allí, donde está la salida. */}
      {trainerLost && (
        <TouchableOpacity
          style={styles.pendingBanner}
          onPress={() => headerNavigation.navigate('TrainerConnection')}
          activeOpacity={0.8}
        >
          <Text style={styles.pendingBannerText}>{t('header.lostBanner')}</Text>
        </TouchableOpacity>
      )}

      {/* Pending upload banner — shown when client's last history upload failed */}
      {pendingUpload && !trainerLost && (
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
      />

      {showArchived && (
        <MyArchivedPrograms onClose={() => setShowArchived(false)} />
      )}

      <ExportSheet visible={showExport} onClose={() => setShowExport(false)} />

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
  // La hoja de exportar: sus dos filas con la separación de `Section`.
  exportRows: { marginBottom: spacing.sm },
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
  // Fecha — Inter Bold 10px, tracking 0.4, mutedLight (Figma)
  clockText: {
    ...textStyles.caps,
    flex:      1,
    color:     th.colors.mutedLight,
    textAlign: 'center',
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
    ...textStyles.label,
    color:      th.colors.orange,
    textAlign:  'center',
    lineHeight: lh(textStyles.label.fontSize),
  },

  // ── Fila de «Mi cuenta» (maqueta account.html: `.acc-row`, sin avatar) ──────
  acct: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    backgroundColor: th.colors.surface,
    // El radio de una fila suelta del menú (`getCardRadii` con primera y última).
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    marginBottom:    spacing.xl,
  },
  acctPressed: { transform: [{ scale: 0.98 }] },
  acctMeta:    { flex: 1, minWidth: 0 },
  acctName:    { ...textStyles.itemTitleQuiet, color: th.colors.text },
  acctSub:     { ...textStyles.label, color: th.colors.mutedLight, marginTop: spacing.xs2 },
  acctChip: {
    padding:         spacing.sm,
    borderRadius:    th.radius.xs,
    backgroundColor: th.colors.accent,
    flexShrink:      0,
  },
  acctChipOff:     { backgroundColor: th.colors.surface2 },
  acctChipText:    { ...textStyles.labelStrong, color: th.colors.onAccent },
  acctChipTextOff: { color: th.colors.mutedLight },

  // Segmentado pequeño dentro de la fila (unidades / idioma)
  segWrap: { width: 104, flexShrink: 0 },

  // Peso corporal: caja de campo en surface2 (como el segmentado) + unidad.
  bwWrap:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2, flexShrink: 0 },
  bwInput: {
    ...textStyles.bodyStrong,
    color:             th.colors.text,
    minWidth:          64,
    textAlign:         'right',
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm2,
    fontVariant:       ['tabular-nums'],
  },
  bwUnit:  { ...textStyles.labelStrong, color: th.colors.mutedLight },

  // Muestras de tema
  themes:    { flexDirection: 'row', gap: spacing.sm2, flexShrink: 0 },
  chip: {
    width:        32,
    height:       32,
    borderRadius: 10,
    overflow:     'hidden',
    borderWidth:  borders.medium,
    borderColor:  'transparent',
  },
  chipStripe: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 11 },
});
