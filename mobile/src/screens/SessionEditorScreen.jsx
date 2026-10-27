/**
 * SessionEditorScreen — editor de una sesión, rediseño FormaFit (Figma 208:1932).
 *
 * Estructura igual que el editor de programa: cabecera accent con el nombre
 * editable, segmented de sesiones hermanas, tarjeta de identidad (P16-03) y una única lista.
 *
 * La lista mezcla ejercicios y bloques de acondicionamiento en el mismo tipo de
 * fila (Figma no dibuja una fila distinta para bloques), numerados 01, 02… Una
 * superserie es UN número con letras (03A, 03B): sus filas van a 2px y con los
 * radios interiores a 2px, envueltas en una barra accent a la izquierda.
 *
 * Ojo con el orden: el mock coloca el bloque a media lista, pero la spec de
 * acondicionamiento manda (`docs/specs/T01-conditioning-blocks.md` §"Los bloques se
 * renderizan después de los ejercicios de fuerza") y WorkoutScreen ya lo hace
 * así, de modo que los bloques van siempre al final. La numeración sigue
 * corrida.
 */
import { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { Text } from '../components/ui/Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  useAnimatedRef, LayoutAnimationConfig,
} from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { exerciseLinkGroups } from '../utils/exerciseLinks';
import { sessionStats } from '../utils/sessionStats';
import { sessionSlots, slotsToArrays } from '../utils/sessionSlots';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import SegmentedControl from '../components/ui/SegmentedControl';
import SwipeRow from '../components/ui/SwipeRow';
import { MenuIcon, DragIcon, CloseIcon } from '../components/ui/EditorIcons';
import ScreenHeader from '../components/ui/ScreenHeader';
import EditorIdentityCard from '../components/editor/EditorIdentityCard';
import { SORTABLE_PROPS } from '../components/ui/sortable';
import DragSheet from '../components/DragSheet';
import SheetRow from '../components/ui/SheetRow';
import { EmptySlot } from '../components/ui/EmptyState';
import { Section } from '../components/ui/MenuList';
import { ROW_ICON } from '../components/ui/rowIcons';
import { generateId } from '../utils/formatters';
import { useEditorExit } from '../hooks/useEditorExit';
import { useEditorBase, clearEditorDraft, deleteWithUndo } from '../hooks/useEditorDraft';
import { rowEdited } from '../utils/editorDraft';
import { useEditorFold } from '../hooks/useEditorFold';
import { defaultBlock } from '../utils/conditioningBlocks';
import { sessionToText } from '../utils/sessionText';
import { sessionTag } from '../utils/editorIdentity';
import { isTrainerProgram } from '../utils/stageLocks';
import { variantLabel, displayVariant } from '../utils/variants';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { DEFAULT_TARGET } from '../utils/progression';

import { showDialog } from '../components/ui/dialog';
import { useSlidePages } from '../components/ui/useSlidePages';
// ─── Constantes ───────────────────────────────────────────────────────────────

// Separación entre huecos de la lista (space/sm) y entre miembros de una misma
// superserie (radius/xxs = 2, el valor que Figma usa también como gap).
const CARD_GAP = spacing.sm;

const SS_GAP   = 2;

// ─── Texto de las filas ───────────────────────────────────────────────────────

// Todo lo que antes eran badges (progresión, vinculación) pasa a metadato del
// subtítulo separado por puntos medios; la única pill que queda es la del
// formato de bloque.
function rowMeta(exConfig, t) {
  const timed = exConfig.inputType === 'time' || exConfig.inputType === 'weight_time';
  const minReps = exConfig.minReps ?? DEFAULT_TARGET.minReps;
  const maxReps = exConfig.maxReps ?? DEFAULT_TARGET.maxReps;
  const range = timed
    ? `${exConfig.minTime ?? 20}–${exConfig.maxTime ?? 40} s`
    : exConfig.progression?.type === 'effort'
      ? `${minReps} @RPE ${exConfig.progression.targetRpe ?? 8}`
      : minReps === maxReps ? `${minReps}` : `${minReps}–${maxReps}`;
  const parts = [`${exConfig.sets} × ${range}`, `${exConfig.restSec}s`];
  if (exConfig.isKey) parts.unshift(t('common.keyExercise'));
  return parts.join(' · ');
}

