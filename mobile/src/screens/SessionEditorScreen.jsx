/**
 * SessionEditorScreen — editor de una sesión, rediseño FormaFit (Figma 208:1932).
 *
 * Estructura igual que el editor de programa: cabecera accent con el nombre
 * editable, segmented de sesiones hermanas, tarjeta Resumen y una única lista.
 *
 * La lista mezcla ejercicios y bloques de acondicionamiento en el mismo tipo de
 * fila (Figma no dibuja una fila distinta para bloques), numerados 01, 02… Una
 * superserie es UN número con letras (03A, 03B): sus filas van a 2px y con los
 * radios interiores a 2px, envueltas en una barra accent a la izquierda.
 *
 * Ojo con el orden: el mock coloca el bloque a media lista, pero la spec de
 * acondicionamiento manda (`docs/specs/conditioning-blocks.md` §"Los bloques se
 * renderizan después de los ejercicios de fuerza") y WorkoutScreen ya lo hace
 * así, de modo que los bloques van siempre al final. La numeración sigue
 * corrida.
 */
import { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, PanResponder, Alert } from 'react-native';
import { Text } from '../components/ui/Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { exerciseLinkGroups } from '../utils/exerciseLinks';
import { sessionStats } from '../utils/sessionStats';
import { sessionSlots, slotsToArrays } from '../utils/sessionSlots';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import SegmentedControl from '../components/ui/SegmentedControl';
import { ArrowIcon, MenuIcon, DragIcon, CheckIcon } from '../components/ui/EditorIcons';
import ScreenHeader from '../components/ui/ScreenHeader';
import { SORTABLE_PROPS } from '../components/ui/sortable';
import DragSheet from '../components/DragSheet';
import SheetRow from '../components/ui/SheetRow';
import { generateId } from '../utils/formatters';
import { useEditorExit } from '../hooks/useEditorExit';
import { defaultBlock } from '../utils/conditioningBlocks';

// ─── Constantes ───────────────────────────────────────────────────────────────

// Los dos botones de acción, su separación y el aire que queda entre el último
// y la tarjeta ya deslizada. La tarjeta se esconde exactamente esa distancia.
const ACTION_BTN_WIDTH = 104;
const ACTION_GAP       = spacing.sm;
const ACTION_INSET     = spacing.md;
const SWIPE_OPEN       = ACTION_BTN_WIDTH * 2 + ACTION_GAP + ACTION_INSET;

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
  const range = timed
    ? `${exConfig.minTime ?? 20}–${exConfig.maxTime ?? 40} s`
    : exConfig.minReps && exConfig.maxReps
      ? `${exConfig.minReps}–${exConfig.maxReps}`
      : t('workout.submax', 'submáx');
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

// "Volumen: 10 series de tracción, 3 de pierna, 1 bloque" — sustituye a las
// pills por patrón muscular que había antes.
function volumeLine(patternSets, blockCount, t) {
  const entries = Object.entries(patternSets).sort((a, b) => b[1] - a[1]);
  const parts = entries.map(([pattern, sets], i) => {
    const name = t(`exerciseSelector.patterns.${pattern}`, pattern).toLowerCase();
    return i === 0
      ? t('editor.volumeFirst', { count: sets, pattern: name })
      : t('editor.volumeRest',  { count: sets, pattern: name });
  });
  if (blockCount > 0) parts.push(t('editor.volumeBlocks', { count: blockCount }));
  if (parts.length === 0) return null;
  return t('editor.volumeLine', { parts: parts.join(', ') });
}

// ─── Fila ─────────────────────────────────────────────────────────────────────
// Deslizar a la derecha descubre sustituir/eliminar (se conserva del diseño
// anterior: Figma no dibuja esas acciones en ningún sitio). El asa de arrastre
// va a la derecha y es un `Sortable.Handle`: el gesto de reordenar vive SOLO
// ahí, así que no compite con este swipe horizontal ni con el ScrollView.

