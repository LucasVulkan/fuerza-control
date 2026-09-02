/**
 * ProgramScreen — pantalla "Plantillas" del entrenador.
 *
 * Nodo de Figma: `235:4471`. La capa se llama "Clients" porque se duplicó de la
 * pantalla de clientes y nadie la renombró: el contenido ES la lista de
 * plantillas (ver `docs/figma-extraction/pages/clients-2.md`).
 *
 * Divergencias respecto al mock, todas pedidas por el usuario:
 *  · Fuera el eyebrow "PLANTILLA" de la tarjeta — en esta pantalla todo es una
 *    plantilla, la etiqueta no informa de nada.
 *  · De 4 botones + icono de compartir a UNO: `Asignar`. Todo lo demás (ver,
 *    editar, duplicar, compartir, exportar, eliminar) vive en la hoja que abre
 *    la propia tarjeta al pulsarla — el botón de `···` desapareció en QA.
 *  · El stat del medio dice CICLOS, no "SEMANAS" como el mock: `durationWeeks`
 *    tiene nombre legado pero cuenta vueltas al ciclo (misma decisión ya cerrada
 *    en el editor de programa y en el banner de Home).
 *  · Cabecera calcada de Clientes (`PLANTILLAS · N` + `+ Plantilla` a 42), sin
 *    buscador: Figma no lo dibuja aquí y con pocas plantillas sería ruido.
 *
 * Los tres modales propios (crear, menú contextual, asignar) y los dos
 * `Alert.alert` pasan a `DragSheet`, que es el único bottom-sheet de la app.
 * El aviso de "este cliente ya tiene programa activo" era un Alert DESPUÉS de
 * pulsar Asignar; ahora se lee en la propia fila del cliente, antes de elegir.
 */
import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation }  from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import AppHeader from '../components/AppHeader';
import PaywallModal from '../components/PaywallModal';
import DragSheet from '../components/DragSheet';
import StepField from '../components/ui/StepField';
import { ArrowIcon } from '../components/ui/EditorIcons';
import { ToggleRow } from '../components/ui/EditorRows';
import { spacing, textStyles, sheetRowBase } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { templatesOf } from '../utils/programOwnership';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Los 3 stats de la tarjeta. `open` = alguna etapa sin límite de ciclos, lo que
 * deja ciclos y sesiones indeterminados → se pintan con "+" (mismo criterio que
 * `editor.programSummaryOpen`).
 */
function templateStats(program) {
  const stages = program.stages?.length
    ? program.stages
    : [{ days: program.days ?? [], durationWeeks: program.durationWeeks ?? null }];
  return {
    stages:   stages.length,
    cycles:   stages.reduce((a, s) => a + (s.durationWeeks ?? 0), 0),
    sessions: stages.reduce((a, s) => a + (s.days?.length ?? 0) * (s.durationWeeks ?? 0), 0),
    open:     stages.some((s) => s.durationWeeks == null),
  };
}

// ── Template card (Sesion Card / variante Plantillas `204:1901`) ───────────────

