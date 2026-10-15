/**
 * Buscador de ejercicios — rediseño FormaFit.
 *
 * Dos modos, mismo layout:
 *   - AÑADIR (por defecto): multiselección con checkbox y botón 'Añadir' en
 *     la cabecera — el CTA de abajo se quitó: con el teclado desplegado, que es
 *     mientras buscas, casi nunca estaba a la vista.
 *   - SUSTITUIR / picker de bloque: selección única, chevron a la derecha, se
 *     elige y se cierra. Arranca con la pill del patrón del ejercicio actual
 *     ya activa (sustituye al viejo modo "Similar", que además filtraba por
 *     nivel sin que se viera en ningún sitio).
 *
 * Filtros: fila de pills de patrón (single-select, siempre visible) + hoja de
 * filtros (`DragSheet`) con grupo muscular / equipo / tipo en multiselección.
 * El badge del botón de filtro cuenta solo los de la hoja, no la pill.
 *
 * La cabecera es el `ScreenHeader` del editor: la ceja ("Editar sesión A",
 * "SESIÓN A") la pasa quien abre el selector por params.
 *
 * El modo "Complementario" (ordenar por patrones que faltan en la sesión) se
 * elimina: `existingPatterns` sigue llegando por params pero ya no se usa.
 */
import { useState, useMemo } from 'react';
import { View, TouchableOpacity, FlatList, ScrollView, StyleSheet } from 'react-native';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text, TextInput } from '../components/ui/Text';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { spacing, textStyles, withOpacity, getCardRadii } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import DragSheet from '../components/DragSheet';
import ScreenHeader from '../components/ui/ScreenHeader';
import { ArrowIcon, CloseIcon } from '../components/ui/EditorIcons';
import RoundCheck from '../components/ui/RoundCheck';
import {
  PATTERN_GROUPS, GROUP_OF_PATTERN, muscleGroupIdsOf, equipmentOf, EQUIPMENT,
} from '../utils/exerciseTaxonomy';
import { filterBySearch } from '../utils/searchText';
import { splitHit } from '../utils/onboardingBuilder';

// El buscador filtra por grupo muscular abriendo 'arms' en Bíceps/Tríceps
// (ver `muscleGroupIdsOf`) — no existe como `primaryGroup` real, solo aquí.
const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'glutes_hamstrings', 'legs_lower', 'core', 'grip', 'full_body',
];

// ─── ExerciseSelectorScreen ───────────────────────────────────────────────────