function EditorRow({
  number, name, meta, pill, radii, onPress,
  isOpen, onOpenChange, onSwipeDelete, onSubstitute,
}) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  // Inicializador perezoso en vez de useRef: el valor es igual de estable y
  // no se lee ningún `.current` durante el render.
  const [dragX] = useState(() => new Animated.Value(0));
  const openRef = useRef(false);

  const cbs = useRef({ onOpenChange, onPress });
  useEffect(() => { cbs.current = { onOpenChange, onPress }; });

  // Otra fila se abrió (o una acción cerró ésta) — ciérrala.
  useEffect(() => {
    if (!isOpen && openRef.current) {
      openRef.current = false;
      Animated.spring(dragX, { toValue: 0, useNativeDriver: false, tension: 80 }).start();
    }
  }, [isOpen, dragX]);

  /* eslint-disable-next-line react-hooks/refs */
  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => !openRef.current && gs.dx > 8 && gs.dx > Math.abs(gs.dy) * 1.3,
    onPanResponderMove: (_, gs) => {
      if (gs.dx > 0) dragX.setValue(Math.min(gs.dx, SWIPE_OPEN));
    },
    onPanResponderRelease: (_, gs) => {
      const opening = gs.dx >= SWIPE_OPEN / 2;
      openRef.current = opening;
      Animated.spring(dragX, { toValue: opening ? SWIPE_OPEN : 0, useNativeDriver: false, tension: 80 }).start();
      cbs.current.onOpenChange(opening);
    },
    onPanResponderTerminate: () => {
      if (!openRef.current) Animated.spring(dragX, { toValue: 0, useNativeDriver: false }).start();
    },
  }));

  function closeRow() {
    openRef.current = false;
    Animated.spring(dragX, { toValue: 0, useNativeDriver: false, tension: 80 }).start();
    cbs.current.onOpenChange(false);
  }

  return (
    <View style={{ position: 'relative' }}>
      <View style={styles.actionPanel} pointerEvents="box-none">
        {onSubstitute && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSubstitute]}
            onPress={() => { closeRow(); onSubstitute(); }}
            activeOpacity={0.75}
          >
            <Text style={styles.actionBtnSubstituteText}>{t('editor.rowSubstitute')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnDelete]}
          onPress={() => { closeRow(); onSwipeDelete(); }}
          activeOpacity={0.75}
        >
          <Text style={styles.actionBtnDeleteText}>{t('editor.rowDelete')}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.row, radii, { transform: [{ translateX: dragX }] }]}
        {...pan.panHandlers}
      >
        {isOpen ? (
          // Abierta, el número se cambia por una flecha hacia atrás: es la pista
          // de que la tarjeta se devuelve a su sitio tocándola.
          <View style={styles.rowNumberSlot}>
            <ArrowIcon size={16} color={th.colors.mutedLight} back />
          </View>
        ) : (
          <Text style={styles.rowNumber}>{number}</Text>
        )}
        <TouchableOpacity
          style={styles.rowBody}
          onPress={() => { if (openRef.current) closeRow(); else cbs.current.onPress(); }}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text>
          </View>
          {pill ? (
            <View style={styles.pill}><Text style={styles.pillText}>{pill}</Text></View>
          ) : null}
        </TouchableOpacity>
        <Sortable.Handle style={styles.dragHandle}>
          <DragIcon color={th.colors.mutedLight} />
        </Sortable.Handle>
      </Animated.View>
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function SessionEditorScreen({ navigation, route }) {
  const { templateId: initialTemplateId, programId, stageIdx = null } = route.params ?? {};
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  // La sesión abierta es estado local (no un parámetro de ruta) para que el
  // segmented pueda cambiar de sesión sin apilar pantallas.
  const [templateId, setTemplateId] = useState(initialTemplateId);

  const programs         = useStore((s) => s.programs);
  const exerciseLibrary  = useStore((s) => s.exerciseLibrary);
  const customExercises  = useStore((s) => s.customExercises);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
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
  const { done }              = useEditorExit(navigation);

  const allExercises = { ...exerciseLibrary, ...customExercises };
  const template = sessionTemplates[templateId];

  const program    = programs[programId];
  const stage      = stageIdx != null ? program?.stages?.[stageIdx] : null;
  const days       = stage?.days ?? [];
  const sessionIds = days.map((d) => d.sessionTemplateId);
  const canDelete  = sessionIds.length > 1;

  const [openRowId, setOpenRowId]           = useState(null); // fila con el panel de acciones abierto
  const [presetSheetOpen, setPresetSheetOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen]     = useState(false);
  const [menuOpen, setMenuOpen]             = useState(false);
  const [editingName, setEditingName]       = useState(false);
  const [nameValue, setNameValue]           = useState('');

  // El ScrollView de la lista de huecos: `Sortable` lo necesita para hacer
  // autoscroll al arrastrar cerca del borde.
  const scrollRef = useAnimatedRef();

  function switchSession(id) {
    if (id === templateId) return;
    setEditingName(false);
    setOpenRowId(null);
    setTemplateId(id);
  }

  if (!template) return null;

  const stats = sessionStats(template, allExercises);
  const volume = volumeLine(stats.patternSets, template.blocks?.length ?? 0, t);

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
    removeExercise(templateId, exerciseId);
    showToast(t('editor.toastExDeleted'), 2200, 'neutral');
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
    navigation.navigate('ExerciseSelector', { templateId, existingPatterns });
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
    Alert.alert(
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
    Alert.alert(
      t('editor.sessionDeleteBtn'),
      `¿Eliminar "${template.name}"?`,
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

  function commitName() {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== template.name) renameSession(templateId, trimmed);
  }

  function startEditName() {
    setNameValue(template.name ?? '');
    setEditingName(true);
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>

      {/* ── SesionHeader (208:2072) ── */}
      <ScreenHeader
        onBack={() => navigation.goBack()}
        eyebrow={t('editor.sessionEyebrow', { label: template.label ?? '' })}
        title={template.name ?? ''}
        renaming={editingName}
        draft={nameValue}
        onDraftChange={setNameValue}
        onRenameStart={startEditName}
        onRenameCommit={commitName}
        // El check va el último: es la acción principal de la barra y cae bajo
        // el pulgar en el mismo sitio en las cuatro pantallas del editor.
        right={(ink) => (
          <>
            <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={12}>
              <MenuIcon color={ink} />
            </TouchableOpacity>
            <TouchableOpacity onPress={done} hitSlop={12} accessibilityRole="button">
              <CheckIcon size={20} color={th.colors.accent} />
            </TouchableOpacity>
          </>
        )}
      />

      <Reanimated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Segmented de sesiones hermanas (210:2624) ── */}
        {sessionIds.length > 1 && (
          <SegmentedControl
            options={sessionIds.map((id) => ({ id, label: getTpl(id)?.label ?? '·' }))}
            value={templateId}
            onChange={switchSession}
          />
        )}

        {/* ── Resumen (208:1936) ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTag}>{t('editor.summarySession', { label: template.label ?? '' })}</Text>
          <Text style={styles.summaryMain}>
            {stats.minutes > 0
              ? t('editor.sessionMeta',       { ex: stats.exercises, sets: stats.sets, min: stats.minutes })
              : t('editor.sessionMetaNoTime', { ex: stats.exercises, sets: stats.sets })}
          </Text>
          {volume && <Text style={styles.summaryVolume}>{volume}</Text>}
        </View>

        {/* ── Lista ── */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>
            {t('editor.sectionExercises', { n: slots.length }).toUpperCase()}
          </Text>
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
      </Reanimated.ScrollView>

      {/* ── Hoja de "añadir" — el Alert nativo de Android no se puede estilar ── */}
      <DragSheet visible={addSheetOpen} onClose={() => setAddSheetOpen(false)} title={t('editor.addSheetTitle')}>
        <View style={styles.sheetBody}>
          <SheetRow
            label={t('editor.addExerciseOption')}
            onPress={handleAddExercise}
          />
          <SheetRow
            label={t('editor.addBlockOption')}
            onPress={createNewBlock}
          />
          {blockPresets.length > 0 && (
            <SheetRow
              label={t('editor.addPresetOption')}
              onPress={() => setPresetSheetOpen(true)}
            />
          )}
        </View>
      </DragSheet>

      {/* ── Menú "···" ── */}
      <DragSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={t('editor.sessionMenuTitle')}>
        <View style={styles.sheetBody}>
          {/* Sin lápiz en la cabecera, esto es lo que recuerda que el nombre se
              puede cambiar; el toque sobre el propio nombre sigue valiendo. */}
          <SheetRow
            label={t('editor.renameOption')}
            onPress={startEditName}
          />
          <SheetRow
            label={t('editor.sessionDuplicateBtn')}
            onPress={() => {
              const newId = duplicateSessionInProgram(programId, templateId);
              if (newId) {
                switchSession(newId);
                showToast(t('editor.toastSessionDuplicated'), 2200, 'success');
              }
            }}
          />
          {canDelete && programId && (
            <SheetRow
              label={t('editor.sessionDeleteBtn')}
              danger
              onPress={handleDeleteSession}
            />
          )}
        </View>
      </DragSheet>

      {/* ── Selector de preset ── */}
      <DragSheet
        visible={presetSheetOpen}
        onClose={() => setPresetSheetOpen(false)}
        title={t('blocks.fromPreset')}
      >
        <View style={styles.sheetBody}>
          {blockPresets.map((preset) => (
            <View key={preset.presetId} style={styles.presetRow}>
              <TouchableOpacity
                style={{ flex: 1, minWidth: 0 }}
                onPress={() => handlePickPreset(preset)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetName} numberOfLines={1}>
                  {preset.name ?? t(`blocks.formats.${preset.format}`)}
                </Text>
                <Text style={styles.presetMeta}>{blockMeta(preset, t)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                hitSlop={8}
                onPress={() => {
                  Alert.alert(
                    t('blocks.deletePreset'),
                    t('blocks.deleteConfirm', { name: preset.name ?? t(`blocks.formats.${preset.format}`) }),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('blocks.deletePreset'), style: 'destructive', onPress: () => deleteBlockPreset(preset.presetId) },
                    ]
                  );
                }}
              >
                <Text style={styles.presetRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
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
  openRowId, setOpenRowId, metaFor, allExercises, t,
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
        meta:   metaFor(ex),
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
          meta={row.meta}
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

  // Etiqueta de sección, igual que en el editor de programa.
  section:  { gap: spacing.xs2 },
  secTitle: {
    ...textStyles.caps,
    color:      th.colors.mutedLight,
    paddingTop: spacing.md,
  },

  // ── Resumen ── (sin borde: en Figma es solo relleno tint/accent-10)
  summaryCard: {
    backgroundColor:   th.tint.accent10,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  summaryTag:    { ...textStyles.caps, color: th.colors.accent },
  summaryMain:   { ...textStyles.bodyStrong, color: th.colors.text },
  summaryVolume: { ...textStyles.label, color: th.tint.accent50 },

  // ── Fila ──
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm2,
  },
  // 12 es literal de Figma (no hay token); el asa va a `space/sm` del contenido.
  rowNumber: { ...textStyles.labelStrong, color: th.colors.accent, marginRight: 12 },
  rowNumberSlot: { marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  rowBody:   { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowName:   { ...textStyles.bodyStrong, color: th.colors.text },
  // Sin `marginTop`: el hueco nombre→meta lo pone el interlineado y nada más,
  // igual que en las tarjetas de sesión del editor de programa (`sesMeta`).
  rowMeta:   { ...textStyles.label, color: th.colors.mutedLight },
  dragHandle: {
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
    marginLeft: spacing.sm,
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

  // Panel de acciones bajo la fila, descubierto al deslizar. Son botones con el
  // lenguaje de la app (radius/sm + text/card-type), no bloques de color a sangre.
  actionPanel: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    flexDirection: 'row', width: SWIPE_OPEN,
    gap: ACTION_GAP,
    // Aire por dentro: los botones no llegan al alto de la fila ni se pegan a
    // la tarjeta cuando ésta termina de deslizarse.
    paddingVertical: spacing.sm,
    paddingRight:    ACTION_INSET,
  },
  actionBtn: {
    width: ACTION_BTN_WIDTH,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: th.radius.sm,
    paddingHorizontal: spacing.lg,
  },
  // `surface2`: el mismo relleno que los botones Secondary de Figma.
  actionBtnSubstitute:     { backgroundColor: th.colors.surface2 },
  actionBtnSubstituteText: { ...textStyles.labelStrong, color: th.colors.text, textAlign: 'center' },
  actionBtnDelete:         { backgroundColor: th.tint.red30 },
  actionBtnDeleteText:     { ...textStyles.labelStrong, color: th.tint.red50, textAlign: 'center' },

  // ── Añadir ── (texto plano, sin caja — así está ya en Figma)
  addBtn:      { alignItems: 'center', paddingVertical: spacing.md },
  addBtnText:  { ...textStyles.button, color: th.tint.accent50 },
  addBtnPlus:  { color: th.colors.accent },

  // ── Hojas ──
  sheetBody: { paddingBottom: spacing.sm, gap: spacing.md },
  presetRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: th.colors.surface2,
    borderRadius: th.radius.sm,
    padding: spacing.md,
  },
  presetName:   { ...textStyles.bodyStrong, color: th.colors.text },
  // Mismo par nombre+meta que `rowMeta`: sin margen, lo separa el interlineado.
  presetMeta:   { ...textStyles.label, color: th.colors.mutedLight },
  presetRemove: { ...textStyles.body, color: th.colors.muted, padding: spacing.xs },
});
