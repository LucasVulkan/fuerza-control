/**
 * Buscador de ejercicios — rediseño FormaFit.
 *
 * Dos modos, mismo layout:
 *   - AÑADIR (por defecto): multiselección con checkbox y CTA lima abajo.
 *   - SUSTITUIR / picker de bloque: selección única, chevron a la derecha, se
 *     elige y se cierra. Arranca con la pill del patrón del ejercicio actual
 *     ya activa (sustituye al viejo modo "Similar", que además filtraba por
 *     nivel sin que se viera en ningún sitio).
 *
 * Filtros: fila de pills de patrón (single-select, siempre visible) + hoja de
 * filtros (`DragSheet`) con grupo muscular / equipo / tipo en multiselección.
 * El badge del botón de filtro cuenta solo los de la hoja, no la pill.
 *
 * El modo "Complementario" (ordenar por patrones que faltan en la sesión) se
 * elimina: `existingPatterns` sigue llegando por params pero ya no se usa.
 */
import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ScrollView, StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { spacing, textStyles, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import DragSheet from '../components/DragSheet';
import { ArrowIcon, CheckIcon } from '../components/ui/EditorIcons';
import {
  PATTERN_GROUPS, GROUP_OF_PATTERN, muscleGroupIdsOf, equipmentOf,
} from '../utils/exerciseTaxonomy';

// El buscador filtra por grupo muscular abriendo 'arms' en Bíceps/Tríceps
// (ver `muscleGroupIdsOf`) — no existe como `primaryGroup` real, solo aquí.
const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'glutes_hamstrings', 'legs_lower', 'core', 'grip',
];
const EQUIPMENT = [
  'bodyweight', 'barbell', 'dumbbells', 'cables', 'machines', 'kettlebell',
  'resistance_band', 'pullup_bar', 'parallettes', 'rings',
  'ab_wheel', 'rope', 'weight_belt',
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
  } = route.params ?? {};

  const language = useStore((s) => s.profile.language);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const addExercise      = useStore((s) => s.addExercise);
  const replaceExercise  = useStore((s) => s.replaceExercise);
  const addAdHocExercise = useStore((s) => s.addAdHocExercise);
  const setBlockPickerResult = useStore((s) => s.setBlockPickerResult);
  const showToast        = useStore((s) => s.showToast);

  const allLibrary = useMemo(() => ({ ...exerciseLibrary, ...customExercises }), [exerciseLibrary, customExercises]);
  const currentDef = currentExerciseId ? allLibrary[currentExerciseId] : null;

  // Multi-select only when ADDING (replace/block-picker modes stay a single pick).
  const multiSelect = !currentExerciseId && !blockPicker;

  const [search, setSearch] = useState('');
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allExercises
      .filter((ex) => ex.id !== currentExerciseId)
      .filter((ex) => !q || [ex.name, ex.nameEn].filter(Boolean).join(' ').toLowerCase().includes(q))
      .filter((ex) => !patternGroup || GROUP_OF_PATTERN[ex.pattern] === patternGroup)
      .filter((ex) => !groupFilter.length || muscleGroupIdsOf(ex).some((id) => groupFilter.includes(id)))
      .filter((ex) => !equipFilter.length || equipmentOf(ex).some((e) => equipFilter.includes(e)))
      .filter((ex) => !typeFilter.length || typeFilter.includes(ex.isCompound ? 'compound' : 'isolation'))
      .sort((a, b) => getExName(a).localeCompare(getExName(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, patternGroup, groupFilter, equipFilter, typeFilter, allExercises, currentExerciseId, language]);

  const renderItem = ({ item: ex }) => {
    const isSel = multiSelect && selectedIds.includes(ex.id);
    const meta = [
      t(`exerciseSelector.groups.${ex.primaryGroup}`, ex.primaryGroup),
      equipmentOf(ex).map((e) => t(`exerciseSelector.equipment.${e}`, e)).join(', '),
    ].join(' · ');

    return (
      <TouchableOpacity
        style={[styles.exRow, isSel && styles.exRowSel]}
        onPress={() =>
          multiSelect
            ? setSelectedIds((prev) =>
                prev.includes(ex.id) ? prev.filter((id) => id !== ex.id) : [...prev, ex.id])
            : handleSelect(ex.id)
        }
        activeOpacity={0.7}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.exNameRow}>
            <Text style={[styles.exName, isSel && styles.exNameSel]} numberOfLines={1}>
              {getExName(ex)}
            </Text>
            {ex.isCustom && (
              <View style={styles.customBadge}><Text style={styles.customBadgeText}>CUSTOM</Text></View>
            )}
          </View>
          <Text style={styles.exMeta} numberOfLines={1}>{meta}</Text>
        </View>

        {multiSelect ? (
          <View style={[styles.check, isSel && styles.checkOn]}>
            <CheckIcon size={20} color={isSel ? th.colors.onAccent : th.colors.muted} />
          </View>
        ) : (
          <ArrowIcon size={16} color={th.colors.mutedLight} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {/* Cabecera: título + cerrar (caja 42 surface2, como los iconos de Clientes) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {currentExerciseId || blockPicker
            ? t('exerciseSelector.titleReplace')
            : t('exerciseSelector.titleAdd')}
        </Text>
        <TouchableOpacity style={styles.iconBox} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.closeGlyph}>✕</Text>
        </TouchableOpacity>
      </View>

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
              <Text style={styles.searchClearText}>✕</Text>
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

      <Text style={styles.sectionLabel}>
        {t('exerciseSelector.exerciseCount', { count: filtered.length })}
      </Text>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(ex) => ex.id}
        renderItem={renderItem}
        extraData={selectedIds}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.emptyText}>{t('exerciseSelector.noResults')}</Text>}
      />

      {/* CTA — solo en multiselección y con algo elegido */}
      {multiSelect && selectedIds.length > 0 && (
        <View style={styles.ctaWrap}>
          <TouchableOpacity style={styles.cta} onPress={handleAddSelected} activeOpacity={0.85}>
            <Text style={styles.ctaText}>
              {t('exerciseSelector.addedN', { count: selectedIds.length })}
            </Text>
          </TouchableOpacity>
        </View>
      )}

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

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  headerTitle: { ...textStyles.hero, color: th.colors.text, flexShrink: 1 },

  // Caja de icono cuadrada, igual que en Clientes: 42×42 para casar con el buscador.
  iconBox: {
    width: 42, height: 42, borderRadius: th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconBoxActive: { backgroundColor: withOpacity(th.colors.accent, 0.10) },
  closeGlyph: { fontSize: 17, color: th.colors.text },
  filterBadge: {
    position: 'absolute', top: 3, right: 3,
    minWidth: 14, height: 14, borderRadius: 7, paddingHorizontal: 3,
    backgroundColor: th.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { fontFamily: 'Inter_900Black', fontSize: 9, color: th.colors.onAccent },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: th.colors.surface2, borderRadius: th.radius.sm,
    paddingHorizontal: spacing.lg, height: 42,
  },
  searchInput: { flex: 1, padding: 0, ...textStyles.subtitle, color: th.colors.text },
  searchClearBtn:  { paddingLeft: spacing.xs2 },
  searchClearText: { ...textStyles.subtitle, color: th.colors.mutedLight },

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
  pillText:    { ...textStyles.btnAction, color: th.colors.mutedLight },
  pillTextOn:  { color: th.colors.onAccent },

  createBtn:     { alignItems: 'center', paddingVertical: spacing.md, paddingTop: spacing.lg },
  createBtnText: { ...textStyles.cardType, color: th.tint.accent50 },

  sectionLabel: {
    ...textStyles.spacingTag, color: th.colors.mutedLight,
    paddingHorizontal: spacing.lg,
  },

  listContent: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: th.colors.surface, borderRadius: th.radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm2,
  },
  exRowSel:   { backgroundColor: th.tint.accent10 },
  exNameRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exName:     { ...textStyles.cardTitle, color: th.colors.text, flexShrink: 1 },
  exNameSel:  { color: th.colors.accent },
  exMeta:     { ...textStyles.subtitle, color: th.colors.mutedLight, marginTop: 2 },
  customBadge: {
    backgroundColor: th.tint.accent10, borderRadius: th.radius.xs,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  customBadgeText: { ...textStyles.smallBold, color: th.colors.accent },

  check: {
    width: 36, height: 36, borderRadius: th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkOn: { backgroundColor: th.colors.accent },

  emptyText: {
    ...textStyles.subtitle, color: th.colors.mutedLight,
    textAlign: 'center', paddingTop: 40,
  },

  // CTA lima h44 — el mismo botón que cierra el editor de programa
  ctaWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: th.colors.bg },
  cta: {
    height: 44, borderRadius: th.radius.md, backgroundColor: '#b8ff00',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { ...textStyles.btnAction, color: th.colors.onAccent },

  sheetBody:    { gap: spacing.lg, paddingBottom: spacing.sm },
  sheetSecTitle: {
    ...textStyles.spacingTag, color: th.colors.mutedLight, paddingBottom: spacing.sm,
  },
});