export default function ExerciseSelectorScreen({ navigation, route }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {
    templateId,
    currentExerciseId = null,
    sessionMode = false,   // true → add to active session (adHoc), not to the template
    blockPicker = false,   // true → picking a movement for a conditioning block (see BlockEditorInline)
    // La ceja de la cabecera la pasa quien abre el selector ('Editar sesión A',
    // 'SESIÓN A' en el entreno): el selector no sabe de dónde viene y sin ella
    // se pierde el hilo de qué estás editando. Sin ceja, sólo el título.
    eyebrow = null,
    // Quien usa el modo de elegir uno (`blockPicker`) para otra cosa dice qué
    // se elige: «Sustituir ejercicio» no vale para resolver un nombre pegado.
    title: titleOverride = null,
    // La búsqueda ya escrita: el nombre que no se reconoció en un texto pegado.
    search: initialSearch = '',
  } = route.params ?? {};

  const language = useStore((s) => s.profile.language);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const programs         = useStore((s) => s.programs);
  const activeSession    = useStore((s) => s.activeSession);
  const addExercise      = useStore((s) => s.addExercise);
  const replaceExercise  = useStore((s) => s.replaceExercise);
  const addAdHocExercise = useStore((s) => s.addAdHocExercise);
  const setBlockPickerResult = useStore((s) => s.setBlockPickerResult);
  const showToast        = useStore((s) => s.showToast);

  const allLibrary = useMemo(() => ({ ...exerciseLibrary, ...customExercises }), [exerciseLibrary, customExercises]);

  // Lo que ya está en el destino no se ofrece. `setsState` va indexado por
  // exerciseId, así que dos instancias del mismo ejercicio comparten series,
  // "hecho" y borrado (fallo 15). Aquí se corta el único camino por el que la
  // app podía crearlas: añadir y también SUSTITUIR por uno que ya está.
  // El picker de bloques queda fuera: ahí repetir movimiento es legítimo.
  const tplId = sessionMode ? activeSession.templateId : templateId;
  const taken = useMemo(() => {
    if (blockPicker) return new Set();
    return new Set([
      ...(sessionTemplates[tplId]?.exercises ?? []).map((ex) => ex.exerciseId),
      ...(sessionMode ? (activeSession.adHocExercises ?? []).map((ex) => ex.exerciseId) : []),
    ]);
  }, [blockPicker, sessionMode, tplId, sessionTemplates, activeSession]);

  // En qué OTRAS sesiones está cada ejercicio: { exerciseId: ['B', 'C'] }. Solo
  // las hermanas de la misma etapa (o del programa, si no tiene etapas): las de
  // otra etapa son otro bloque de entreno y meterían ruido.
  const inSiblings = useMemo(() => {
    const map = {};
    if (blockPicker || !tplId) return map;
    const groups = Object.values(programs ?? {}).flatMap((pr) =>
      pr?.stages?.length ? pr.stages.map((st) => st.days ?? []) : [pr?.days ?? []]);
    const days = groups.find((g) => g.some((d) => d.sessionTemplateId === tplId)) ?? [];
    days.filter((d) => d.sessionTemplateId !== tplId).forEach((d) => {
      const tpl = sessionTemplates[d.sessionTemplateId];
      if (!tpl?.label) return;
      tpl.exercises.forEach((ex) => {
        const labels = (map[ex.exerciseId] ??= []);
        if (!labels.includes(tpl.label)) labels.push(tpl.label);
      });
    });
    Object.values(map).forEach((labels) => labels.sort());
    return map;
  }, [blockPicker, tplId, programs, sessionTemplates]);

  const currentDef = currentExerciseId ? allLibrary[currentExerciseId] : null;

  // Multi-select only when ADDING (replace/block-picker modes stay a single pick).
  const multiSelect = !currentExerciseId && !blockPicker;

  const [search, setSearch] = useState(initialSearch);
  const [patternGroup, setPatternGroup] = useState(
    currentDef ? (GROUP_OF_PATTERN[currentDef.pattern] ?? '') : ''
  );
  const [groupFilter, setGroupFilter] = useState([]);
  const [equipFilter, setEquipFilter] = useState([]);
  const [typeFilter,  setTypeFilter]  = useState([]);   // 'compound' | 'isolation'
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const activeFilterCount = groupFilter.length + equipFilter.length + typeFilter.length;
  const toggleIn = (setter) => (value) =>
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  function clearFilters() {
    setGroupFilter([]);
    setEquipFilter([]);
    setTypeFilter([]);
  }

  function handleAddSelected() {
    if (!selectedIds.length) return;
    selectedIds.forEach((id) => (sessionMode ? addAdHocExercise(id) : addExercise(templateId, id)));
    showToast(t('exerciseSelector.addedN', { count: selectedIds.length }), 2200, 'success');
    navigation.goBack();
  }

  function handleSelect(exerciseId) {
    if (blockPicker) {
      setBlockPickerResult(exerciseId);
    } else if (sessionMode) {
      addAdHocExercise(exerciseId);
      showToast(t('editor.toastExAdded'), 2200, 'success');
    } else if (currentExerciseId) {
      replaceExercise(templateId, currentExerciseId, exerciseId);
      showToast(t('exerciseEditor.toastSubstituted'), 2200, 'success');
    } else {
      addExercise(templateId, exerciseId);
      showToast(t('editor.toastExAdded'), 2200, 'success');
    }
    navigation.goBack();
  }

  const getExName = (ex) => (language === 'en' ? (ex.nameEn ?? ex.name) : ex.name);

  const allExercises = useMemo(() => Object.values(allLibrary), [allLibrary]);

  // Lo que ya está en esta sesión sigue saliendo, apagado: si lo buscas, sabes
  // que ya lo tienes en vez de ver «Sin resultados».
  const filtered = useMemo(() => {
    const byFilters = allExercises
      .filter((ex) => ex.id !== currentExerciseId)
      .filter((ex) => !patternGroup || GROUP_OF_PATTERN[ex.pattern] === patternGroup)
      .filter((ex) => !groupFilter.length || muscleGroupIdsOf(ex).some((id) => groupFilter.includes(id)))
      .filter((ex) => !equipFilter.length || equipmentOf(ex).some((e) => equipFilter.includes(e)))
      .filter((ex) => !typeFilter.length || typeFilter.includes(ex.isCompound ? 'compound' : 'isolation'));
    return filterBySearch(byFilters, search, (ex) => [ex.name, ex.nameEn, ...(ex.aliases ?? [])].filter(Boolean).join(' '))
      .sort((a, b) => getExName(a).localeCompare(getExName(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, patternGroup, groupFilter, equipFilter, typeFilter, allExercises, currentExerciseId, language]);

  // Sin buscar ni filtrar, primero lo que ya usas en las otras sesiones: casi
  // siempre se añade algo de ahí. Las filas llevan su posición en el bloque
  // (radios por extremos) y las cabeceras van como filas más de la lista.
  const browsing = !search.trim() && !patternGroup && !activeFilterCount;
  const rows = useMemo(() => {
    const block = (list) => list.map((ex, i) => ({ key: ex.id, ex, first: i === 0, last: i === list.length - 1 }));
    if (!browsing) {
      return filtered.length
        ? [{ key: 'h-count', header: t('exerciseSelector.exerciseCount', { count: filtered.length }) }, ...block(filtered)]
        : [];
    }
    const mine = filtered.filter((ex) => inSiblings[ex.id] && !taken.has(ex.id));
    const rest = filtered.filter((ex) => !mine.includes(ex));
    return [
      ...(mine.length ? [{ key: 'h-program', header: t('exerciseSelector.sectionProgram', { count: mine.length }) }, ...block(mine)] : []),
      { key: 'h-all', header: t('exerciseSelector.sectionAll', { count: rest.length }), gap: mine.length > 0 },
      ...block(rest),
    ];
  }, [browsing, filtered, inSiblings, taken, t]);

  const joinList = (items) => items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join(', ')}${t('exerciseSelector.listAnd')}${items[items.length - 1]}`;

  function toggleSelected(id) {
    Haptics.selectionAsync().catch(() => {});
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const renderItem = ({ item }) => {
    if (item.header) {
      return <Text style={[styles.sectionLabel, item.gap && styles.sectionLabelGap]}>{item.header}</Text>;
    }
    const { ex, first, last } = item;
    const isTaken = taken.has(ex.id);
    const isSel = multiSelect && selectedIds.includes(ex.id);
    const others = inSiblings[ex.id] ?? [];
    const name = getExName(ex);
    const q = search.trim();

    return (
      <TouchableOpacity
        style={[styles.exRow, getCardRadii(th, first, last), isSel && styles.exRowSel]}
        onPress={() => (multiSelect ? toggleSelected(ex.id) : handleSelect(ex.id))}
        disabled={isTaken}
        activeOpacity={0.7}
      >
        <View style={[{ flex: 1, minWidth: 0 }, isTaken && styles.exTaken]}>
          <View style={styles.exNameRow}>
            <Text style={styles.exName} numberOfLines={1}>
              {q ? splitHit(name, q).map((p, i) => (p.hit ? <Text key={i} style={[styles.exName, styles.exHit]}>{p.text}</Text> : p.text)) : name}
            </Text>
            {ex.isCustom && (
              <View style={styles.customBadge}><Text style={styles.customBadgeText}>{t('exerciseSelector.customBadge')}</Text></View>
            )}
          </View>
          <Text style={styles.exMeta} numberOfLines={1}>
            {isTaken ? t('exerciseSelector.alreadyHere') : (
              <>
                {t(`exerciseSelector.groups.${ex.primaryGroup}`, ex.primaryGroup)}
                {' · '}
                {equipmentOf(ex).map((e) => t(`exerciseSelector.equipment.${e}`, e)).join(', ')}
                {others.length > 0 && (
                  <>
                    {' · '}
                    <Text style={[styles.exMeta, styles.exIn]}>{t('exerciseSelector.inSessions', { list: joinList(others) })}</Text>
                  </>
                )}
              </>
            )}
          </Text>
        </View>

        {multiSelect || isTaken
          ? <RoundCheck on={isSel} done={isTaken} />
          : <ArrowIcon size={16} color={th.colors.mutedLight} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {/* La misma cabecera que el resto del editor. El botón 'Añadir' ocupa el
          hueco del check: es la acción de la pantalla y con el teclado abierto
          es lo único que sigue a la vista (el CTA de abajo quedaba tapado). */}
      <ScreenHeader
        onBack={() => navigation.goBack()}
        eyebrow={eyebrow}
        title={
          titleOverride ?? (multiSelect
            ? (selectedIds.length
                ? t('exerciseSelector.addedN', { count: selectedIds.length })
                : t('exerciseSelector.titleAdd'))
            : t('exerciseSelector.titleReplace'))
        }
        right={multiSelect ? (
          <TouchableOpacity
            style={[styles.addBtn, !selectedIds.length && styles.addBtnOff]}
            onPress={handleAddSelected}
            disabled={!selectedIds.length}
            activeOpacity={0.85}
          >
            <Text style={[styles.addBtnText, !selectedIds.length && styles.addBtnTextOff]}>
              {selectedIds.length
                ? t('exerciseSelector.addActionN', { count: selectedIds.length })
                : t('exerciseSelector.addAction')}
            </Text>
          </TouchableOpacity>
        ) : undefined}
      />

      {/* Buscador + filtros (barra estándar: surface2, radius/sm, h42) */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Svg viewBox="0 0 24 24" width={17} height={17} fill="none"
            stroke={th.colors.mutedLight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35" />
          </Svg>
          <TextInput
            style={styles.searchInput}
            placeholder={t('exerciseSelector.searchPlaceholder2')}
            placeholderTextColor={th.colors.mutedLight}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8} style={styles.searchClearBtn}>
              <CloseIcon size={16} color={th.colors.mutedLight} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.iconBox, activeFilterCount > 0 && styles.iconBoxActive]}
          onPress={() => setShowFilters(true)}
          activeOpacity={0.7}
        >
          <Svg viewBox="0 0 24 24" width={20} height={20} fill="none"
            stroke={activeFilterCount > 0 ? th.colors.accent : th.colors.text}
            strokeWidth={2} strokeLinecap="round">
            <Path d="M3 6h18M6 12h12M9 18h6" />
          </Svg>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Bandeja de lo marcado: al cambiar de búsqueda lo elegido sale de la
          lista, y aquí se sigue viendo y se quita con la ×. */}
      {multiSelect && selectedIds.length > 0 && (
        <Reanimated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray} keyboardShouldPersistTaps="handled">
            {selectedIds.map((id) => (
              <Reanimated.View key={id} entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} layout={LinearTransition.duration(160)}>
                <TouchableOpacity style={styles.chip} onPress={() => toggleSelected(id)} activeOpacity={0.7}>
                  <Text style={styles.chipText} numberOfLines={1}>{allLibrary[id] ? getExName(allLibrary[id]) : id}</Text>
                  <CloseIcon size={12} color={th.colors.accent} />
                </TouchableOpacity>
              </Reanimated.View>
            ))}
          </ScrollView>
        </Reanimated.View>
      )}

      {/* Pills de patrón — single-select, se desactiva volviendo a pulsarla */}
      <View style={styles.patternRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.patternRow}>
          {PATTERN_GROUPS.map(({ id }) => {
            const on = patternGroup === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.patternPill, on && styles.pillOn]}
                onPress={() => setPatternGroup(on ? '' : id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, on && styles.pillTextOn]}>
                  {t(`exerciseSelector.patternGroups.${id}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* "+ Crear ejercicio" — texto plano, mismo tratamiento que "+ Añadir sesión" */}
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => navigation.navigate('CustomExercise', { templateId, currentExerciseId, sessionMode })}
        activeOpacity={0.7}
      >
        <Text style={styles.createBtnText}>{t('exerciseSelector.createExercise')}</Text>
      </TouchableOpacity>

      <FlatList
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        extraData={[selectedIds, search]}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.emptyText}>{t('exerciseSelector.noResults')}</Text>}
      />

      {/* Hoja de filtros — se aplican en vivo, el CTA solo cierra */}
      <DragSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        title={t('exerciseSelector.filters.title')}
        action={{ label: t('exerciseSelector.filters.clear'), onPress: clearFilters }}
      >
        <View style={styles.sheetBody}>
          <FilterSection
            styles={styles}
            title={t('exerciseSelector.filters.muscleGroup')}
            options={MUSCLE_GROUPS.map((id) => ({ id, label: t(`exerciseSelector.groups.${id}`) }))}
            selected={groupFilter}
            onToggle={toggleIn(setGroupFilter)}
          />
          <FilterSection
            styles={styles}
            title={t('exerciseSelector.filters.equipment')}
            options={EQUIPMENT.map((id) => ({ id, label: t(`exerciseSelector.equipment.${id}`) }))}
            selected={equipFilter}
            onToggle={toggleIn(setEquipFilter)}
          />
          <FilterSection
            styles={styles}
            title={t('exerciseSelector.filters.type')}
            options={[
              { id: 'compound',  label: t('exerciseSelector.filters.compound') },
              { id: 'isolation', label: t('exerciseSelector.filters.isolation') },
            ]}
            selected={typeFilter}
            onToggle={toggleIn(setTypeFilter)}
          />

          <TouchableOpacity style={styles.cta} onPress={() => setShowFilters(false)} activeOpacity={0.85}>
            <Text style={styles.ctaText}>
              {filtered.length === 0
                ? t('exerciseSelector.filters.seeNone')
                : t('exerciseSelector.filters.see', { count: filtered.length })}
            </Text>
          </TouchableOpacity>
        </View>
      </DragSheet>
    </SafeAreaView>
  );
}

