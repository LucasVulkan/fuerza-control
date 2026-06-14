import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

// ─── Constants ────────────────────────────────────────────────────────────────

const PATTERNS = [
  { value: 'vertical_pull',   label: 'Tracción vertical' },
  { value: 'horizontal_pull', label: 'Tracción horizontal' },
  { value: 'vertical_push',   label: 'Empuje vertical' },
  { value: 'horizontal_push', label: 'Empuje horizontal' },
  { value: 'squat',           label: 'Pierna rodilla' },
  { value: 'hip_hinge',       label: 'Pierna cadera' },
  { value: 'core',            label: 'Core' },
  { value: 'carry_grip',      label: 'Agarre / Carga' },
  { value: 'calf_raise',      label: 'Gemelos' },
];

// ─── ExerciseSelectorScreen ───────────────────────────────────────────────────

export default function ExerciseSelectorScreen({ navigation, route }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {
    templateId,
    currentExerciseId = null,
    existingPatterns = [],
    sessionMode = false,   // true → add to active session (adHoc), not to the template
  } = route.params ?? {};

  const language = useStore((s) => s.profile.language);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const addExercise      = useStore((s) => s.addExercise);
  const replaceExercise  = useStore((s) => s.replaceExercise);
  const addAdHocExercise = useStore((s) => s.addAdHocExercise);
  const showToast        = useStore((s) => s.showToast);

  const allLibrary = useMemo(() => ({ ...exerciseLibrary, ...customExercises }), [exerciseLibrary, customExercises]);
  const currentDef = currentExerciseId ? allLibrary[currentExerciseId] : null;

  const defaultMode = !currentExerciseId && existingPatterns.length > 0 ? 'complementary' : 'similar';
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState(defaultMode);
  const [selectedPattern, setSelectedPattern] = useState(currentDef?.pattern ?? '');

  // Multi-select only when ADDING (replace mode stays a single pick).
  const multiSelect = !currentExerciseId;
  const [selectedIds, setSelectedIds] = useState([]);
  function toggleSelect(exerciseId) {
    setSelectedIds((prev) =>
      prev.includes(exerciseId) ? prev.filter((id) => id !== exerciseId) : [...prev, exerciseId]
    );
  }
  function handleAddSelected() {
    if (!selectedIds.length) return;
    selectedIds.forEach((id) => (sessionMode ? addAdHocExercise(id) : addExercise(templateId, id)));
    showToast(t('exerciseSelector.addedN', { count: selectedIds.length }), 2200, 'success');
    navigation.goBack();
  }

  const allExercises = useMemo(() => Object.values(allLibrary), [allLibrary]);

  function getExName(ex) {
    return language === 'en' ? (ex.nameEn ?? ex.name) : ex.name;
  }

  const filtered = useMemo(() => {
    let results = currentExerciseId
      ? allExercises.filter((ex) => ex.id !== currentExerciseId)
      : allExercises;

    if (search.trim()) {
      const q = search.toLowerCase();
      return results
        .filter((ex) => {
          const haystack = [ex.name, ex.nameEn].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(q);
        })
        .sort((a, b) => getExName(a).localeCompare(getExName(b)));
    }

    if (filterMode === 'similar' && currentDef) {
      results = results.filter((ex) => ex.pattern === currentDef.pattern && ex.level === currentDef.level);
    } else if (filterMode === 'complementary') {
      return [...results].sort((a, b) => {
        const aMissing = !existingPatterns.includes(a.pattern);
        const bMissing = !existingPatterns.includes(b.pattern);
        if (aMissing !== bMissing) return aMissing ? -1 : 1;
        return getExName(a).localeCompare(getExName(b));
      });
    } else if (filterMode === 'pattern' && selectedPattern) {
      results = results.filter((ex) => ex.pattern === selectedPattern);
    }

    return results.sort((a, b) => getExName(a).localeCompare(getExName(b)));
  }, [search, filterMode, selectedPattern, allExercises, currentExerciseId, existingPatterns, language]);

  function handleSelect(exerciseId) {
    if (sessionMode) {
      addAdHocExercise(exerciseId);
      showToast('Ejercicio añadido', 2200, 'success');
    } else if (currentExerciseId) {
      replaceExercise(templateId, currentExerciseId, exerciseId);
      showToast(t('exerciseEditor.toastSubstituted'), 2200, 'success');
    } else {
      addExercise(templateId, exerciseId);
      showToast(t('editor.toastExAdded'), 2200, 'success');
    }
    navigation.goBack();
  }

  const tabs = [
    ...(currentDef ? [{ id: 'similar', label: t('exerciseSelector.tabSimilar') }] : []),
    ...(existingPatterns.length > 0 ? [{ id: 'complementary', label: t('exerciseSelector.tabComplementary') }] : []),
    { id: 'pattern', label: t('exerciseSelector.tabPattern') },
  ];

  const renderItem = ({ item: ex }) => {
    const isSel = multiSelect && selectedIds.includes(ex.id);
    return (
      <TouchableOpacity
        style={styles.exerciseRow}
        onPress={() => (multiSelect ? toggleSelect(ex.id) : handleSelect(ex.id))}
        activeOpacity={0.6}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.exerciseName}>{getExName(ex)}</Text>
            {ex.isCustom && <View style={styles.customBadge}><Text style={styles.customBadgeText}>CUSTOM</Text></View>}
          </View>
          <Text style={styles.exerciseMeta}>
            {t(`exerciseSelector.patterns.${ex.pattern}`, ex.pattern)}
            {ex.level === 'beginner' ? ` · ${t('exerciseSelector.levelBeginner')}` : ''}
          </Text>
        </View>
        {multiSelect
          ? <View style={[styles.checkbox, isSel && styles.checkboxOn]}>
              {isSel && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
          : <Text style={styles.chevron}>›</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('exerciseSelector.title')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('exerciseSelector.searchPlaceholder')}
          placeholderTextColor={th.colors.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {/* Tabs */}
      {!search.trim() && (
        <View style={styles.tabsRow}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, filterMode === tab.id && styles.tabActive]}
              onPress={() => setFilterMode(tab.id)}
            >
              <Text style={[styles.tabText, filterMode === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Pattern picker — wrapper View evita clipping vertical en Android */}
      {!search.trim() && filterMode === 'pattern' && (
        <View style={styles.patternPickerWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.patternPicker}
          >
            <TouchableOpacity
              style={[styles.patternChip, !selectedPattern && styles.patternChipActive]}
              onPress={() => setSelectedPattern('')}
            >
              <Text style={[styles.patternChipText, !selectedPattern && styles.patternChipTextActive]}>
                {t('exerciseSelector.allPatterns')}
              </Text>
            </TouchableOpacity>
            {PATTERNS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[styles.patternChip, selectedPattern === p.value && styles.patternChipActive]}
                onPress={() => setSelectedPattern(p.value)}
              >
                <Text style={[styles.patternChipText, selectedPattern === p.value && styles.patternChipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Recuento + botón crear (debajo de filtros, encima de la lista) */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {t('exerciseSelector.exerciseCount', { count: filtered.length })}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => navigation.navigate('CustomExercise', { templateId, currentExerciseId, sessionMode })}
      >
        <Text style={styles.createBtnText}>{t('exerciseSelector.createExercise')}</Text>
      </TouchableOpacity>

      {/* List */}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(ex) => ex.id}
        renderItem={renderItem}
        extraData={selectedIds}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('exerciseSelector.noResults')}</Text>
          </View>
        }
      />

      {/* Add-selected bar — only in multi-select mode with a selection */}
      {multiSelect && selectedIds.length > 0 && (
        <View style={styles.addBar}>
          <TouchableOpacity style={styles.addBarBtn} onPress={handleAddSelected} activeOpacity={0.85}>
            <Text style={styles.addBarText}>
              {t('exerciseSelector.addedN', { count: selectedIds.length })}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: borders.thin, borderBottomColor: th.colors.border,
  },
  headerTitle: {
    fontSize: typography.md, fontWeight: typography.bold,
    color: th.colors.text, letterSpacing: 0.3,
  },
  closeBtn: { fontSize: 18, color: th.colors.muted, padding: spacing.xs },

  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  searchInput: {
    backgroundColor: th.colors.surface2, borderWidth: borders.thin, borderColor: th.colors.border,
    borderRadius: th.radius.md, color: th.colors.text, fontSize: typography.base,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },

  tabsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm,
    backgroundColor: th.colors.surface2, borderRadius: th.radius.sm,
    borderWidth: borders.thin, borderColor: th.colors.border,
  },
  tabActive: { backgroundColor: th.colors.accent, borderColor: th.colors.accent },
  tabText: { fontSize: typography.base, color: th.colors.muted, fontWeight: typography.medium },
  tabTextActive: { color: th.colors.onAccent },

  // Wrapper View con padding — evita el clipping vertical de Android en horizontal ScrollView
  patternPickerWrap: {
    paddingVertical: spacing.xs,
  },
  patternPicker: {
    flexDirection: 'row', gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  patternChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    backgroundColor: th.colors.surface2, borderRadius: th.radius.sm,
    borderWidth: borders.thin, borderColor: th.colors.border,
  },
  patternChipActive: { backgroundColor: withOpacity(th.colors.accent, 0.12), borderColor: withOpacity(th.colors.accent, 0.4) },
  patternChipText: { fontSize: typography.xs, color: th.colors.muted },
  patternChipTextActive: { color: th.colors.accent },

  countRow: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs,
  },
  countText: { fontSize: typography.xs, color: th.colors.muted2, letterSpacing: 0.5 },

  // Botón crear — fila dashed accent
  createBtn: {
    marginHorizontal: spacing.lg, marginBottom: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: borders.thin, borderColor: withOpacity(th.colors.accent, 0.45),
    borderStyle: 'dashed', borderRadius: th.radius.sm,
    alignItems: 'center',
  },
  createBtnText: { fontSize: typography.xs, color: th.colors.accent, fontWeight: typography.medium },

  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  exerciseRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: borders.thin, borderBottomColor: th.colors.border,
  },
  exerciseName: { fontSize: typography.base, fontWeight: typography.medium, color: th.colors.text },
  exerciseMeta: { fontSize: typography.xs, color: th.colors.muted, marginTop: 2 },
  customBadge: {
    backgroundColor: withOpacity(th.colors.accent, 0.1), borderWidth: borders.thin,
    borderColor: withOpacity(th.colors.accent, 0.3), borderRadius: th.radius.xs,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  customBadgeText: { fontSize: 9, color: th.colors.accent, letterSpacing: 0.8 },
  chevron: { fontSize: 16, color: th.colors.muted, marginLeft: spacing.xs },
  checkbox: {
    width: 22, height: 22, borderRadius: th.radius.xs,
    borderWidth: 1.5, borderColor: th.colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  checkboxOn: { backgroundColor: th.colors.accent, borderColor: th.colors.accent },
  checkboxTick: { fontSize: 13, fontWeight: typography.heavy, color: th.colors.onAccent, lineHeight: 16 },
  addBar: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
    borderTopWidth: borders.thin, borderTopColor: th.colors.border,
    backgroundColor: th.colors.bg,
  },
  addBarBtn: {
    backgroundColor: th.colors.accent, borderRadius: th.radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  addBarText: {
    fontSize: typography.base, fontWeight: typography.heavy,
    color: th.colors.onAccent, letterSpacing: 0.5,
  },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: typography.base, color: th.colors.muted },
});
