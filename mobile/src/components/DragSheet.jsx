/**
 * DragSheet — bottom sheet with drag-to-close.
 *
 * Same interaction as AppHeader's SettingsSheet: drag the handle down to
 * dismiss (>120 px or fast flick), backdrop fades with the drag, spring-in
 * on open. animationType="none" so the Modal's native animation doesn't
 * fight the Animated transform.
 */
import { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  Animated, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { spacing, typography, borders } from '../theme';
import { useThemedStyles } from '../useTheme';

export default function DragSheet({ visible, onClose, title, children }) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();

  const translateY      = useRef(new Animated.Value(900)).current;
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, 300], outputRange: [1, 0], extrapolate: 'clamp',
  });

  // Ref keeps the once-created PanResponder pointing at the latest onClose.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const close = () => {
    Animated.timing(translateY, {
      toValue: 900, duration: 240, useNativeDriver: true,
    }).start(() => onCloseRef.current());
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
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
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="box-none">
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={close} />
      </Animated.View>
      <Animated.View
        style={[styles.card, { paddingBottom: insets.bottom + spacing.xl, transform: [{ translateY }] }]}
      >
        <View {...panResponder.panHandlers} style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={close} hitSlop={8}>
            <Text style={styles.done}>{t('exerciseEditor.configDone')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (th) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    position:             'absolute',
    left:                 0,
    right:                0,
    bottom:               0,
    maxHeight:            '85%',
    backgroundColor:      th.colors.surface,
    borderTopLeftRadius:  th.radius.lg,
    borderTopRightRadius: th.radius.lg,
    borderWidth:          borders.thin,
    borderColor:          th.colors.borderCard,
    paddingHorizontal:    spacing.lg,
    paddingTop:           spacing.sm,
  },
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
  title: {
    fontSize:      typography.md,
    fontWeight:    typography.bold,
    color:         th.colors.text,
    letterSpacing: 0.5,
  },
  done: {
    fontSize:   typography.sm,
    fontWeight: typography.bold,
    color:      th.colors.accent,
  },
});