function blockMeta(block, t) {
  const count = block.movements?.length ?? 0;
  if (block.format === 'amrap') {
    return t('blocks.meta.amrap', { count, min: Math.round((block.capSec ?? 600) / 60) });
  }
  if (block.format === 'emom') {
    const mm = Math.floor((block.intervalSec ?? 60) / 60);
    const ss = (block.intervalSec ?? 60) % 60;
    return t('blocks.meta.emom', { count, n: block.rounds ?? 10, interval: `${mm}:${String(ss).padStart(2, '0')}` });
  }
  return t('blocks.meta.forTime', { count, rounds: block.rounds ?? 3 });
}

// ─── Fila ─────────────────────────────────────────────────────────────────────
// Deslizar a la derecha descubre sustituir/eliminar (se conserva del diseño
// anterior: Figma no dibuja esas acciones en ningún sitio). El asa de arrastre
// va a la derecha y es un `Sortable.Handle`: el gesto de reordenar vive SOLO
// ahí, así que no compite con este swipe horizontal ni con el ScrollView.

function EditorRow({
  number, name, variant, meta, edited, pill, radii, onPress,
  isOpen, onOpenChange, onSwipeDelete, onSubstitute,
}) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const actions = [];
  if (onSubstitute) actions.push({ label: t('editor.rowSubstitute'), onPress: onSubstitute, kind: 'neutral' });
  actions.push({ label: t('editor.rowDelete'), onPress: onSwipeDelete, kind: 'danger' });

  return (
    <SwipeRow
      actions={actions}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      leading={<Text style={styles.rowNumber}>{number}</Text>}
      onPress={onPress}
      radii={radii}
      handle={(
        <Sortable.Handle style={styles.dragHandle}>
          <DragIcon color={th.colors.mutedLight} />
        </Sortable.Handle>
      )}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Nombre y variante en UN texto de una línea: al cortarse por el
            final se pierde antes la variante que el nombre
            (P09-exercise-variants.md §4.2). */}
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
          {variant ? <Text style={styles.rowVariant}>{` · ${variant}`}</Text> : null}
        </Text>
        <Text style={[styles.rowMeta, edited && styles.rowMetaEdited]} numberOfLines={1}>{meta}</Text>
      </View>
      {pill ? (
        <View style={styles.pill}><Text style={styles.pillText}>{pill}</Text></View>
      ) : null}
    </SwipeRow>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function SessionEditorScreen({ navigation, route }) {
  const { templateId: initialTemplateId, programId, stageIdx = null, editorBase = false } = route.params ?? {};
  const { t, i18n } = useTranslation();
  const { fmt: fmtWeight } = useWeightUnit();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  // La sesión abierta es estado local (no un parámetro de ruta) para que el
  // segmented pueda cambiar de sesión sin apilar pantallas.
  const [templateId, setTemplateId] = useState(initialTemplateId);

  // Cambio de sesión: la página vieja sale por un lado y la nueva entra por el
  // otro, como un pager. No es un pager de verdad: la página va con
  // `key={templateId}` y se remonta entera, y así sus filas ya no hacen el
  // fundido de fábrica de la lista al cambiar de ids. +1 = la nueva está a la
  // derecha. 0 al abrir: la primera página no desliza.
  const { slide, pageEntering, pageExiting } = useSlidePages();

  const programs         = useStore((s) => s.programs);
  const exerciseLibrary  = useStore((s) => s.exerciseLibrary);
  const customExercises  = useStore((s) => s.customExercises);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const draft            = useStore((s) => s.ui._editorDraft);
  const removeExercise   = useStore((s) => s.removeExercise);
  const reorderExercise  = useStore((s) => s.reorderExercise);
  const renameSession    = useStore((s) => s.renameSession);
  const removeSessionFromProgram   = useStore((s) => s.removeSessionFromProgram);
  const duplicateSessionInProgram  = useStore((s) => s.duplicateSessionInProgram);
  const showToast        = useStore((s) => s.showToast);
  const blockPresets          = useStore((s) => s.blockPresets);
  const addBlockToSession     = useStore((s) => s.addBlockToSession);
  const removeBlockFromSession = useStore((s) => s.removeBlockFromSession);
  const reorderBlocks         = useStore((s) => s.reorderBlocks);
  const deleteBlockPreset     = useStore((s) => s.deleteBlockPreset);
  const deleteFreeTemplate    = useStore((s) => s.deleteFreeTemplate);
  const activeTemplateId      = useStore((s) => s.activeSession.templateId);
  const clientSync            = useStore((s) => s.clientSync);
  const { done }              = useEditorExit(navigation, templateId);

  const allExercises = { ...exerciseLibrary, ...customExercises };
  const template = sessionTemplates[templateId];

  // Base del editor (P16-01): quien abre esta pantalla desde fuera pasa
  // `editorBase`. Una sesión de programa copia el programa entero; una libre o
  // una plantilla, solo ella. Su chevron y el atrás ya cancelan por `beforeRemove`.
  const baseTpl = sessionTemplates[initialTemplateId];
  const { cancel } = useEditorBase(navigation, editorBase, !baseTpl ? null
    : baseTpl.programId ? { kind: 'program', id: baseTpl.programId } : { kind: 'template', id: initialTemplateId });
  const { folded, onScroll, onCardLayout } = useEditorFold();

  const program    = programs[programId];
  const stage      = stageIdx != null ? program?.stages?.[stageIdx] : null;
  const days       = stage?.days ?? [];
  const sessionIds = days.map((d) => d.sessionTemplateId);
  const canDelete  = sessionIds.length > 1;

  // Sesión libre (T06-free-sessions.md §5): sin programa, sin hermanas A/B/C.
  const isFree = !!template && !template.programId;

  // «Crear» da de alta la sesión antes de abrir el editor: si se sale sin
  // añadir nada, no puede quedar una sesión vacía en Inicio. Solo al desmontar
  // —las pantallas que se abren encima (selector, ejercicio) no lo desmontan.
  useEffect(() => () => {
    const st  = useStore.getState();
    const tpl = st.sessionTemplates[initialTemplateId];
    if (tpl && !tpl.programId && !tpl.exercises?.length && !tpl.blocks?.length) {
      st.deleteFreeTemplate(initialTemplateId);
    }
  }, [initialTemplateId]);

  const [openRowId, setOpenRowId]           = useState(null); // fila con el panel de acciones abierto
  const [presetSheetOpen, setPresetSheetOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen]     = useState(false);
  const [menuOpen, setMenuOpen]             = useState(false);

  // El ScrollView de la lista de huecos: `Sortable` lo necesita para hacer
  // autoscroll al arrastrar cerca del borde.
  const scrollRef = useAnimatedRef();

  function switchSession(id) {
    if (id === templateId) return;
    // Una copia recién creada aún no está en `sessionIds` (la lista es de antes de
    // duplicar): entra por la derecha.
    const to = sessionIds.indexOf(id);
    slide(to < 0 || to > sessionIds.indexOf(templateId) ? 1 : -1);
    setOpenRowId(null);
    setTemplateId(id);
  }

  if (!template) return null;

  const stats = sessionStats(template, allExercises);

  // ── Huecos: una superserie es UN hueco con varias filas, y los bloques se
  // mezclan con los ejercicios en el mismo orden que verá la pantalla de
  // entreno (ver `utils/sessionSlots.js`).
  const slots = sessionSlots(template);

  const getTpl = (tid) => sessionTemplates[tid];

  // Sesiones del programa con las que este ejercicio comparte configuración.
  function linkedSessions(exConfig) {
    if (!exConfig.linkGroup) return null;
    const group = exerciseLinkGroups(program, exConfig.exerciseId, getTpl)
      .find((g) => g.id === exConfig.linkGroup);
    const others = (group?.sessions ?? []).filter((s) => s !== template.label);
    return others.length > 0 ? others.join(', ') : null;
  }

  // Subtítulo completo: prescripción + progresión automática + vinculación.
  function metaFor(exConfig) {
    // Sin "prog. auto.": ocupaba un tercio de la línea para decir lo que es el
    // caso por defecto. Se sigue viendo al abrir el ejercicio.
    const parts = [rowMeta(exConfig, t)];
    const linked = linkedSessions(exConfig);
    if (linked) parts.push(t('editor.metaLinked', { sessions: linked }));
    return parts.join(' · ');
  }

  // ── Arrastre ──────────────────────────────────────────────────────────────
  // Cualquier hueco puede ir a cualquier posición: ejercicios y bloques se
  // mezclan libremente y ese orden es el que se entrena. Los huecos tienen
  // alturas distintas (una superserie ocupa el doble) — `Sortable.Grid` las mide
  // sola, así que aquí no hay que llevar ninguna geometría.
  function handleReorder({ data, key, fromIndex, toIndex }) {
    setOpenRowId(null);
    if (fromIndex === toIndex) return;

    // Mover un hueco puede cambiar a la vez el orden de los ejercicios y la
    // posición de los bloques, así que se escriben los dos arrays.
    const { exercises, blocks } = slotsToArrays(data);
    if (exercises.length > 0) reorderExercise(templateId, key, 'custom', exercises);
    if (blocks.length > 0)    reorderBlocks(templateId, blocks);
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  function handleRemoveExercise(exerciseId) {
    deleteWithUndo({
      kind: 'template', id: templateId, label: t('editor.toastUndo'),
      msg: t('editor.toastExDeleted', { name: allExercises[exerciseId]?.name ?? exerciseId }),
      remove: () => removeExercise(templateId, exerciseId),
    });
  }

  function openExercise(exerciseId) {
    navigation.navigate('ExerciseEditor', { templateId, exerciseId });
  }

  function openBlock(blockId) {
    navigation.navigate('BlockEditor', { templateId, blockId });
  }

  function handleAddExercise() {
    const existingPatterns = template.exercises
      .map((ex) => allExercises[ex.exerciseId]?.pattern)
      .filter(Boolean);
    navigation.navigate('ExerciseSelector', {
      templateId,
      existingPatterns,
      eyebrow: t('editor.sessionEyebrow', { label: template.label ?? '' }),
    });
  }

  function createNewBlock() {
    const block = defaultBlock();
    addBlockToSession(templateId, block);
    openBlock(block.id);
  }

  function handlePickPreset(preset) {
    const { presetId: _presetId, ...rest } = preset;
    const block = { ...rest, id: generateId('blk') };
    addBlockToSession(templateId, block);
    setPresetSheetOpen(false);
    openBlock(block.id);
  }

  function handleRemoveBlock(block) {
    showDialog(
      t('blocks.deleteBlock'),
      t('blocks.deleteConfirm', { name: block.name ?? t(`blocks.formats.${block.format}`) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('blocks.deleteBlock'), style: 'destructive',
          onPress: () => removeBlockFromSession(templateId, block.id),
        },
      ]
    );
  }

  function handleDeleteSession() {
    showDialog(
      t('editor.sessionDeleteBtn'),
      t('editor.sessionDeleteConfirm', { name: template.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('editor.sessionDeleteBtn'), style: 'destructive',
          onPress: () => {
            navigation.goBack();
            removeSessionFromProgram(programId, templateId);
          },
        },
      ]
    );
  }

  function handleDeleteFree() {
    setMenuOpen(false);
    if (activeTemplateId === templateId) {
      showDialog(t('freeSession.delete'), t('freeSession.deleteActive'));
      return;
    }
    showDialog(
      t('freeSession.delete'),
      t('freeSession.deleteConfirm', { name: template.name || t('freeSession.templateUnnamed') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('freeSession.delete'), style: 'destructive',
          onPress: () => {
            clearEditorDraft(); // ya confirmado: borrar no es un cambio que Cancelar deba preguntar
            navigation.goBack();
            deleteFreeTemplate(templateId);
          },
        },
      ]
    );
  }

  // La ceja de la tarjeta (y de la cabecera plegada): «Sesión A · Etapa 1», con
  // la etapa solo si el programa tiene más de una.
  const eyebrow = program?.stages?.length > 1 && stageIdx != null
    ? t('editor.idSessionStage', { label: template.label ?? '', n: stageIdx + 1 })
    : sessionTag(template, t);
  // El cliente con un programa del entrenador no lo renombra.
  const canRename = !isTrainerProgram(program, clientSync);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>

      {/* ── SesionHeader (208:2072) ── */}
      <ScreenHeader
        onBack={() => navigation.goBack()}
        // Dentro, vuelves al programa (la etapa ya la dice la ceja); la base se cancela.
        editor={{ base: editorBase, onCancel: cancel, onSave: done, backLabel: t('editor.idProgram'), folded }}
        eyebrow={eyebrow}
        title={isFree ? (template.name || t('freeSession.templateUnnamed')) : (template.name ?? '')}
        // «Guardar» (`onSave`) va el último: es la acción principal de la barra
        // y cae en el mismo sitio en las cuatro pantallas del editor.
        right={(ink) => (
          <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={12}>
            <MenuIcon color={ink} />
          </TouchableOpacity>
        )}
      />

      <Reanimated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ── Segmented de sesiones hermanas (210:2624) ── */}
        {sessionIds.length > 1 && (
          <SegmentedControl
            options={sessionIds.map((id) => ({ id, label: getTpl(id)?.label ?? '·' }))}
            value={templateId}
            onChange={switchSession}
          />
        )}

        <Reanimated.View key={templateId} style={styles.page} entering={pageEntering} exiting={pageExiting}>
          {/* Lo de dentro no hace su propio fundido al montarse o desmontarse con
              la página; lo que se añada o quite después, sí. */}
          <LayoutAnimationConfig skipEntering skipExiting>
            {/* ── Tarjeta de identidad (P16-03) ── */}
            <EditorIdentityCard
              eyebrow={eyebrow}
              name={template.name ?? ''}
              emptyName={isFree ? t('freeSession.templateUnnamed') : undefined}
              stats={[
                { n: stats.exercises, label: t('editor.idExercises', { count: stats.exercises }) },
                { n: stats.sets,      label: t('editor.idSets',      { count: stats.sets }) },
                stats.minutes > 0 && { n: stats.minutes, label: t('editor.idMin') },
              ].filter(Boolean)}
              onRename={canRename ? (name) => renameSession(templateId, name) : undefined}
              renameTitle={sessionTag(template, t)}
              onLayout={onCardLayout}
            />

            {/* ── Lista ── */}
            <View style={styles.section}>
              <Text style={styles.secTitle}>
                {t('editor.sectionExercises', { n: slots.length }).toUpperCase()}
              </Text>
              {slots.length === 0 && (
                <EmptySlot
                  title={t('empty.sessionSlotTitle')}
                  subtitle={t('empty.sessionSlotSub')}
                  onPress={handleAddExercise}
                />
              )}
              <Sortable.Grid
                {...SORTABLE_PROPS}
                data={slots}
                keyExtractor={(slot) => slot.id}
                rowGap={CARD_GAP}
                scrollableRef={scrollRef}
                onDragEnd={handleReorder}
                renderItem={({ item: slot, index }) => (
                  <Slot
                    slot={slot}
                    number={index + 1}
                    openRowId={openRowId}
                    setOpenRowId={setOpenRowId}
                    metaFor={metaFor}
                    allExercises={allExercises}
                    t={t}
                    draft={draft}
                    templateId={templateId}
                    onOpenExercise={openExercise}
                    onOpenBlock={openBlock}
                    onRemoveExercise={handleRemoveExercise}
                    onRemoveBlock={handleRemoveBlock}
                    onSubstitute={(exerciseId) => navigation.navigate('ExerciseSelector', {
                      templateId, currentExerciseId: exerciseId, existingPatterns: [],
                    })}
                  />
                )}
              />
            </View>

            {/* ── Añadir (210:2784) ── */}
            <TouchableOpacity style={styles.addBtn} onPress={() => setAddSheetOpen(true)} activeOpacity={0.7}>
              <Text style={styles.addBtnText}>
                <Text style={styles.addBtnPlus}>+</Text>{` ${t('editor.addLabel')}`}
              </Text>
            </TouchableOpacity>
          </LayoutAnimationConfig>
        </Reanimated.View>
      </Reanimated.ScrollView>

      {/* ── Hoja de "añadir" — el Alert nativo de Android no se puede estilar ── */}
      <DragSheet visible={addSheetOpen} onClose={() => setAddSheetOpen(false)} title={t('editor.addSheetTitle')}>
        <Section style={styles.sheetSection}>
          <SheetRow
            icon={ROW_ICON.exercise}
            label={t('editor.addExerciseOption')}
            onPress={handleAddExercise}
          />
          <SheetRow
            icon={ROW_ICON.block}
            label={t('editor.addBlockOption')}
            onPress={createNewBlock}
          />
          {blockPresets.length > 0 && (
            <SheetRow
              icon={ROW_ICON.preset}
              label={t('editor.addPresetOption')}
              onPress={() => setPresetSheetOpen(true)}
            />
          )}
        </Section>
      </DragSheet>

      {/* ── Menú "···" ── */}
      <DragSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={t('editor.sessionMenuTitle')}>
        <Section style={styles.sheetSection}>
          {/* Sin pesos: aquí no se sabe para quién es (C05-trainer-logging.md §5). */}
          <SheetRow
            icon={ROW_ICON.text}
            label={t('sessionText.menu')}
            onPress={() => {
              setMenuOpen(false);
              Share.share({
                message: sessionToText(template, allExercises, t, { language: i18n.language, fmtWeight }),
              }).catch(() => {});
            }}
          />
          {isFree && (
            <SheetRow
              icon={ROW_ICON.trash}
              label={t('freeSession.delete')}
              danger
              onPress={handleDeleteFree}
            />
          )}
          {!isFree && <SheetRow
            icon={ROW_ICON.duplicate}
            label={t('editor.sessionDuplicateBtn')}
            onPress={() => {
              const newId = duplicateSessionInProgram(programId, templateId);
              if (newId) {
                switchSession(newId);
                showToast(t('editor.toastSessionDuplicated'), 2200, 'success');
              }
            }}
          />}
          {canDelete && programId && (
            <SheetRow
              icon={ROW_ICON.trash}
              label={t('editor.sessionDeleteBtn')}
              danger
              onPress={handleDeleteSession}
            />
          )}
        </Section>
      </DragSheet>

      {/* ── Selector de preset ── */}
      <DragSheet
        visible={presetSheetOpen}
        onClose={() => setPresetSheetOpen(false)}
        title={t('blocks.fromPreset')}
      >
        <Section style={styles.sheetSection}>
          {blockPresets.map((preset) => (
            <SheetRow
              key={preset.presetId}
              icon={ROW_ICON.preset}
              label={preset.name ?? t(`blocks.formats.${preset.format}`)}
              sub={blockMeta(preset, t)}
              onPress={() => handlePickPreset(preset)}
              control={(
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => {
                    showDialog(
                      t('blocks.deletePreset'),
                      t('blocks.deleteConfirm', { name: preset.name ?? t(`blocks.formats.${preset.format}`) }),
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('blocks.deletePreset'), style: 'destructive', onPress: () => deleteBlockPreset(preset.presetId) },
                      ]
                    );
                  }}
                >
                  <CloseIcon size={14} color={th.colors.mutedLight} />
                </TouchableOpacity>
              )}
            />
          ))}
        </Section>
      </DragSheet>

    </SafeAreaView>
  );
}

