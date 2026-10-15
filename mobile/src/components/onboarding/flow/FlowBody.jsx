/**
 * FlowBody — el cuerpo de cada pantalla del recorrido de entrada: el contenido en
 * un scroll y, debajo, el pie fijo (`FlowFooter` o `FlowPanel`). Es quien arranca
 * el reloj de la entrada por partes (O03 §3.1.6): titular, texto y opciones suben
 * en su turno, 45 ms entre una y otra (`Rise`). Una pantalla = un `FlowBody`
 * montado, así que el reloj arranca una vez por pantalla y no al repintar.
 *
 * El teclado empuja el pie: sin eso, las pantallas con un campo (el nombre del
 * cliente, el código) no dejarían ver el botón.
 */
import { useEffect } from 'react';
import { ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSharedValue, withTiming, Easing, useReducedMotion } from 'react-native-reanimated';

import { EnterClock, ENTER_MS } from '../../../hooks/useEnterClock';
import { spacing } from '../../../theme';

export default function FlowBody({ footer, children, contentStyle }) {
  const reduced = useReducedMotion();
  const clock   = useSharedValue(reduced ? ENTER_MS : 0);

  useEffect(() => {
    if (!reduced) clock.set(withTiming(ENTER_MS, { duration: ENTER_MS, easing: Easing.linear }));
  }, [clock, reduced]);

  return (
    <EnterClock.Provider value={clock}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </EnterClock.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow:          1,
    paddingHorizontal: spacing.lg + 1,
    paddingTop:        spacing.xl - 2,
    paddingBottom:     spacing.lg,
  },
});