function FilterSection({ styles, title, options, selected, onToggle }) {
  return (
    <View>
      <Text style={styles.sheetSecTitle}>{title}</Text>
      <View style={styles.pillWrap}>
        {options.map(({ id, label }) => {
          const on = selected.includes(id);
          return (
            <TouchableOpacity
              key={id}
              style={[styles.pill, on && styles.pillOn]}
              onPress={() => onToggle(id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, on && styles.pillTextOn]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },

  // El botón de la cabecera: relleno lima porque es la acción de la pantalla,
  // apagado a surface2 mientras no hay nada elegido (sigue ocupando sitio para
  // que el título no baile al marcar el primer ejercicio).
  addBtn: {
    height: 32, paddingHorizontal: spacing.md, borderRadius: th.radius.md,
    backgroundColor: th.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnOff:      { backgroundColor: th.colors.surface2 },
  addBtnText:     { ...textStyles.button, color: th.colors.onAccent },
  addBtnTextOff:  { color: th.colors.muted },

  // Caja de icono cuadrada, igual que en Clientes: 42×42 para casar con el buscador.
  iconBox: {
    width: 42, height: 42, borderRadius: th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconBoxActive: { backgroundColor: withOpacity(th.colors.accent, 0.10) },
  filterBadge: {
    position: 'absolute', top: 3, right: 3,
    minWidth: 14, height: 14, borderRadius: 7, paddingHorizontal: 3,
    backgroundColor: th.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { ...textStyles.micro, fontFamily: 'Inter_900Black', color: th.colors.onAccent },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg,
  },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: th.colors.surface2, borderRadius: th.radius.sm,
    paddingHorizontal: spacing.lg, height: 42,
  },
  searchInput: { flex: 1, padding: 0, ...textStyles.body, color: th.colors.text },
  searchClearBtn:  { paddingLeft: spacing.xs2 },

  // Wrapper con padding vertical — evita el clipping de Android en ScrollView horizontal
  patternRowWrap: { paddingTop: spacing.md },
  patternRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },

  // Pills de la fila de patrón (radius/full) y del sheet de filtros (radius/sm)
  // comparten fondo/texto, solo cambia el radio.
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  patternPill: {
    paddingHorizontal: spacing.lg, height: 36, justifyContent: 'center',
    backgroundColor: th.colors.surface2, borderRadius: th.radius.full,
  },
  pill: {
    paddingHorizontal: spacing.lg, height: 36, justifyContent: 'center',
    backgroundColor: th.colors.surface2, borderRadius: th.radius.sm,
  },
  pillOn:      { backgroundColor: th.colors.accent },
  pillText:    { ...textStyles.button, color: th.colors.mutedLight },
  pillTextOn:  { color: th.colors.onAccent },

  createBtn:     { alignItems: 'center', paddingVertical: spacing.md, paddingTop: spacing.lg },
  createBtnText: { ...textStyles.button, color: th.tint.accent50 },

  // Las cabeceras van dentro de la lista: el `gap` de 2 entre filas no las
  // separa, así que llevan su propio aire debajo.
  sectionLabel: {
    ...textStyles.caps, color: th.colors.mutedLight,
    paddingBottom: spacing.sm,
  },
  sectionLabelGap: { paddingTop: spacing.lg },

  // Bandeja de seleccionados: chips en tinte lima, como lo marcado en la lista.
  tray: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    height: 28, paddingLeft: spacing.md, paddingRight: spacing.sm2,
    borderRadius: th.radius.full, backgroundColor: th.tint.accent10,
  },
  chipText: { ...textStyles.labelStrong, color: th.colors.accent, maxWidth: 180 },

  // Lista compacta: el mismo bloque continuo que la lista de ejercicios de
  // Progresión —filas pegadas con 2px de hueco y los radios grandes sólo en los
  // extremos (`getCardRadii`)— en vez de tarjetas sueltas. Buscando ejercicios
  // caben tres o cuatro más en pantalla, que es de lo que va esta pantalla.
  listContent: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: th.colors.surface,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  exRowSel:   { backgroundColor: th.tint.accent10 },
  exNameRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // El mismo par que `rowName`/`rowMeta` del editor de sesión: 14 Bold sobre 12
  // Medium, sin margen entre ellos —los separa el interlineado—. Un nombre
  // dentro de una lista va a `bodyStrong` (docs/specs/U06-tipografia.md §9.4).
  exName:     { ...textStyles.bodyStrong, color: th.colors.text, flexShrink: 1 },
  exHit:      { color: th.colors.accent },
  // «en B y C»: dice dónde más está, en el tinte del lima para leerse sin gritar.
  exIn:       { fontFamily: 'Inter_700Bold', color: th.tint.accent50 },
  exTaken:    { opacity: 0.45 },
  exMeta:     { ...textStyles.label, color: th.colors.mutedLight },
  customBadge: {
    backgroundColor: th.tint.accent10, borderRadius: th.radius.xs,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  customBadgeText: { ...textStyles.caps, color: th.colors.accent },

  emptyText: {
    ...textStyles.body, color: th.colors.mutedLight,
    textAlign: 'center', paddingTop: 40,
  },

  // CTA lima h44 — lo usa la hoja de filtros para cerrarse (la pantalla ya no
  // tiene botón abajo: con el teclado desplegado casi nunca se veía).
  cta: {
    height: 44, borderRadius: th.radius.md, backgroundColor: th.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { ...textStyles.button, color: th.colors.onAccent },

  sheetBody:    { gap: spacing.lg, paddingBottom: spacing.sm },
  sheetSecTitle: {
    ...textStyles.caps, color: th.colors.mutedLight, paddingBottom: spacing.sm,
  },
});
