/**
 * EditorIdentityCard — la tarjeta gris que abre cada pantalla del editor (P16-03):
 * ceja (dónde estás), nombre y cifras de lo que editas. Sustituye al Resumen
 * tintado de lima de sesión y ejercicio, y es la primera pieza de programa y
 * bloque. Maquetas: `docs/mockups/editor-salida-5.html`, `editor-ejercicio.html`.
 *
 * Props:
 *  - `eyebrow`     ceja ya traducida («Sesión A · Etapa 1»); se pinta en versales.
 *  - `clientName`  programa de un cliente: «· MARTA» tras la ceja, en el azul de cliente.
 *  - `name`        el nombre; `emptyName`, lo que se enseña si está vacío (sesión libre).
 *  - `stats`       `[{ n, label }]`: número en Barlow + unidad en gris.
 *  - `line`        o una sola línea de texto (la de volumen del ejercicio).
 *  - `onRename`    con él sale el lápiz → hoja con el campo Nombre. «Hecho» escribe
 *                  en el store (entra en el borrador, P16-01) y no guarda aparte.
 *                  `renameTitle`: el título de la hoja. Sin `onRename`, sin lápiz.
 *  - `corner`      HUECO de la esquina superior derecha para el botón de lista de
 *                  P16-04 (ejercicio y bloque; ~70 de ancho, 30 de alto). Ocupa la
 *                  misma esquina que el lápiz, así que ninguna pantalla pasa los dos.
 *  - `onLayout`    para medir la tarjeta: `useEditorFold` pliega la cabecera cuando
 *                  sale de pantalla.
 *  - `children`    lo que va bajo una línea fina (regla de progresión, vinculado…).
 */
import { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import NameField from '../ui/NameField';
import { SectionLabel } from '../ui/MenuList';
import { PencilIcon } from '../ui/EditorIcons';
import DragSheet from '../DragSheet';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

// Espera antes de pedir el foco del nombre: la hoja es un `Modal` y en Android
// otra ventana; pedirlo antes de que termine de entrar deja el cursor puesto y el
// teclado sin salir. Es el botón de calibrado: si un dispositivo lento se queda
// sin teclado, súbelo.
const FOCUS_DELAY = 300;
// Hueco que el nombre deja a la derecha para el lápiz (30) o para el botón de
// lista de P16-04 (~70).
const PENCIL_ROOM = 44;
const CORNER_ROOM = 70;

export default function EditorIdentityCard({
  eyebrow, clientName, name, emptyName, stats, line, onRename, renameTitle, corner, onLayout, children,
}) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen]   = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const id = setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY);
    return () => clearTimeout(id);
  }, [open]);

  function openSheet() { setDraft(name ?? ''); setOpen(true); }
  function commit() {
    setOpen(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
  }

  return (
    <View style={styles.card} onLayout={onLayout}>
      <Text style={styles.eyebrow} numberOfLines={1}>
        {eyebrow ?? ''}
        {clientName ? <Text style={styles.client}>{` · ${clientName}`}</Text> : null}
      </Text>

      <Text
        style={[styles.name, { marginRight: onRename ? PENCIL_ROOM : corner ? CORNER_ROOM : 0 }]}
        numberOfLines={2}
      >
        {name || emptyName || ''}
      </Text>

      {stats?.length > 0 && (
        <View style={styles.stats}>
          {stats.map((s) => (
            <Text key={s.label} style={styles.stat}>
              <Text style={styles.statNum}>{s.n}</Text>{` ${s.label}`}
            </Text>
          ))}
        </View>
      )}
      {line ? <Text style={styles.line}>{line}</Text> : null}

      {children ? <View style={styles.extra}>{children}</View> : null}

      {(onRename || corner) && (
        <View style={styles.corner}>
          {onRename ? (
            <TouchableOpacity
              style={styles.pencil}
              onPress={openSheet}
              hitSlop={8}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('editor.renameOption')}
            >
              <PencilIcon size={15} color={th.colors.accent} />
            </TouchableOpacity>
          ) : corner}
        </View>
      )}

      {onRename && (
        <DragSheet visible={open} onClose={commit} title={renameTitle} doneLabel={t('editor.idNameDone')}>
          <SectionLabel>{t('editor.idNameLabel')}</SectionLabel>
          <NameField
            ref={inputRef}
            style={styles.sheetInput}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={commit}
            placeholder={emptyName ?? name}
          />
        </DragSheet>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // Padding 13/15/13/18 de la maqueta: la barra de la izquierda pide 3 más.
  card: {
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.lg,
    paddingTop:      13,
    paddingRight:    spacing.lg,
    paddingBottom:   13,
    paddingLeft:     18,
  },
  eyebrow: { ...textStyles.caps, color: th.colors.accent, textTransform: 'uppercase' },
  client:  { color: th.colors.blue },
  name: {
    ...textStyles.heroName,
    lineHeight:         32,
    includeFontPadding: false,
    color:              th.colors.text,
    marginTop:          spacing.xs2,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, alignItems: 'baseline', marginTop: 3 },
  stat:    { ...textStyles.label, color: th.colors.mutedLight, lineHeight: 20 },
  statNum: { ...textStyles.statGlyph, color: th.colors.text },
  line:    { ...textStyles.label, color: th.colors.mutedLight, marginTop: 3 },
  extra: {
    marginTop:      spacing.md,
    paddingTop:     spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap:            spacing.sm2,
  },
  corner: { position: 'absolute', top: 12, right: 12 },
  pencil: {
    width:           30,
    height:          30,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },
  // Dentro de la hoja el fondo ya es `bg`: el campo va sobre `surface` (mismo
  // criterio que `sheetInput` de las demás hojas del editor).
  sheetInput: {
    ...textStyles.labelStrong,
    color:             th.colors.text,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
  },
});
