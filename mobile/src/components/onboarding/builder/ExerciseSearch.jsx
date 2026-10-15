/**
 * ExerciseSearch — el buscador en corto del constructor guiado (O03 §10.1.2): el
 * campo «Buscar ejercicio» y filas «nombre · grupo · material» sobre la biblioteca
 * real (`exerciseLibrary` + `customExercises`, con `filterBySearch`: sin tildes y
 * tolerante a erratas). Sin escribir, cinco sugeridos según la profundidad; al
 * escribir, los seis primeros con lo buscado en lima y el total; sin resultados,
 * «＋ Crear "{lo escrito}"». Fuera, a propósito: pills de patrón, hoja de filtros y
 * selección múltiple (eso es del selector de verdad, `ExerciseSelectorScreen`).
 *
 *   deep       profundidad completa (sugeridos de barra y dominadas)
 *   exclude    id que no se ofrece (el que ya está en la sesión, al cambiarlo)
 *   onPick     recibe el id del ejercicio elegido o recién creado
 *   onClose    cierra el buscador sin elegir
 */
import { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import { Text, TextInput } from '../../ui/Text';
import { CloseIcon } from '../../ui/EditorIcons';
import { spacing, textStyles } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { filterBySearch } from '../../../utils/searchText';
import { equipmentOf } from '../../../utils/exerciseTaxonomy';
import { SUGGESTED, SHOWN, splitHit, buildCustomExercise } from '../../../utils/onboardingBuilder';
import { exerciseName } from './useBuilderProgram';

const K = 'onboardingFlow.builder.exercise';

export default function ExerciseSearch({ deep, exclude = null, onPick, onClose }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const language        = useStore((s) => s.profile.language ?? 'es');
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const addCustomExercise = useStore((s) => s.addCustomExercise);
  const [q, setQ] = useState('');

  const lib  = useMemo(() => ({ ...exerciseLibrary, ...customExercises }), [exerciseLibrary, customExercises]);
  const text = q.trim();

  const hits = useMemo(() => {
    if (!text) return [];
    const all = Object.values(lib).filter((ex) => ex.id !== exclude);
    return filterBySearch(all, text, (ex) => [ex.name, ex.nameEn, ...(ex.aliases ?? [])].filter(Boolean).join(' '))
      .sort((a, b) => exerciseName(a, language).localeCompare(exerciseName(b, language)));
  }, [text, lib, exclude, language]);

  const suggested = useMemo(
    () => SUGGESTED[deep ? 'deep' : 'simple'].map((id) => lib[id]).filter((ex) => ex && ex.id !== exclude),
    [deep, lib, exclude],
  );

  const rows = text ? hits.slice(0, SHOWN) : suggested;

  function create() {
    const def = buildCustomExercise(text);
    addCustomExercise(def);
    onPick(def.id);
  }

  function meta(ex) {
    const group = ex.primaryGroup && ex.primaryGroup !== 'custom' ? t(`exerciseSelector.groups.${ex.primaryGroup}`, ex.primaryGroup) : '';
    const gear  = equipmentOf(ex).map((e) => t(`exerciseSelector.equipment.${e}`, e)).join(', ');
    return [group, gear].filter(Boolean).join(' · ');
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke={th.colors.mutedLight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35" />
        </Svg>
        <TextInput
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder={t('exerciseSelector.searchPlaceholder2')}
          placeholderTextColor={th.colors.mutedLight}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
        />
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t(`${K}.closeSearch`)}>
          <CloseIcon size={16} color={th.colors.mutedLight} />
        </Pressable>
      </View>

      {!text && <Text style={styles.label}>{t(`${K}.suggested`)}</Text>}

      {rows.map((ex) => {
        const name = exerciseName(ex, language);
        return (
          <Pressable key={ex.id} onPress={() => onPick(ex.id)} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button">
            <View style={styles.main}>
              <Text style={styles.name} numberOfLines={1}>
                {text
                  ? splitHit(name, text).map((p, i) => (p.hit ? <Text key={i} style={[styles.name, styles.hit]}>{p.text}</Text> : p.text))
                  : name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>{meta(ex)}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        );
      })}

      {!!text && hits.length > 0 && (
        <Text style={styles.count}>
          {t(`${K}.found`, { count: hits.length })}{hits.length > SHOWN ? ` · ${t(`${K}.keepTyping`)}` : ''}
        </Text>
      )}

      {!!text && hits.length === 0 && (
        <Pressable onPress={create} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button">
          <View style={styles.main}>
            <Text style={[styles.name, styles.hit]} numberOfLines={2}>{t(`${K}.create`, { name: text })}</Text>
            <Text style={styles.meta}>{t(`${K}.createSub`)}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  wrap: { marginTop: spacing.md, gap: spacing.xs2 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm2,
    height: 42, paddingHorizontal: spacing.lg,
    backgroundColor: th.colors.surface2, borderRadius: th.radius.sm,
    marginBottom: spacing.xs2,
  },
  input: { flex: 1, padding: 0, ...textStyles.body, color: th.colors.text },
  label: { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase', marginVertical: spacing.sm2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: th.colors.bg, borderRadius: th.radius.md,
    paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg - 3,
  },
  pressed: { opacity: 0.7 },
  main:  { flex: 1, minWidth: 0 },
  name:  { ...textStyles.bodyStrong, color: th.colors.text },
  hit:   { color: th.colors.accent },
  meta:  { ...textStyles.label, color: th.colors.mutedLight },
  chev:  { ...textStyles.title, color: th.colors.muted },
  count: { ...textStyles.label, color: th.colors.mutedLight, textAlign: 'center', marginTop: spacing.sm2 },
});
