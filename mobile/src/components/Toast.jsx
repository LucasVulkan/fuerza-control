import { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, selectToast } from '../../store/useStore';
import { spacing, typography, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

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

const toastColors = (th) => ({
  success: {
    bg:     '#132d1e',
    text:   th.colors.green,
    border: withOpacity(th.colors.green, 0.28),
  },
  error: {
    bg:     '#2d1313',
    text:   th.colors.red,
    border: withOpacity(th.colors.red, 0.28),
  },
  neutral: {
    bg:     th.colors.text,
    text:   th.colors.bg,
    border: null,
  },
});

export default function Toast() {
  const insets  = useSafeAreaInsets();
  const th      = useTheme();
  const styles  = useThemedStyles(makeStyles);
  const toast   = useStore(selectToast);
  const opacity = useRef(new Animated.Value(0)).current;

  // useState (not useRef) so changing the displayed text triggers a re-render
  // immediately — prevents the brief "old toast flash" when two toasts fire quickly.
  const [displayMsg,  setDisplayMsg]  = useState('');
  const [displayType, setDisplayType] = useState('success');

  useEffect(() => {
    if (toast?.msg) {
      // Update content first so the new text is visible on the very next frame
      setDisplayMsg(toast.msg);
      setDisplayType(toast.type ?? 'success');
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

  const TOAST  = toastColors(th);
  const scheme = TOAST[displayType] ?? TOAST.neutral;

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
        {displayMsg}
      </Text>
    </Animated.View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  toast: {
    position:          'absolute',
    alignSelf:         'center',
    maxWidth:          '80%',
    borderRadius:      th.radius.full,
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
