import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, selectToast } from '../../store/useStore';
import { colors, spacing, typography, radius } from '../theme';

/**
 * Global toast overlay — renders ui.toast from the store.
 * Mount this once at the root level (inside RootNavigator).
 * It uses pointerEvents="none" so it never blocks touches.
 */
export default function Toast() {
  const insets  = useSafeAreaInsets();
  const toast   = useStore(selectToast);
  const opacity = useRef(new Animated.Value(0)).current;
  const msgRef  = useRef('');   // keep last msg visible during fade-out

  useEffect(() => {
    if (toast?.msg) {
      // New message — update ref and fade in
      msgRef.current = toast.msg;
      opacity.stopAnimation();
      Animated.timing(opacity, {
        toValue:         1,
        duration:        180,
        useNativeDriver: true,
      }).start();
    } else {
      // Toast cleared — fade out (msg stays in ref until next render)
      Animated.timing(opacity, {
        toValue:         0,
        duration:        280,
        useNativeDriver: true,
      }).start();
    }
  }, [toast?.id, toast]); // re-run when a new toast arrives OR when it's cleared

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          opacity,
          bottom: insets.bottom + 80, // above tab bar (≈56px) + margin
        },
      ]}
    >
      <Text style={styles.text} numberOfLines={2}>
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
    backgroundColor:   colors.text,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.sm + 2,
    // subtle shadow for depth
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.35,
    shadowRadius:      8,
    elevation:         8,
  },
  text: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.bg,
    textAlign:  'center',
  },
});