function Stat({ value, label }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TemplateCard({ program, onAssign, onMenu }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const s      = templateStats(program);
  const more   = s.open ? '+' : '';

  return (
    <View style={styles.card}>
      {/* Sin botón de `···`: pulsar la tarjeta ES el menú (QA). Un control menos
          y un área de toque enorme para lo que antes era una caja de 26 px. */}
      <TouchableOpacity style={styles.cardBody} onPress={onMenu} activeOpacity={0.75}>
        <Text style={styles.cardName} numberOfLines={2}>{program.name}</Text>
        <View style={styles.statsRow}>
          <Stat value={String(s.stages)} label={t('templates.statStages',   { count: s.stages })} />
          <Stat value={`${s.cycles}${more}`}   label={t('templates.statCycles',   { count: s.cycles })} />
          <Stat value={`${s.sessions}${more}`} label={t('templates.statSessions', { count: s.sessions })} />
        </View>
      </TouchableOpacity>

      {/* Única acción explícita de la tarjeta, a la derecha. */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.cardBtn} onPress={onAssign} activeOpacity={0.8}>
          <Text style={styles.cardBtnText}>{t('templates.assignModal.assignBtn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Filas de hoja (patrón `SheetRow` de los editores) ──────────────────────────

function SheetRow({ label, onPress, danger = false }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.sheetRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.sheetRowText, danger && { color: th.colors.red }]}>{label}</Text>
      <ArrowIcon size={14} color={danger ? th.colors.red : th.colors.mutedLight} />
    </TouchableOpacity>
  );
}

// ── Hoja de crear plantilla ────────────────────────────────────────────────────

function CreateSheet({ visible, onClose, onCreate }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name,     setName]     = useState('');
  const [sessions, setSessions] = useState(3);
  // null = sin límite de ciclos (la etapa dura hasta que se añada la siguiente)
  const [cycles,   setCycles]   = useState(4);

  function handleCreate() {
    if (!name.trim()) return;
    onCreate(name.trim(), sessions, cycles);
    setName(''); setSessions(3); setCycles(4);
    onClose();
  }

  return (
    // La hoja tiene su propio CTA abajo, así que el botón de la derecha del
    // encabezado pasa de "Aceptar" (que leería como un segundo submit) a
    // "Cancelar" — mismo recurso que la hoja de filtros del buscador.
    <DragSheet
      visible={visible}
      onClose={onClose}
      title={t('templates.newModal.title')}
      action={{ label: t('common.cancel'), onPress: onClose }}
    >
      <View style={styles.sheetBody}>
        <TextInput
          style={styles.sheetInput}
          value={name}
          onChangeText={setName}
          placeholder={t('templates.newModal.namePlaceholder')}
          placeholderTextColor={th.colors.mutedLight}
          returnKeyType="done"
        />

        <View>
          <Text style={styles.sheetLabel}>{t('templates.newModal.sessionsLabel')}</Text>
          <StepField
            horizontal
            label={t('templates.newModal.sessionsUnit')}
            value={sessions}
            onChange={setSessions}
            min={1}
            max={6}
          />
        </View>

        <View>
          <Text style={styles.sheetLabel}>{t('editor.cyclesQuestion')}</Text>
          {/* "Sin límite" es un estado del propio ajuste, no otra opción de una
              lista: va en el `Switch` compartido de `ui/EditorRows` y, cuando
              está activo, el stepper desaparece porque no hay número que contar.
              La explicación va DEBAJO del control, no entre el título y él. */}
          {cycles != null && (
            <StepField
              horizontal
              label={t('editor.stageWeeksUnit')}
              value={cycles}
              onChange={setCycles}
              min={1}
              max={52}
            />
          )}
          <View style={styles.toggleWrap}>
            <ToggleRow
              label={t('templates.newModal.noLimitLabel')}
              hint={t('editor.cyclesNoLimit')}
              value={cycles == null}
              onChange={(on) => setCycles(on ? null : 4)}
            />
          </View>
          <Text style={styles.sheetHint}>{t('editor.cyclesExplain')}</Text>
        </View>

        <TouchableOpacity
          style={[styles.cta, !name.trim() && styles.ctaDisabled]}
          onPress={handleCreate}
          disabled={!name.trim()}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaText, !name.trim() && styles.ctaTextDisabled]}>
            {t('templates.newModal.createBtn')}
          </Text>
        </TouchableOpacity>
      </View>
    </DragSheet>
  );
}

// ── Hoja de asignar a cliente ──────────────────────────────────────────────────

