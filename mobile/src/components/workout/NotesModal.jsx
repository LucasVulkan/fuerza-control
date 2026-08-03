/**
 * NotesModal — hoja de notas reutilizable (sesión general y, por ejercicio,
 * abierta desde ExerciseCard). Drag-to-close con el MISMO patrón que el modal de
 * detalle de ejercicio de Progreso (ProgressTab `ExerciseDetailModal`): dos
 * PanResponder que comparten el arrastre — `sheetPan` (handle + cabecera) y
 * `backdropPan` (arrastre desde el fondo; un tap sin desplazamiento cierra).
 * KeyboardAvoidingView propio para que el TextInput con autofocus no quede tapado.
 */
import { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform, StyleSheet, Animated, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { spacing, typography, borders, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

export default function NotesModal({ visible, title, value, onChange, onClose, placeholder, hint }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const translateY      = useRef(new Animated.Value(0)).current;
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, 300], outputRange: [1, 0], extrapolate: 'clamp',
  });
  const inputRef = useRef(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Dos responders que comparten el mismo arrastre: el del sheet (handle+cabecera)
  // y el del backdrop. Arrastrar en el backdrop mueve el sheet igual que el handle;
  // un tap (sin desplazamiento) sobre el backdrop cierra.
  const { sheetPan, backdropPan } = useRef((() => {
    const onMove = (_, gs) => { if (gs.dy > 0) translateY.setValue(gs.dy); };
    const settle = (gs) => {
      if (gs.dy > 120 || gs.vy > 0.8) {
        Animated.timing(translateY, { toValue: 900, duration: 240, useNativeDriver: true })
          .start(() => onCloseRef.current());
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
      }
    };
    const sheetPan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: onMove,
      onPanResponderRelease: (_, gs) => settle(gs),
    });
    const backdropPan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: onMove,
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dy) < 6 && Math.abs(gs.dx) < 6) { onCloseRef.current(); return; }
        settle(gs);
      },
    });
    return { sheetPan, backdropPan };
  })()).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(700);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
      // autoFocus falla en la PRIMERA apertura: el TextInput se monta antes de que
      // el Modal esté presentado, así que el teclado no sube. Enfocar tras un
      // pequeño delay (ya presentado) lo arregla igual en la primera y siguientes.
      const id = setTimeout(() => inputRef.current?.focus(), 220);
      return () => clearTimeout(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => onCloseRef.current()} statusBarTranslucent navigationBarTranslucent>
      {/* Backdrop — opacidad sincronizada con el arrastre; captura drag + tap */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: backdropOpacity }]}
        pointerEvents="box-none"
      >
        <View style={StyleSheet.absoluteFillObject} {...backdropPan.panHandlers} />
      </Animated.View>
      {/*
        KAV como shell inferior (box-none → los toques del área vacía superior
        pasan al backdrop). El sheet mantiene su translateY para el drag,
        independiente del empuje de layout del teclado.
      */}
      <KeyboardAvoidingView
        style={styles.kavShell}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.xl, transform: [{ translateY }] }]}>
          <View {...sheetPan.panHandlers}>
            <View style={styles.modalHandleWrap}>
              <View style={styles.modalHandle} />
            </View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={() => onCloseRef.current()}>
                <Text style={styles.modalSaveBtnText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TextInput
            ref={inputRef}
            style={styles.notesInput}
            value={value}
            onChangeText={onChange}
            multiline
            placeholder={placeholder}
            placeholderTextColor={th.colors.mutedLight}
            textAlignVertical="top"
          />
          <Text style={styles.notesHint}>{hint}</Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (th) => StyleSheet.create({
  kavShell: {
    flex:           1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor:      th.colors.bg,
    borderTopLeftRadius:  th.radius.lg,
    borderTopRightRadius: th.radius.lg,
    borderTopWidth:  borders.thin,
    borderTopColor:  th.colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.sm,
    gap:               spacing.md,
  },
  modalHandleWrap: {
    alignItems:      'center',
    paddingVertical: spacing.sm,
  },
  modalHandle: {
    width:           40,
    height:          4,
    borderRadius:    th.radius.full,
    backgroundColor: th.colors.border,
  },
  modalHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.sm,
  },
  modalTitle: {
    flexShrink:    1,
    minWidth:      0,
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         th.colors.text,
    letterSpacing: 1,
  },
  modalSaveBtn: {
    flexShrink:        0,
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  modalSaveBtnText: {
    fontSize:   typography.base,
    fontWeight: typography.bold,
    color:      th.colors.onAccent,
  },
  notesInput: {
    backgroundColor: th.colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.accent, 0.4),
    borderRadius:    th.radius.md,
    color:           th.colors.text,
    fontSize:        typography.base,
    lineHeight:      typography.base * 1.7,
    padding:         spacing.md,
    minHeight:       140,
  },
  notesHint: {
    fontSize: typography.xs,
    color:    th.colors.mutedLight,
  },
});
