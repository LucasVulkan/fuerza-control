import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { colors, spacing, typography, radius, borders } from '../theme';

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
        .filter((ex) => getExName(ex).toLowerCase().includes(q))
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
      showToast('Ejercicio añadido a la sesión');
    } else if (currentExerciseId) {
      replaceExercise(templateId, currentExerciseId, exerciseId);
      showToast(t('exerciseEditor.toastSubstituted'));
    } else {
      addExercise(templateId, exerciseId);
      showToast(t('editor.toastExAdded'));
    }
    navigation.goBack();
  }

  const tabs = [
    ...(currentDef ? [{ id: 'similar', label: t('exerciseSelector.tabSimilar') }] : []),
    ...(existingPatterns.length > 0 ? [{ id: 'complementary', label: t('exerciseSelector.tabComplementary') }] : []),
    { id: 'pattern', label: t('exerciseSelector.tabPattern') },
  ];

  const renderItem = ({ item: ex }) => (
    <TouchableOpacity style={styles.exerciseRow} onPress={() => handleSelect(ex.id)} activeOpacity={0.6}>
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
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
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
          placeholderTextColor={colors.muted}
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
        onPress={() => navigation.navigate('CustomExercise', { templateId, currentExerciseId })}
      >
        <Text style={styles.createBtnText}>{t('exerciseSelector.createExercise')}</Text>
      </TouchableOpacity>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(ex) => ex.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('exerciseSelector.noResults')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: borders.thin, borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.md, fontWeight: typography.bold,
    color: colors.text, letterSpacing: 0.3,
  },
  closeBtn: { fontSize: 18, color: colors.muted, padding: spacing.xs },

  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  searchInput: {
    backgroundColor: colors.surface2, borderWidth: borders.thin, borderColor: colors.border,
    borderRadius: radius.md, color: colors.text, fontSize: typography.base,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },

  tabsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.sm + 2, paddingVertical: 4,
    backgroundColor: colors.surface2, borderRadius: radius.sm,
    borderWidth: borders.thin, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { fontSize: typography.xs, color: colors.muted, fontWeight: typography.medium },
  tabTextActive: { color: colors.onAccent },

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
    backgroundColor: colors.surface2, borderRadius: radius.sm,
    borderWidth: borders.thin, borderColor: colors.border,
  },
  patternChipActive: { backgroundColor: `rgba(232,255,71,0.12)`, borderColor: `rgba(232,255,71,0.4)` },
  patternChipText: { fontSize: typography.xs, color: colors.muted },
  patternChipTextActive: { color: colors.accent },

  countRow: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs,
  },
  countText: { fontSize: typography.xs, color: colors.muted2, letterSpacing: 0.5 },

  // Botón crear — fila dashed accent
  createBtn: {
    marginHorizontal: spacing.lg, marginBottom: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: borders.thin, borderColor: `rgba(232,255,71,0.45)`,
    borderStyle: 'dashed', borderRadius: radius.sm,
    alignItems: 'center',
  },
  createBtnText: { fontSize: typography.xs, color: colors.accent, fontWeight: typography.medium },

  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  exerciseRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: borders.thin, borderBottomColor: colors.border,
  },
  exerciseName: { fontSize: typography.base, fontWeight: typography.medium, color: colors.text },
  exerciseMeta: { fontSize: typography.xs, color: colors.muted, marginTop: 2 },
  customBadge: {
    backgroundColor: `rgba(232,255,71,0.1)`, borderWidth: borders.thin,
    borderColor: `rgba(232,255,71,0.3)`, borderRadius: radius.xs,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  customBadgeText: { fontSize: 9, color: colors.accent, letterSpacing: 0.8 },
  chevron: { fontSize: 16, color: colors.muted, marginLeft: spacing.xs },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: typography.base, color: colors.muted },
});
