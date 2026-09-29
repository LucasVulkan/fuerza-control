/**
 * DragSheet — bottom sheet with drag-to-close. Úsalo para CUALQUIER modal nuevo
 * (menús "···", hojas de opciones, pickers): es el patrón único de la app, no
 * montes otro por tu cuenta ni uses `Alert` nativo, que no se puede estilar.
 *
 * Interacción (la misma que el SettingsSheet de AppHeader): se arrastra hacia
 * abajo para cerrar (>120 px o gesto rápido) desde el handle **o desde el
 * fondo**, el backdrop se difumina con el arrastre y la hoja entra con spring.
 * `animationType="none"` para que la animación nativa del Modal no pelee con el
 * transform.
 *
 * El MISMO PanResponder se reparte entre el handle y el backdrop: si cada uno
 * tuviera el suyo, el `gestureState` (el dy acumulado) sería distinto en cada
 * zona y el arrastre saltaría al cruzar de una a otra.
 */
import { useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Animated, PanResponder, KeyboardAvoidingView } from 'react-native';
import { Text } from './ui/Text';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { spacing, borders, textStyles } from '../theme';
import { useThemedStyles } from '../useTheme';
import { SheetContext } from './ui/sheetContext';
import NavScrim from './ui/NavScrim';
import Reanimated, {
  useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation,
} from 'react-native-reanimated';

/**
 * La tarjeta de la hoja. Va aparte para leer los márgenes del `SafeAreaProvider`
 * que hay DENTRO del Modal: el Modal es otra ventana, y en Android sus márgenes
 * no son los de la raíz de la app. Con los de la raíz, la hoja acababa unas
 * veces subida un alto de barra de navegación de más y otras veces debajo de
 * los botones (pulido-ui.md §3).
 *
 * El contenido desplazable llega hasta el borde de abajo, con `NavScrim`
 * encima: la zona de los botones va tapada del todo y justo por encima las
 * filas de una hoja larga (el menú ≡) se funden en vez de cortarse en seco
 * contra una franja. El
 * margen va DENTRO del scroll, así que una hoja corta acaba donde acababa y el
 * velo solo cubre aire.
 */
function SheetCard({ style, header, children }) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // Arriba, el mismo fundido bajo la cabecera, pero solo al desplazar: con la
  // hoja quieta taparía la primera fila. Aparece en los primeros `xl` px.
  // Reanimated y no el `Animated` del resto del fichero: es lo nuevo de la casa.
  const scrollY  = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const topFade  = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, spacing.xl], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={style}>
      {header}
      <View style={styles.body}>
        <Reanimated.ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {children}
        </Reanimated.ScrollView>
        <Reanimated.View pointerEvents="none" style={[styles.topFade, topFade]}>
          <NavScrim edge="top" fade={spacing.xl} />
        </Reanimated.View>
      </View>
      <NavScrim inset={insets.bottom} fade={spacing.xl} opaqueInset />
    </Animated.View>
  );
}

/**
 * `action` sustituye el botón "Aceptar" de la derecha por otra acción
 * ({ label, onPress }) cuando la hoja ya tiene su propia salida — p. ej. el
 * "Limpiar" de la hoja de filtros, que cierra con su CTA de abajo.
 */
