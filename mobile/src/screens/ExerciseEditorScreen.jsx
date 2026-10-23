/**
 * ExerciseEditorScreen — marco de `ExerciseEditorInline`.
 *
 * Era un `Modal` `pageSheet` dentro de `SessionEditorScreen`: entraba desde
 * abajo como una hoja pero se comportaba como pantalla (cabecera con título,
 * desplegable y "Aceptar", scroll propio y sus propios `DragSheet` dentro), y
 * `presentationStyle` es solo de iOS, así que en Android ya salía a pantalla
 * completa. Ahora es una pantalla del stack como su gemela
 * `CustomExerciseScreen`, que es el mismo editor para el alta en librería.
 */
import { useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { useThemedStyles } from '../useTheme';
import { spacing } from '../theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import SiblingNav from '../components/ui/SiblingNav';
import AnchoredList, { ListButton } from '../components/ui/AnchoredList';
import { useEditorExit } from '../hooks/useEditorExit';
import { useEditorFold } from '../hooks/useEditorFold';
import { deleteWithUndo } from '../hooks/useEditorDraft';
import { useSiblingSwipe, SwipeLockContext } from '../hooks/useSiblingSwipe';
import { useAnchoredList } from '../hooks/useAnchoredList';
import ExerciseEditorInline from '../components/editor/ExerciseEditorInline';
import { sessionTag } from '../utils/editorIdentity';
import { slotNumber } from '../utils/sessionSlots';

export default function ExerciseEditorScreen({ navigation, route }) {
  const { templateId, exerciseId: initialExerciseId } = route.params ?? {};
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const { done } = useEditorExit(navigation, templateId);
  const { folded, onScroll, onCardLayout, cardH } = useEditorFold();

  // El ejercicio abierto es estado local (no parámetro de ruta) para que la
  // lista, el anterior/siguiente y el swipe salten a otro sin apilar pantallas.
  const [exerciseId, setExerciseId] = useState(initialExerciseId);

  // Contador de saltos: es la `key` del editor y sube en CADA salto. Si
  // dependiera del id, saltar a un ejercicio con la misma configuración no
  // remontaría el editor y se quedaría con las series del anterior.
  const [swap, setSwap] = useState(0);
  const scrollRef = useRef(null);
  const btnRef    = useRef(null);   // el botón «n/N»: de él cuelga la lista
  const belowRef  = useRef(null);   // el hueco bajo la cabecera: de él, con el título plegado
  const rootRef   = useRef(null);   // el contenedor donde se pinta la lista
  const list      = useAnchoredList(rootRef);

  function selectExercise(id) {
    setExerciseId(id);
    setSwap((n) => n + 1);
    // Sin esto el editor nuevo aparece a la altura a la que estuviera el
    // anterior. Sin animar: el deslizamiento ya cubre el cambio.
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  const template        = useStore((s) => s.sessionTemplates[templateId]);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const removeExercise  = useStore((s) => s.removeExercise);

  const allExercises = { ...exerciseLibrary, ...customExercises };
  const exercises    = template?.exercises ?? [];
  const index        = exercises.findIndex((ex) => ex.exerciseId === exerciseId);
  const exConfig     = index >= 0 ? exercises[index] : null;
  const nameOf       = (id) => allExercises[id]?.name ?? id;
  const prevId       = exercises[index - 1]?.exerciseId ?? null;
  const nextId       = exercises[index + 1]?.exerciseId ?? null;
  const sw           = useSiblingSwipe({ prevId, nextId, onChange: selectExercise });

  // Al borrar, el ejercicio se va del store antes de que acabe la animación de
  // salida: durante ese instante la pantalla que se aleja va vacía. Lo mismo
  // que hacía el modal, que directamente se desmontaba.
  if (!exConfig) return null;

  const def     = allExercises[exerciseId];
  const hasNext = index < exercises.length - 1;
  const many    = exercises.length > 1;
  // «Ejercicio 01 · Sesión A»: el número es el que lleva en la lista de la sesión.
  const eyebrow = t('editor.idExercise', { n: slotNumber(template, { exerciseId }) ?? '', where: sessionTag(template, t) });

  return (
    <SafeAreaView ref={rootRef} collapsable={false} edges={['top', 'bottom']} style={styles.safe}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        editor={{ backLabel: sessionTag(template, t), onSave: done, folded }}
        eyebrow={eyebrow}
        title={def?.name ?? exerciseId}
        onTitlePress={many ? () => list.open(belowRef, 4) : undefined}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View ref={belowRef} collapsable={false} style={styles.flex}>
          <View style={styles.flex} {...sw.panHandlers}>
            <Reanimated.View style={[styles.flex, sw.slideStyle]}>
              <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onScroll={onScroll} scrollEventThrottle={16}>
                {/* `key`: el editor carga toda su configuración en el montaje
                    (`computeInitial`), así que saltar a otro ejercicio tiene que
                    REMONTARLO — si no, cambia el título pero se queda con las
                    series/descanso del anterior. Al desmontar se vuelca lo que
                    hubiera pendiente del viejo. */}
                {/* El anterior y el siguiente, como en Progreso › ejercicio: pegados
                    a la tarjeta y con el scroll (plegada, la lista sale del título). */}
                <SiblingNav
                  prev={prevId && nameOf(prevId)} next={nextId && nameOf(nextId)}
                  onPrev={() => sw.go(-1)} onNext={() => sw.go(1)}
                  style={styles.nbr}
                />
                <SwipeLockContext.Provider value={sw.lockRef}>
                  <View key={swap}>
                    <ExerciseEditorInline
                      templateId={templateId}
                      exConfig={exConfig}
                      def={def}
                      hasNextExercise={hasNext}
                      eyebrow={eyebrow}
                      onCardLayout={onCardLayout}
                      // Botón de lista en la esquina de la tarjeta: la lista cuelga justo debajo.
                      corner={many ? (
                        <ListButton
                          ref={btnRef}
                          n={index + 1}
                          total={exercises.length}
                          label={t('editor.goToExercise')}
                          onPress={() => list.open(btnRef, cardH.current - spacing.md + spacing.sm)}
                        />
                      ) : undefined}
                      // `replace` y no `navigate`: al elegir el sustituto el selector hace
                      // `goBack`, y volver a un editor cuyo ejercicio ya no existe no
                      // tiene sentido — se sale a la sesión, igual que hacía el modal.
                      onSubstitute={() => navigation.replace('ExerciseSelector', {
                        templateId, currentExerciseId: exerciseId, existingPatterns: [],
                      })}
                      // Unilateral / ejercicio único lo cambian por otro. Sin remontar el
                      // editor (sin `selectExercise`): la hoja Variante sigue abierta y no
                      // hay salto (QA P44).
                      onIdentityChange={setExerciseId}
                      onDelete={() => {
                        navigation.goBack();
                        deleteWithUndo({
                          kind: 'template', id: templateId, label: t('editor.toastUndo'),
                          msg: t('editor.toastExDeleted', { name: nameOf(exerciseId) }),
                          remove: () => removeExercise(templateId, exerciseId),
                        });
                      }}
                    />
                  </View>
                </SwipeLockContext.Provider>
              </ScrollView>
            </Reanimated.View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <AnchoredList
        top={list.top}
        items={exercises.map((ex) => ({
          id: ex.exerciseId, num: slotNumber(template, { exerciseId: ex.exerciseId }), label: nameOf(ex.exerciseId),
        }))}
        currentId={exerciseId}
        onSelect={(id) => {
          list.close();
          const to = exercises.findIndex((ex) => ex.exerciseId === id);
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
  // Se come casi todo el relleno de arriba del editor (`spacing.md`): la fila
  // queda a un paso de la tarjeta.
  nbr:  { paddingTop: spacing.xs2, marginBottom: -spacing.sm2 },
});
