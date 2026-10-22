/**
 * BlockEditorScreen — marco de `BlockEditorInline`, hermano de
 * `ExerciseEditorScreen` y con el mismo motivo para existir: era un `Modal`
 * `pageSheet` dentro de `SessionEditorScreen`.
 *
 * De paso se va el `GestureHandlerRootView` que necesitaba: un `Modal` monta su
 * contenido en OTRA jerarquía nativa, fuera del de `App.js`, y sin uno propio
 * el asa de arrastre de los movimientos no respondía. Una pantalla del stack
 * cuelga del de `App.js` y no hace falta.
 *
 * La usa también la sesión libre del Workout con `templateId: '__free__'`: ahí
 * no hay plantilla, los bloques viven en `activeSession.freeBlocks`, y el ✓ no
 * es la salida del modo edición sino un ‹ más (no hay programa que marcar ni
 * Main al que volver: sacaría del entreno).
 */
import { useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedRef } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { useTheme, useThemedStyles } from '../useTheme';
import { spacing } from '../theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import SiblingNav from '../components/ui/SiblingNav';
import AnchoredList, { ListButton } from '../components/ui/AnchoredList';
import { CheckIcon } from '../components/ui/EditorIcons';
import { useEditorExit } from '../hooks/useEditorExit';
import { useEditorFold } from '../hooks/useEditorFold';
import { useSiblingSwipe, SwipeLockContext } from '../hooks/useSiblingSwipe';
import { useAnchoredList } from '../hooks/useAnchoredList';
import BlockEditorInline from '../components/editor/BlockEditorInline';
import { sessionTag } from '../utils/editorIdentity';
import { slotNumber } from '../utils/sessionSlots';

export default function BlockEditorScreen({ navigation, route }) {
  const { templateId, blockId: initialBlockId } = route.params ?? {};
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { done } = useEditorExit(navigation, templateId);
  const { folded, onScroll, onCardLayout, cardH } = useEditorFold();

  const [blockId, setBlockId] = useState(initialBlockId);
  // Mismo contador de saltos que en `ExerciseEditorScreen`: es la `key` del
  // editor y remonta aunque el bloque nuevo se parezca al anterior.
  const [swap, setSwap] = useState(0);
  const btnRef   = useRef(null);   // el botón «n/N»: de él cuelga la lista
  const belowRef = useRef(null);   // el hueco bajo la cabecera: de él, con el título plegado
  const rootRef  = useRef(null);   // el contenedor donde se pinta la lista
  const list     = useAnchoredList(rootRef);

  const isFree = templateId === '__free__';
  const template        = useStore((s) => s.sessionTemplates[templateId]);
  const freeBlocks      = useStore((s) => s.activeSession.freeBlocks) ?? [];
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);

  const allExercises = { ...exerciseLibrary, ...customExercises };
  const blocks = isFree ? freeBlocks : template?.blocks ?? [];
  const index  = blocks.findIndex((b) => b.id === blockId);
  const block  = blocks[index] ?? null;

  // El ScrollView de la pantalla: la lista de movimientos lo necesita para
  // hacer autoscroll al arrastrar cerca del borde.
  const scrollRef = useAnimatedRef();

  const blockName = (b) => b.name ?? t(`blocks.formats.${b.format}`);

  function selectBlock(id) {
    setBlockId(id);
    setSwap((n) => n + 1);
    scrollRef.current?.scrollTo({ y: 0, animated: false });   // el deslizamiento ya cubre el cambio
  }

  const sw = useSiblingSwipe({ prevId: blocks[index - 1]?.id ?? null, nextId: blocks[index + 1]?.id ?? null, onChange: selectBlock });

  // `BlockEditorInline` borra del store y luego llama a `onClose`, así que el
  // bloque ya no está mientras sale la pantalla: va vacía ese instante, igual
  // que el modal, que se desmontaba en seco.
  if (!block) return null;

  const many    = blocks.length > 1;
  // «Bloque 04 · Sesión A». La sesión libre del Workout no tiene plantilla ni número.
  const num     = slotNumber(template, { blockId });
  const eyebrow = num ? t('editor.idBlock', { n: num, where: sessionTag(template, t) }) : t('editor.idBlockFree');

  return (
    <SafeAreaView ref={rootRef} collapsable={false} edges={['top', 'bottom']} style={styles.safe}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        // La sesión libre del Workout no es el editor: sigue con su cabecera.
        editor={isFree ? undefined : { backLabel: template?.name || t('freeSession.templateUnnamed'), folded }}
        eyebrow={eyebrow}
        title={blockName(block)}
        onTitlePress={many ? () => list.open(belowRef, 4) : undefined}
        right={() => (
          <TouchableOpacity onPress={isFree ? () => navigation.goBack() : done} hitSlop={12} accessibilityRole="button">
            <CheckIcon size={20} color={th.colors.accent} />
          </TouchableOpacity>
        )}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View ref={belowRef} collapsable={false} style={styles.flex}>
          {/* El anterior y el siguiente, como en el editor de ejercicio. */}
          <SiblingNav
            prev={blocks[index - 1] && blockName(blocks[index - 1])} next={blocks[index + 1] && blockName(blocks[index + 1])}
            onPrev={() => sw.go(-1)} onNext={() => sw.go(1)}
            style={styles.nbr}
          />
          <View style={styles.flex} {...sw.panHandlers}>
            <Reanimated.View style={[styles.flex, sw.slideStyle]}>
              <Reanimated.ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScroll={onScroll}
                scrollEventThrottle={16}
              >
                {/* Saltar a otro bloque lo remonta (la `key`). */}
                <SwipeLockContext.Provider value={sw.lockRef}>
                  <View key={swap}>
                    <BlockEditorInline
                      templateId={templateId}
                      block={block}
                      eyebrow={eyebrow}
                      onCardLayout={onCardLayout}
                      // Botón de lista en la esquina de la tarjeta: la lista cuelga justo debajo.
                      corner={many ? (
                        <ListButton
                          ref={btnRef}
                          n={index + 1}
                          total={blocks.length}
                          label={t('editor.goToBlock')}
                          onPress={() => list.open(btnRef, cardH.current - 12 + 6)}
                        />
                      ) : undefined}
                      allExercises={allExercises}
                      onClose={() => navigation.goBack()}
                      navigation={navigation}
                      scrollableRef={scrollRef}
                    />
                  </View>
                </SwipeLockContext.Provider>
              </Reanimated.ScrollView>
            </Reanimated.View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <AnchoredList
        top={list.top}
        items={blocks.map((b, i) => ({
          id: b.id, num: slotNumber(template, { blockId: b.id }) ?? String(i + 1).padStart(2, '0'), label: blockName(b),
        }))}
        currentId={blockId}
        onSelect={(id) => {
          list.close();
          const to = blocks.findIndex((b) => b.id === id);
          if (to !== index) sw.go(to > index ? 1 : -1, id);
        }}
        onClose={list.close}
      />
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: th.colors.bg },
  flex: { flex: 1 },
  nbr:  { paddingBottom: spacing.sm2 },
});
