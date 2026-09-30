/**
 * DialogHost — pinta lo que pide `showDialog` (ver `ui/dialog.js`). Se monta
 * una sola vez en la raíz, como el Toast.
 *
 * Maqueta aprobada en docs/mockups/confirm.html (U33): diálogo centrado en
 * `surface` y `radius/lg`, título `heading`, una frase en `body` y botones de
 * 44 con la voz de `button`. Detrás, el mismo velo negro al 60 % que ponen
 * las hojas (`DragSheet`): el blur se descartó porque en Android no difumina
 * lo que hay debajo de un `Modal`.
 *
 * Centrado y no hoja inferior: desde U30 una hoja es elegir entre opciones, y
 * muchas confirmaciones salen desde una hoja abierta.
 *
 * Es un `Modal` para quedar por encima de las hojas, que también lo son.
 * Tocar el velo o el atrás de Android es pulsar Cancelar (o el único botón).
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './Text';
import { setDialogListener } from './dialog';
import { spacing, textStyles } from '../../theme';
import { useThemedStyles } from '../../useTheme';

export default function DialogHost() {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  // El contenido se queda puesto al cerrar: el `Modal` se funde con él dentro.
  const [dialog,  setDialog]  = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setDialogListener((d) => { setDialog(d); setVisible(true); });
    return () => setDialogListener(null);
  }, []);

  if (!dialog) return null;

  const given   = dialog.buttons?.length ? dialog.buttons : [{ text: t('common.understood') }];
  // Cancelar siempre a la izquierda, lo pase quien lo pase.
  const buttons = [...given].sort((a, b) => (b.style === 'cancel') - (a.style === 'cancel'));
  const single  = buttons.length === 1;
  const dismissWith = single ? buttons[0] : buttons.find((b) => b.style === 'cancel');

  // Se cierra antes de ejecutar: si la acción abre otro diálogo (un error tras
  // confirmar), ese sustituye a este en vez de cerrarse con él.
  const press = (btn) => {
    setVisible(false);
    btn?.onPress?.();
  };

  const tone = (btn) => (single || btn.style === 'cancel'
    ? 'cancel'
    : btn.style === 'destructive' ? 'danger' : 'primary');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => press(dismissWith)}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={() => press(dismissWith)} accessibilityRole="none">
        {/* El diálogo se traga los toques: si no, tocar su fondo lo cerraría. */}
        <Pressable style={styles.dialog} onPress={() => {}} accessibilityViewIsModal>
          <Text style={styles.title}>{dialog.title}</Text>
          {!!dialog.message && <Text style={styles.message}>{dialog.message}</Text>}
          <View style={styles.buttons}>
            {buttons.map((btn) => (
              <TouchableOpacity
                key={btn.text}
                style={[styles.btn, styles[tone(btn)]]}
                onPress={() => press(btn)}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={[styles.btnText, styles[`${tone(btn)}Text`]]} numberOfLines={1}>{btn.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // El velo de `DragSheet`: negro al 60 %.
  scrim: {
    flex:              1,
    backgroundColor:   'rgba(0,0,0,0.6)',
    justifyContent:    'center',
    paddingHorizontal: spacing.xxl,
  },
  dialog: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    padding:         spacing.xl,
  },
  title:   { ...textStyles.heading, color: th.colors.text },
  message: { ...textStyles.body, lineHeight: 21, color: th.colors.mutedLight, marginTop: spacing.sm },
  buttons: { flexDirection: 'row', gap: spacing.sm2, marginTop: spacing.xl },
  btn: {
    flex:              1,
    height:            44,
    borderRadius:      th.radius.md,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.sm2,
  },
  btnText: { ...textStyles.button },
  // Los tres tonos. El rojo es el par de la hoja de borrar de Plantillas.
  cancel:      { backgroundColor: th.colors.surface2 },
  cancelText:  { color: th.colors.text },
  danger:      { backgroundColor: th.tint.red30 },
  dangerText:  { color: th.colors.redText },
  primary:     { backgroundColor: th.colors.accent },
  primaryText: { color: th.colors.onAccent },
});
