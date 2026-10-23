/**
 * EditorIdentityCard — la tarjeta que abre cada pantalla del editor (P16-03):
 * ceja (dónde estás), nombre y cifras de lo que editas. Sustituye al Resumen
 * tintado de lima de sesión y ejercicio, y es la primera pieza de programa y
 * bloque. Maquetas: `docs/mockups/editor-salida-5.html`, `editor-ejercicio.html`.
 *
 * Ceja, nombre, fondo y radio son los de la tarjeta del programa del tab
 * Programa (`HomeProgramCard`, decidido al probar P16): la misma pieza en los
 * dos sitios. Lo de debajo (`children`) va tras el mismo corte del color del
 * fondo que separa allí la fila del programa de su detalle.
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
 *  - `children`    lo que va tras el corte (regla de progresión, vinculado; en un
 *                  programa sin etapas, la etapa entera).
 */
import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import NameField from '../ui/NameField';
import { SectionLabel } from '../ui/MenuList';
import { PencilIcon } from '../ui/EditorIcons';
import DragSheet from '../DragSheet';
import { spacing, textStyles, lh, LINE } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

// Lado del lápiz: el del engranaje de la etapa, que puede ir en la misma tarjeta.
const ICON_BTN = 36;
// Hueco que el nombre deja a la derecha para el lápiz o para el botón de lista
// de P16-04 (~70).
const PENCIL_ROOM = ICON_BTN + spacing.md;
const CORNER_ROOM = 70;

export default function EditorIdentityCard({
  eyebrow, clientName, name, emptyName, stats, line, onRename, renameTitle, corner, onLayout, children,
}) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen]   = useState(false);
  const [draft, setDraft] = useState('');

  function openSheet() { setDraft(name ?? ''); setOpen(true); }
  function commit() {
    setOpen(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
  }

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View style={styles.top}>
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
      </View>

      {children ? (
        <>
          <View style={styles.cut} />
          <View style={styles.extra}>{children}</View>
        </>
      ) : null}

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
          {/* `autoFocus`, como la hoja de «Nuevo cliente» (Clientes): el campo
              se monta al abrirse el Modal. Pedir el foco con un retraso a mano
              hacía que el teclado saliera sin que la hoja subiera, o tarde. */}
          <NameField
            autoFocus
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
  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  top:     { padding: spacing.lg },
  // Ceja y nombre de `HomeProgramCard`: interlineado apretado, nombre en lima.
  eyebrow: { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase', lineHeight: lh(textStyles.caps.fontSize, LINE.tight) },
  client:  { color: th.colors.blue },
  name: {
    ...textStyles.heading,
    lineHeight: lh(textStyles.heading.fontSize, LINE.tight),
    color:      th.colors.accent,
    marginTop:  spacing.xs2,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, alignItems: 'baseline', marginTop: spacing.xs2 },
  stat:    { ...textStyles.label, color: th.colors.mutedLight, lineHeight: 20 },
  statNum: { ...textStyles.statGlyph, color: th.colors.text },
  line:    { ...textStyles.label, color: th.colors.mutedLight, marginTop: spacing.xs2 },
  // El corte de `ProgramCardDetail`: 4 dp del color del fondo, de lado a lado.
  cut:   { height: spacing.xs2, backgroundColor: th.colors.bg },
  extra: { padding: spacing.lg, gap: spacing.sm2 },
  // En el borde del relleno: el engranaje de la etapa, debajo, cae en la misma vertical.
  corner: { position: 'absolute', top: spacing.lg, right: spacing.lg },
  pencil: {
    width:           ICON_BTN,
    height:          ICON_BTN,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.surface2,
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