function AssignSheet({ visible, program, clients, programs, onAssign, onClose }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const clientList = useMemo(
    () => Object.values(clients ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );
  const [clientId,   setClientId]   = useState('');
  const [customName, setCustomName] = useState('');

  if (!program) return null;

  return (
    <DragSheet
      visible={visible}
      onClose={onClose}
      title={t('templates.assignModal.title')}
      action={{ label: t('common.cancel'), onPress: onClose }}
    >
      <View style={styles.sheetBody}>
        <View>
          <Text style={styles.assignName}>{program.name}</Text>
          <Text style={styles.sheetHint}>{t('templates.assignModal.desc')}</Text>
        </View>

        {clientList.length === 0 ? (
          <Text style={styles.sheetEmpty}>{t('templates.assignModal.noClients')}</Text>
        ) : (
          <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
            <View style={styles.clientList}>
              {clientList.map((c) => {
                const active   = clientId === c.id;
                const current  = c.activeProgramId ? programs[c.activeProgramId] : null;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.clientRow, active && styles.clientRowActive]}
                    onPress={() => setClientId(c.id)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
                      <Text style={[styles.clientName, active && { color: th.colors.accent }]} numberOfLines={1}>
                        {c.name}
                      </Text>
                      {/* El aviso de reemplazo se lee ANTES de asignar; por eso
                          esta pantalla ya no necesita el Alert de confirmación. */}
                      <Text style={current ? styles.clientReplaces : styles.clientSub} numberOfLines={1}>
                        {current
                          ? t('templates.assignModal.replaces', { name: current.name })
                          : t('templates.assignModal.noProgram')}
                      </Text>
                    </View>
                    {active && <Text style={styles.clientCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* El nombre de la copia lleva etiqueta de sección propia: dentro del
            campo, como placeholder, el input se leía como una fila más de la
            lista de clientes. Vacío = el nombre de la plantilla, que es lo que
            enseña el placeholder. */}
        <View>
          <Text style={styles.sheetLabel}>{t('templates.assignModal.programNameLabel')}</Text>
          <TextInput
            style={styles.sheetInput}
            placeholder={program.name}
            placeholderTextColor={th.colors.mutedLight}
            value={customName}
            onChangeText={setCustomName}
            returnKeyType="done"
          />
        </View>

        <TouchableOpacity
          style={[styles.cta, !clientId && styles.ctaDisabled]}
          onPress={() => clientId && onAssign(clientId, customName.trim() || program.name)}
          disabled={!clientId}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaText, !clientId && styles.ctaTextDisabled]}>
            {t('templates.assignModal.assignBtn')}
          </Text>
        </TouchableOpacity>
      </View>
    </DragSheet>
  );
}

// ── Hoja de confirmación de borrado ────────────────────────────────────────────

function ConfirmDeleteSheet({ visible, onClose, onConfirm }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return (
    <DragSheet visible={visible} onClose={onClose} title={t('templates.deleteTitle')}>
      <View style={styles.sheetBody}>
        <Text style={styles.sheetHint}>{t('templates.deleteConfirm')}</Text>
        <View style={styles.confirmRow}>
          <TouchableOpacity style={styles.confirmCancel} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.confirmCancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmDelete}
            onPress={() => { onClose(); onConfirm(); }}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmDeleteText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </DragSheet>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ProgramScreen() {
  const { t }       = useTranslation();
  const styles      = useThemedStyles(makeStyles);
  const insets      = useSafeAreaInsets();
  const navigation  = useNavigation();

  const [showCreate,   setShowCreate]   = useState(false);
  const [menuTarget,   setMenuTarget]   = useState(null); // programId del "···"
  const [assignTarget, setAssignTarget] = useState(null); // programId a asignar
  const [deleteTarget, setDeleteTarget] = useState(null); // programId a borrar
  const [showPaywall,  setShowPaywall]  = useState(false);

  const profile    = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const isPro      = profile?.isPro ?? false;

  const programs                 = useStore((s) => s.programs);
  const clients                  = useStore((s) => s.clients);
  const createEmptyProgram       = useStore((s) => s.createEmptyProgram);
  const cloneProgramFromTemplate = useStore((s) => s.cloneProgramFromTemplate);
  const deleteProgram            = useStore((s) => s.deleteProgram);
  const setEditingProgram        = useStore((s) => s.setEditingProgram);
  const setClientActiveProgram   = useStore((s) => s.setClientActiveProgram);
  const setPrintingProgram       = useStore((s) => s.setPrintingProgram);
  const exportSpecificProgram    = useStore((s) => s.exportSpecificProgram);
  const shareSpecificProgram     = useStore((s) => s.shareSpecificProgram);
  const showToast                = useStore((s) => s.showToast);

  const templateList = useMemo(() => templatesOf(programs), [programs]);

  function handleCreate(name, numSessions, durationWeeks) {
    const newId = createEmptyProgram(numSessions, name, 'template', durationWeeks);
    showToast(t('templates.toastCreated'), 2200, 'success');
    setEditingProgram(newId);
  }

  function handleDuplicate(programId) {
    const src = programs[programId];
    if (!src) return;
    cloneProgramFromTemplate(programId, { kind: 'template', name: src.name + t('templates.copyNameSuffix') });
    showToast(t('templates.toastDuplicated'), 2200, 'success');
  }

  function handleAssignToClient(clientId, programName) {
    if (!assignTarget) return;
    const newId = cloneProgramFromTemplate(assignTarget, {
      owner: clientId, name: programName,
    });
    if (newId) {
      // Asignar reemplaza el programa activo del cliente; el anterior sigue
      // siendo suyo (su `owner` no cambia), sólo pierde el activo.
      setClientActiveProgram(clientId, newId);
      setEditingProgram(newId);
      showToast(t('templates.toastAssigned'), 2200, 'success');
    }
    setAssignTarget(null);
  }

  function handleDelete(programId) {
    deleteProgram(programId, false);
    showToast(t('templates.toastDeleted'), 2200, 'neutral');
  }

  // ── PRO gate ───────────────────────────────────────────────────────────────
  if (!isPro) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <AppHeader />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('templates.proTitle')}</Text>
          <Text style={styles.emptyBody}>{t('templates.proBody')}</Text>
          <TouchableOpacity style={styles.cta} onPress={() => setShowPaywall(true)} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{t('templates.proCta')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.hideTabBtn}
            onPress={() => { setProfile({ proTabsHidden: true }); navigation.navigate('Home'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.hideTabBtnText}>{t('templates.hideTab')}</Text>
          </TouchableOpacity>
        </View>
        {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
      </View>
    );
  }

  const menuProgram = menuTarget ? programs[menuTarget] : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />

      {/* ── Cabecera: "PLANTILLAS · N" + "+ Plantilla" (misma de Clientes) ── */}
      <View style={styles.listHeader}>
        <View style={styles.listTitleRow}>
          <Text style={styles.listTitle} numberOfLines={1}>
            {t('templates.title').toUpperCase()} <Text style={styles.listTitleDot}>·</Text>{' '}
            <Text style={styles.listTitleCount}>{templateList.length}</Text>
          </Text>
          <TouchableOpacity style={styles.hdrNewBtn} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
            <Text style={styles.hdrNewBtnText}>{t('templates.newBtn')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {templateList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('templates.title')}</Text>
          <Text style={styles.emptyBody}>{t('templates.empty')}</Text>
          <TouchableOpacity style={styles.cta} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{t('templates.newModal.createBtn')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {templateList.map((program) => (
            <TemplateCard
              key={program.id}
              program={program}
              onAssign={() => setAssignTarget(program.id)}
              onMenu={() => setMenuTarget(program.id)}
            />
          ))}
        </ScrollView>
      )}

      <CreateSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />

      {/* ── Hoja del "···" ── */}
      <DragSheet
        visible={!!menuTarget}
        onClose={() => setMenuTarget(null)}
        title={menuProgram?.name ?? ''}
      >
        <View style={styles.sheetRows}>
          <SheetRow
            label={t('templates.actionView')}
            onPress={() => { const id = menuTarget; setMenuTarget(null); setPrintingProgram(id); }}
          />
          <SheetRow
            label={t('templates.actionEdit')}
            onPress={() => { const id = menuTarget; setMenuTarget(null); setEditingProgram(id); }}
          />
          <SheetRow
            label={t('templates.contextDuplicate')}
            onPress={() => { const id = menuTarget; setMenuTarget(null); handleDuplicate(id); }}
          />
          <SheetRow
            label={t('templates.actionShare')}
            onPress={() => { const id = menuTarget; setMenuTarget(null); shareSpecificProgram(id); }}
          />
          <SheetRow
            label={t('templates.contextExport')}
            onPress={() => { const id = menuTarget; setMenuTarget(null); exportSpecificProgram(id); }}
          />
          <SheetRow
            danger
            label={t('templates.contextDelete')}
            onPress={() => { const id = menuTarget; setMenuTarget(null); setDeleteTarget(id); }}
          />
        </View>
      </DragSheet>

      {/* Montada solo mientras hay destino: así la selección de cliente y el
          nombre de la copia arrancan en blanco en cada plantilla. */}
      {assignTarget && (
        <AssignSheet
          visible
          program={programs[assignTarget]}
          clients={clients}
          programs={programs}
          onAssign={handleAssignToClient}
          onClose={() => setAssignTarget(null)}
        />
      )}

      <ConfirmDeleteSheet
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },

  // ── Cabecera (calcada de la de Clientes) ──
  listHeader: {
    paddingTop: spacing.lg,
    gap:        spacing.sm,
  },
  listTitleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
  },
  listTitle:      { ...textStyles.hero, color: th.colors.text, flexShrink: 1 },
  listTitleDot:   { color: th.colors.mutedLight },
  listTitleCount: { color: th.colors.accent },
  hdrNewBtn: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.md,
    height:            42,
    alignItems:        'center',
    justifyContent:    'center',
  },
  hdrNewBtnText: { ...textStyles.cardType, color: th.colors.onAccent },

  // ── Lista ──
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.xxl,
    gap:               spacing.sm,
  },

  // ── Tarjeta de plantilla (`204:1901`) ──
  card: {
    flexDirection:   'row',
    alignItems:      'stretch',
    gap:             spacing.md,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
  },
  cardBody:  { flex: 1, minWidth: 0, justifyContent: 'center', gap: spacing.xs },
  cardName:  { ...textStyles.cardTitle, color: th.colors.text },
  statsRow:  { flexDirection: 'row', gap: 9 },
  stat:      { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  statValue: { ...textStyles.spacingTag, color: th.colors.accent },
  // Figma pone la etiqueta a `text/SmallBold` (8 px); subida a 10 en QA sin
  // cambiar familia ni tracking — a 8 px no se leía en dispositivo.
  statLabel: { ...textStyles.smallBold, fontSize: 10, color: th.colors.mutedLight, textTransform: 'uppercase' },

  cardActions: { alignItems: 'flex-end', justifyContent: 'center' },
  cardBtn: {
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cardBtnText: { ...textStyles.cardType, color: th.colors.text },

  // ── Hojas ──
  sheetBody: { gap: spacing.lg, paddingBottom: spacing.sm },
  sheetRows: { gap: spacing.sm, paddingBottom: spacing.sm },
  sheetRow: { ...sheetRowBase(th), justifyContent: 'space-between', gap: spacing.xl },
  sheetRowText: { ...textStyles.cardType, color: th.colors.text },
  sheetLabel: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  // Los textos de apoyo van a `text/subtitle` (12), no a `text/tag` (10): a 10
  // no se leían en dispositivo (QA).
  sheetHint:  { ...textStyles.subtitle, color: th.colors.mutedLight, lineHeight: 17 },
  sheetEmpty: { ...textStyles.subtitle, color: th.colors.mutedLight, textAlign: 'center', paddingVertical: spacing.md },
  // Dentro de una hoja el fondo YA es `bg`: los campos van sobre `surface`.
  sheetInput: {
    ...textStyles.cardType,
    color:             th.colors.text,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
  },
  // `ToggleRow` va a `radius/xxs` porque nace de la lista agrupada del editor de
  // ejercicio; suelta necesita el recorte del contenedor para redondearse.
  toggleWrap: {
    marginTop:    spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: th.radius.sm,
    overflow:     'hidden',
  },

  // Hoja de asignar
  assignName: { ...textStyles.cardTitle, color: th.colors.text, marginBottom: spacing.xs },
  clientList: { gap: spacing.sm },
  clientRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  clientRowActive: { backgroundColor: th.tint.accent10 },
  clientName:      { ...textStyles.cardType, color: th.colors.text },
  clientSub:       { ...textStyles.subtitle, color: th.colors.mutedLight },
  clientReplaces:  { ...textStyles.subtitle, color: th.colors.orange },
  clientCheck:     { ...textStyles.cardType, color: th.colors.accent },

  // Confirmación de borrado — mismo par que cierra el editor de ejercicio.
  confirmRow:    { flexDirection: 'row', gap: spacing.sm },
  confirmCancel: {
    flex:            1,
    paddingVertical: spacing.md,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
  },
  confirmCancelText: { ...textStyles.cardType, color: th.colors.text },
  confirmDelete: {
    flex:            1,
    paddingVertical: spacing.md,
    borderRadius:    th.radius.sm,
    backgroundColor: th.tint.red30,
    alignItems:      'center',
  },
  confirmDeleteText: { ...textStyles.cardType, color: th.tint.red50 },

  // CTA de hoja / estado vacío (Buttons `388:2676`)
  cta: {
    height:          44,
    borderRadius:    th.radius.md,
    backgroundColor: '#b8ff00', // literal de Figma, distinto de color/accent
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: spacing.xl,
  },
  ctaDisabled:     { backgroundColor: th.colors.surface2 },
  ctaText:         { ...textStyles.cardType, color: th.colors.onAccent },
  ctaTextDisabled: { color: th.colors.mutedLight },

  // ── Estado vacío / gate PRO ──
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap:            spacing.md,
  },
  emptyTitle: { ...textStyles.hero, color: th.colors.text },
  emptyBody: {
    ...textStyles.subtitle,
    color:        th.colors.mutedLight,
    textAlign:    'center',
    lineHeight:   18,
    marginBottom: spacing.sm,
  },
  hideTabBtn:     { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  hideTabBtnText: { ...textStyles.cardType, color: th.colors.mutedLight },
});