export default function DragSheet({ visible, onClose, title, action, tall, children }) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  const translateY      = useRef(new Animated.Value(900)).current;
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, 300], outputRange: [1, 0], extrapolate: 'clamp',
  });

  // Ref keeps the once-created PanResponder pointing at the latest onClose.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Una hoja que ya no está montada no avisa de que se ha cerrado. Una opción
  // que cambia a OTRA hoja desmonta esta al instante, pero su animación de
  // cierre sigue y al acabar llamaba a `onClose`: si las dos hojas comparten
  // estado (+ Sesión libre de un cliente), cerraba la hoja nueva recién abierta.
  const mounted = useRef(true);
  // Se reactiva al montar: en desarrollo React monta, desmonta y vuelve a
  // montar los efectos, y sin esto la hoja no volvía a cerrarse nunca.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const close = () => {
    Animated.timing(translateY, {
      toValue: 900, duration: 240, useNativeDriver: true,
    }).start(() => { if (mounted.current) onCloseRef.current(); });
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  // Valor estable: `close` se rehace en cada render y no puede viajar por el
  // contexto sin repintar a todo el que lo lea.
  const sheet = useMemo(() => ({ dismiss: () => closeRef.current() }), []);

  const panResponder = useRef(
    PanResponder.create({
      // El handle reclama al tocar; el backdrop solo si el gesto se mueve, para
      // que un toque suelto sobre el fondo siga siendo "cerrar".
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120 || gs.vy > 0.8) {
          closeRef.current();
        } else {
          Animated.spring(translateY, {
            toValue: 0, useNativeDriver: true, tension: 80, friction: 10,
          }).start();
        }
      },
    })
  ).current;

  // Slide-in al abrir
  useEffect(() => {
    if (visible) {
      translateY.setValue(900);
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <SheetContext.Provider value={sheet}>
    {/* Borde a borde (SDK 54): el Modal cubre también las barras del sistema
        (regla de UI-MIGRATION §8), y el `SafeAreaProvider` de dentro mide los
        márgenes de ESTA ventana para que la hoja acabe justo encima de los
        botones de Android — ver `SheetCard`. */}
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaProvider>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="box-none">
        <View style={StyleSheet.absoluteFillObject} {...panResponder.panHandlers}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={close} />
        </View>
      </Animated.View>
      {/* KAV como carcasa inferior (misma solución que `workout/NotesModal`): el
          teclado empuja la hoja en vez de taparla — lo nota cualquier hoja con
          campo de texto (el código de entrenador, el nombre de la copia…).
          `box-none` deja que los toques del hueco de arriba lleguen al backdrop,
          y el `translateY` del arrastre sigue siendo del sheet, independiente
          del empuje de layout. */}
      <KeyboardAvoidingView style={styles.kavShell} behavior="padding" pointerEvents="box-none">
        {/* `tall`: alto FIJO en vez de tope. Una hoja que crece con su
            contenido da un salto cada vez que se despliega algo dentro —y en la
            de etapas se despliega constantemente—, así que el contenido pasa a
            scrollear dentro de una caja que no se mueve. */}
        <SheetCard
          style={[styles.card, tall && styles.cardTall, { transform: [{ translateY }] }]}
          header={(
            <>
              <View {...panResponder.panHandlers} style={styles.handleWrap}>
                <View style={styles.handle} />
              </View>
              {/* Sin `title` la hoja va solo con el asa: el menú principal pone su
                  propio bloque de identidad ahí arriba y se cierra arrastrando. */}
              {title != null && (
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  <TouchableOpacity onPress={action ? action.onPress : close} hitSlop={8}>
                    <Text style={styles.done}>{action ? action.label : t('exerciseEditor.configDone')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        >
          {children}
        </SheetCard>
      </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
    </SheetContext.Provider>
  );
}

const makeStyles = (th) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  // La carcasa empuja la hoja contra el borde inferior; el `maxHeight` se mide
  // contra ella, así que al abrirse el teclado la hoja también se encoge.
  kavShell: { flex: 1, justifyContent: 'flex-end' },
  // La hoja va en `bg`, no en `surface`: así las tarjetas y filas que lleva
  // dentro (que SON `surface`) se leen como piezas sobre ella en vez de
  // fundirse. Lo que va sobre la hoja sigue las reglas de la app —
  // tarjetas/filas en `surface`, campos y botones secundarios en `surface2` —
  // y nada dentro de una hoja puede ir pintado en `bg`.
  card: {
    maxHeight:            '85%',
    backgroundColor:      th.colors.bg,
    borderTopLeftRadius:  th.radius.lg,
    borderTopRightRadius: th.radius.lg,
    borderWidth:          borders.thin,
    borderColor:          th.colors.borderCard,
    paddingHorizontal:    spacing.lg,
    paddingTop:           spacing.sm,
  },
  cardTall: { height: '85%' },
  // La caja del scroll: crece y encoge como lo hacía el ScrollView suelto (en
  // `tall` llena la hoja; si no, respeta el tope de alto), y es la referencia
  // del fundido de arriba.
  body:    { flexGrow: 1, flexShrink: 1 },
  // A sangre: sale del padding lateral de la hoja para tapar de borde a borde.
  topFade: { position: 'absolute', top: 0, left: -spacing.lg, right: -spacing.lg, height: spacing.xl },
  handleWrap: {
    alignItems:      'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: th.colors.border,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingBottom:  spacing.md,
  },
  title: { ...textStyles.bodyStrong, color: th.colors.text },
  done:  { ...textStyles.labelStrong, color: th.colors.accent },
});
