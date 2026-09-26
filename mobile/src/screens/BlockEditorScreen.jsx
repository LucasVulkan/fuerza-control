/**
 * BlockEditorScreen — marco de `BlockEditorInline`, hermano de
 * `ExerciseEditorScreen` y con el mismo motivo para existir: era un `Modal`
 * `pageSheet` dentro de `SessionEditorScreen`.
 *
 * De paso se va el `GestureHandlerRootView` que necesitaba: un `Modal` monta su
 * contenido en OTRA jerarquía nativa, fuera del de `App.js`, y sin uno propio
 * el asa de arrastre de los movimientos no respondía. Una pantalla del stack
 * cuelga del de `App.js` y no hace falta.
 */
import { useState } from 'react';
import { TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedRef, FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { useTheme, useThemedStyles } from '../useTheme';
import ScreenHeader from '../components/ui/ScreenHeader';
import { CheckIcon } from '../components/ui/EditorIcons';
import { useEditorExit } from '../hooks/useEditorExit';
import BlockEditorInline from '../components/editor/BlockEditorInline';

export default function BlockEditorScreen({ navigation, route }) {
  const { templateId, blockId: initialBlockId } = route.params ?? {};
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { done } = useEditorExit(navigation, templateId);

  const [blockId, setBlockId] = useState(initialBlockId);
  // Mismo contador de saltos que en `ExerciseEditorScreen`: sube en cada
  // elección del desplegable para que la entrada confirme el toque aunque el
  // bloque nuevo se parezca al anterior.
  const [swap, setSwap] = useState(0);

  const template        = useStore((s) => s.sessionTemplates[templateId]);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);

  const allExercises = { ...exerciseLibrary, ...customExercises };
  const blocks = template?.blocks ?? [];
  const block  = blocks.find((b) => b.id === blockId) ?? null;

  // El ScrollView de la pantalla: la lista de movimientos lo necesita para
  // hacer autoscroll al arrastrar cerca del borde.
  const scrollRef = useAnimatedRef();

  const blockName = (b) => b.name ?? t(`blocks.formats.${b.format}`);

  function selectBlock(id) {
    setBlockId(id);
    setSwap((n) => n + 1);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  // `BlockEditorInline` borra del store y luego llama a `onClose`, así que el
  // bloque ya no está mientras sale la pantalla: va vacía ese instante, igual
  // que el modal, que se desmontaba en seco.
  if (!block) return null;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        eyebrow={t('editor.blockEyebrow')}
        title={blockName(block)}
        menu={blocks.length > 1 ? {
          items: blocks.map((b) => ({ id: b.id, label: blockName(b) })),
          currentId: blockId,
          onSelect:  selectBlock,
        } : null}
        right={() => (
          <TouchableOpacity onPress={done} hitSlop={12} accessibilityRole="button">
            <CheckIcon size={20} color={th.colors.accent} />
          </TouchableOpacity>
        )}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Reanimated.ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mismo motivo que en el editor de ejercicio: saltar a otro bloque
              desde el desplegable lo remonta, y ese remonte dispara la entrada
              (en el primer montaje no: ya entra la pantalla desde la derecha). */}
          <Reanimated.View key={swap} entering={swap ? FadeInDown.duration(220) : undefined}>
            <BlockEditorInline
              templateId={templateId}
              block={block}
              allExercises={allExercises}
              onClose={() => navigation.goBack()}
              navigation={navigation}
              scrollableRef={scrollRef}
            />
          </Reanimated.View>
        </Reanimated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: th.colors.bg },
});