// ─── Hueco de la lista ────────────────────────────────────────────────────────
// Un ejercicio suelto, un bloque, o una superserie (varias filas a 2px con los
// radios interiores a 2px y barra accent a la izquierda). El asa arrastra el
// hueco ENTERO: una superserie se mueve como una pieza.

function Slot({
  slot, number,
  openRowId, setOpenRowId, metaFor, allExercises, t, draft, templateId,
  onOpenExercise, onOpenBlock, onRemoveExercise, onRemoveBlock, onSubstitute,
}) {
  const styles = useThemedStyles(makeStyles);

  const pad = String(number).padStart(2, '0');

  const rows = slot.kind === 'block'
    ? [{
        key:    slot.block.id,
        number: pad,
        name:   slot.block.name ?? t(`blocks.formats.${slot.block.format}`),
        meta:   blockMeta(slot.block, t),
        edited: rowEdited(draft, templateId, slot.block),
        pill:   t(`blocks.formats.${slot.block.format}`).toUpperCase(),
        onPress:    () => onOpenBlock(slot.block.id),
        onDelete:   () => onRemoveBlock(slot.block),
        onSubstitute: null,
      }]
    : slot.members.map((ex, i) => ({
        key:    ex.exerciseId,
        // Una superserie comparte número y se distingue por letra (03A / 03B),
        // igual que la numeración de WorkoutScreen.
        number: slot.members.length > 1 ? `${pad}${String.fromCharCode(65 + i)}` : pad,
        name:   allExercises[ex.exerciseId]?.name ?? ex.exerciseId,
        variant: variantLabel(displayVariant(ex.variant, allExercises[ex.exerciseId]), t),
        meta:   metaFor(ex),
        edited: rowEdited(draft, templateId, ex),
        // "Principal" va en el subtítulo (`rowMeta`), no como pill: la única
        // pill que queda es la de formato de bloque, y "Principal" no cabe.
        pill:   null,
        onPress:      () => onOpenExercise(ex.exerciseId),
        onDelete:     () => onRemoveExercise(ex.exerciseId),
        onSubstitute: () => onSubstitute(ex.exerciseId),
      }));

  const isGroup = rows.length > 1;

  return (
    <View style={isGroup ? styles.ssGroup : null}>
      {rows.map((row, i) => (
        <EditorRow
          key={row.key}
          number={row.number}
          name={row.name}
          variant={row.variant}
          meta={row.meta}
          edited={row.edited}
          pill={row.pill}
          radii={isGroup ? groupRadii(i, rows.length) : null}
          onPress={row.onPress}
          isOpen={openRowId === row.key}
          onOpenChange={(open) => setOpenRowId(open ? row.key : null)}
          onSwipeDelete={row.onDelete}
          onSubstitute={row.onSubstitute}
        />
      ))}
    </View>
  );
}

