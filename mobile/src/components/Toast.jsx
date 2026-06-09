import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, selectToast } from '../../store/useStore';
import { colors, spacing, typography, radius, withOpacity } from '../theme';

/**
 * Global toast overlay — renders ui.toast from the store.
 * Mount this once at the root level (inside RootNavigator).
 * It uses pointerEvents="none" so it never blocks touches.
 *
 * Toast types:
 *   'success' — green  (default): save, connect, import OK
 *   'error'   — red:              something went wrong
 *   'neutral' — dark:             informational (timer, clipboard, deletions)
 */

const TOAST_COLORS = {
  success: {
    bg:     '#132d1e',
    text:   colors.green,
    border: withOpacity(colors.green, 0.28),
  },
  error: {
    bg:     '#2d1313',
    text:   colors.red,
    border: withOpacity(colors.red, 0.28),
  },
  neutral: {
    bg:     colors.text,
    text:   colors.bg,
    border: null,
  },
};

export default function Toast() {
  const insets  = useSafeAreaInsets();
  const toast   = useStore(selectToast);
  const opacity = useRef(new Animated.Value(0)).current;
  const msgRef  = useRef('');
  const typeRef = useRef('success');

  useEffect(() => {
    if (toast?.msg) {
      msgRef.current  = toast.msg;
      typeRef.current = toast.type ?? 'success';
      opacity.stopAnimation();
      Animated.timing(opacity, {
        toValue:         1,
        duration:        180,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue:         0,
        duration:        280,
        useNativeDriver: true,
      }).start();
    }
  }, [toast?.id, toast]);

  const scheme = TOAST_COLORS[typeRef.current] ?? TOAST_COLORS.neutral;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          opacity,
          bottom:          insets.bottom + 80,
          backgroundColor: scheme.bg,
          borderWidth:     scheme.border ? 1 : 0,
          borderColor:     scheme.border ?? 'transparent',
        },
      ]}
    >
      <Text style={[styles.text, { color: scheme.text }]} numberOfLines={2}>
        {msgRef.current}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position:          'absolute',
    alignSelf:         'center',
    maxWidth:          '80%',
    borderRadius:      radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.sm + 2,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.35,
    shadowRadius:      8,
    elevation:         8,
  },
  text: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    textAlign:  'center',
  },
});
