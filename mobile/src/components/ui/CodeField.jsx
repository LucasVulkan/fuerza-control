/**
 * Campo de código con autoformato + botón de pegar.
 *
 * Lo usan los dos códigos de la app, que tienen longitudes distintas:
 *   • código de cliente   → 8 caracteres, `XXXX-XXXX`      (`groups = 2`)
 *   • código de entrenador → 12 caracteres, `XXXX-XXXX-XXXX` (`groups = 3`)
 *
 * Antes cada modal tenía su propio input y su propio botón de pegar, y el guion
 * había que escribirlo a mano: aquí se pone solo, se fuerza mayúscula y se corta
 * al largo exacto, así que no se puede teclear un código con la forma mal.
 */
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';

import { formatCode } from '../../utils/codeFormat';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

export default function CodeField({
  value, onChangeText, groups = 2, onSubmitEditing, autoFocus = false, error,
}) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const [pasted, setPasted] = useState(false);

  async function handlePaste() {
    const text = await Clipboard.getStringAsync();
    if (!text?.trim()) return;
    onChangeText(formatCode(text, groups));
    setPasted(true);
    setTimeout(() => setPasted(false), 1500);
  }

  const placeholder = Array(groups).fill('XXXX').join('-');

  return (
    <View style={styles.wrap}>
      <TextInput
        style={[styles.input, !!error && styles.inputError]}
        placeholder={placeholder}
        placeholderTextColor={th.colors.muted}
        value={value}
        onChangeText={(v) => onChangeText(formatCode(v, groups))}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="done"
        maxLength={groups * 4 + (groups - 1)}
      />
      <TouchableOpacity onPress={handlePaste} style={styles.pasteBtn} activeOpacity={0.7} hitSlop={8}>
        <Text style={styles.pasteText}>{pasted ? t('common.pasted') : t('common.paste')}</Text>
      </TouchableOpacity>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  wrap: { gap: spacing.sm },
  input: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderWidth:       1,
    borderColor:       'transparent',
    // El código es el protagonista de la pantalla: Black 22 muy trackeado y
    // centrado, con cifras tabulares para que no baile al escribir.
    fontFamily:    'Inter_900Black',
    fontSize:      22,
    letterSpacing: 4,
    textAlign:     'center',
    color:         th.colors.text,
    fontVariant:   ['tabular-nums'],
  },
  inputError:  { borderColor: th.tint.red50 },
  pasteBtn:    { alignSelf: 'flex-end' },
  pasteText:   { ...textStyles.cardType, color: th.tint.accent50 },
  error:       { ...textStyles.tag, color: th.tint.red50, lineHeight: 15 },
});