// Radios de una fila dentro de una superserie: `sm` hacia fuera del grupo,
// `xxs` (2) hacia dentro — el mismo mecanismo que la "lista agrupada" pero con
// los extremos a `sm` en vez de `md`.
function groupRadii(i, n) {
  const OUT = 6;  // radius/sm
  const IN  = 2;  // radius/xxs
  return {
    borderTopLeftRadius:     i === 0 ? OUT : IN,
    borderTopRightRadius:    i === 0 ? OUT : IN,
    borderBottomLeftRadius:  i === n - 1 ? OUT : IN,
    borderBottomRightRadius: i === n - 1 ? OUT : IN,
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },

  // ── Contenido ──
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    gap:               spacing.md,
  },
  // Lo que desliza al cambiar de sesión: repite el gap del scroll.
  page: { gap: spacing.md },

  // Etiqueta de sección, igual que en el editor de programa.
  section:  { gap: spacing.xs2 },
  secTitle: {
    ...textStyles.caps,
    color:      th.colors.mutedLight,
    paddingTop: spacing.md,
  },

  // ── Fila ── (la tarjeta, el gesto y el panel de acciones viven en `ui/SwipeRow`)
  rowNumber: { ...textStyles.indexGlyphSm, color: th.colors.muted },
  rowName:   { ...textStyles.bodyStrong, color: th.colors.text },
  rowVariant: { ...textStyles.body, color: th.colors.mutedLight },
  // Sin `marginTop`: el hueco nombre→meta lo pone el interlineado y nada más,
  // igual que en las tarjetas de sesión del editor de programa (`sesMeta`).
  rowMeta:   { ...textStyles.label, color: th.colors.mutedLight },
  rowMetaEdited: { color: th.colors.accent },
  // El asa se agarra en toda la esquina derecha de la fila: el padding agranda la
  // zona de toque hasta los bordes de la tarjeta y los márgenes negativos lo
  // compensan, así que el icono no se mueve (QA P49: había que ser muy preciso).
  dragHandle: {
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
    paddingLeft:  spacing.md, marginLeft:  spacing.sm - spacing.md,
    paddingRight: spacing.md, marginRight: -spacing.md,
    paddingVertical: spacing.sm2, marginVertical: -spacing.sm2,
  },

  // Superserie: barra accent a la izquierda envolviendo el grupo (209:2479).
  ssGroup: {
    borderLeftWidth: 2,
    borderLeftColor: th.colors.accent,
    gap:             SS_GAP,
  },

  // Pill de formato de bloque (209:2508) — la única que queda en la lista.
  pill: {
    backgroundColor: th.tint.accent10,
    borderRadius:    th.radius.xs,
    padding:         spacing.sm,
  },
  pillText: { ...textStyles.label, color: th.colors.accent },

  // ── Añadir ── (texto plano, sin caja — así está ya en Figma)
  addBtn:      { alignItems: 'center', paddingVertical: spacing.md },
  addBtnText:  { ...textStyles.button, color: th.tint.accent50 },
  addBtnPlus:  { color: th.colors.accent },

  // ── Hojas ──
  sheetSection: { marginBottom: spacing.sm },
});
