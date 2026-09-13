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
import { ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { useTheme, useThemedStyles } from '../useTheme';
import ScreenHeader from '../components/ui/ScreenHeader';
import { CheckIcon } from '../components/ui/EditorIcons';
import { useEditorExit } from '../hooks/useEditorExit';
import ExerciseEditorInline from '../components/editor/ExerciseEditorInline';

export default function ExerciseEditorScreen({ navigation, route }) {
  const { templateId, exerciseId: initialExerciseId } = route.params ?? {};
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { done } = useEditorExit(navigation);

  // El ejercicio abierto es estado local (no parámetro de ruta) para que el
  // desplegable de la cabecera salte a otro sin apilar pantallas.
  const [exerciseId, setExerciseId] = useState(initialExerciseId);

  // Contador de saltos: es la `key` del editor y sube en CADA elección del
  // desplegable, también si se elige el ejercicio ya abierto. Si dependiera del
  // id, saltar a un ejercicio con la misma configuración —o volver a elegir el
  // mismo— no movería un píxel y parecería que el toque no ha hecho nada.
  const [swap, setSwap] = useState(0);
  const scrollRef = useRef(null);

  function selectExercise(id) {
    setExerciseId(id);
    setSwap((n) => n + 1);
    // Sin esto el editor nuevo aparece a la altura a la que estuviera el
    // anterior, que es justo donde no se ve entrar.
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  const template        = useStore((s) => s.sessionTemplates[templateId]);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const removeExercise  = useStore((s) => s.removeExercise);
  const showToast       = useStore((s) => s.showToast);

  const allExercises = { ...exerciseLibrary, ...customExercises };
  const exercises    = template?.exercises ?? [];
  const index        = exercises.findIndex((ex) => ex.exerciseId === exerciseId);
  const exConfig     = index >= 0 ? exercises[index] : null;

  // Al borrar, el ejercicio se va del store antes de que acabe la animación de
  // salida: durante ese instante la pantalla que se aleja va vacía. Lo mismo
  // que hacía el modal, que directamente se desmontaba.
  if (!exConfig) return null;

  const def     = allExercises[exerciseId];
  const hasNext = index < exercises.length - 1;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        eyebrow={t('editor.exerciseEyebrow')}
        title={def?.name ?? exerciseId}
        menu={exercises.length > 1 ? {
          items: exercises.map((ex) => ({
            id:    ex.exerciseId,
            label: allExercises[ex.exerciseId]?.name ?? ex.exerciseId,
          })),
          currentId: exerciseId,
          onSelect:  selectExercise,
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
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* `key`: el editor carga toda su configuración en el montaje
              (`computeInitial`), así que saltar a otro ejercicio desde el
              desplegable tiene que REMONTARLO — si no, cambia el título pero se
              queda con las series/descanso del anterior. Al desmontar se vuelca
              lo que hubiera pendiente del viejo.
              Ese mismo remonte es el que dispara la entrada. En el primer
              montaje no: ya está entrando la pantalla desde la derecha. */}
          <Reanimated.View key={swap} entering={swap ? FadeInDown.duration(220) : undefined}>
            <ExerciseEditorInline
              templateId={templateId}
              exConfig={exConfig}
              def={def}
              hasNextExercise={hasNext}
              // `replace` y no `navigate`: al elegir el sustituto el selector hace
              // `goBack`, y volver a un editor cuyo ejercicio ya no existe no
              // tiene sentido — se sale a la sesión, igual que hacía el modal.
              onSubstitute={() => navigation.replace('ExerciseSelector', {
                templateId, currentExerciseId: exerciseId, existingPatterns: [],
              })}
              onDelete={() => {
                navigation.goBack();
                removeExercise(templateId, exerciseId);
                showToast(t('editor.toastExDeleted'), 2200, 'neutral');
              }}
            />
          </Reanimated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: th.colors.bg },
});
