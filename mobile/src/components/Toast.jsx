import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import Reanimated, {
  FadeInDown, FadeOut, Easing, useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import { Text } from './ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, selectToast } from '../../store/useStore';
import { spacing, withOpacity, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

/**
 * Global toast overlay — renders ui.toast from the store.
 * Mount this once at the root level (inside RootNavigator).
 * It uses pointerEvents="none" so it never blocks touches — except the variant
 * with an action (P16-07, `showToast(msg, ms, type, { label, onPress })`): it sits
 * low, full width, with a button and a bar that drains over `duration`. The
 * message may wrap the name in <b></b> to bold it.
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

// Toast con acción (Deshacer). `key` = id: otro toast lo remonta y reinicia la barra.
function ActionToast({ toast }) {
  const insets = useSafeAreaInsets();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const hideToast = useStore((s) => s.hideToast);
  const left = useSharedValue(1);
  useEffect(() => {
    left.value = withTiming(0, { duration: toast.duration, easing: Easing.linear });
  }, [left, toast.duration]);
  const barStyle = useAnimatedStyle(() => ({ width: `${left.value * 100}%` }));
  // Verde oscuro sobre el fondo claro del toast (en los temas claros el toast es oscuro: acento).
  const ink = th.scheme === 'dark' ? '#4e7a00' : th.colors.accent;

  return (
    <Reanimated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(200)}
      style={[styles.action, { bottom: insets.bottom + spacing.xxl }]}
    >
      <Text style={styles.actionMsg} numberOfLines={2}>
        {toast.msg.split(/(<b>.*?<\/b>)/).map((part, i) => (
          part.startsWith('<b>')
            ? <Text key={i} style={styles.actionBold}>{part.slice(3, -4)}</Text>
            : part
        ))}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        hitSlop={8}
        style={styles.actionBtn}
        onPress={() => { hideToast(); toast.action.onPress(); }}
      >
        <Text style={[styles.actionLabel, { color: ink }]}>{toast.action.label}</Text>
      </TouchableOpacity>
      <Reanimated.View style={[styles.bar, { backgroundColor: ink }, barStyle]} />
    </Reanimated.View>
  );
}

export default function Toast() {
  const toast = useStore(selectToast);
  return (
    <>
      <PlainToast toast={toast?.action ? null : toast} />
      {toast?.action ? <ActionToast key={toast.id} toast={toast} /> : null}
    </>
  );
}

function PlainToast({ toast }) {
  const insets  = useSafeAreaInsets();
  const th      = useTheme();
  const styles  = useThemedStyles(makeStyles);
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
    ...textStyles.body,
    textAlign: 'center',
  },
  action: {
    position:          'absolute',
    left:              spacing.lg,
    right:             spacing.lg,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    overflow:          'hidden',
    backgroundColor:   th.colors.text,
    borderRadius:      th.radius.lg,
    paddingVertical:   spacing.md,
    paddingLeft:       spacing.xl,
    paddingRight:      spacing.sm2,
    elevation:         8,
  },
  actionMsg:   { ...textStyles.body, flex: 1, color: th.colors.bg },
  actionBold:  { ...textStyles.bodyStrong, color: th.colors.bg },
  actionBtn:   { paddingVertical: spacing.sm2, paddingHorizontal: spacing.md },
  actionLabel: { ...textStyles.button },
  bar:         { position: 'absolute', left: 0, bottom: 0, height: 3 },
});
