/**
 * ScreenHeader — la cabecera de las pantallas de detalle/editor: detalle y
 * editor de programa, editor de sesión, planificador de etapas y onboarding.
 *
 * Estaba copiada literalmente cinco veces y ya había divergido entre copias
 * (uppercase sí/no, `overflow` sí/no, el lado de 26 vs 33 del onboarding, y el
 * estado "no encontrado" de ProgramDetail pintando la ceja con el estilo del
 * título). Esta es la única copia.
 *
 * ── Por qué ya no es una barra accent ──────────────────────────────────────
 *
 * La barra lima flotante (margen 15, radio, alto fijo 72, título centrado) se
 * cayó en tres sitios a la vez, y los tres se ven en cuanto entra contenido
 * real — los arquetipos generan nombres como "Full Body · Hipertrofia · Barra
 * libre" y "Empuje vertical, tracción y pierna anterior" (43 caracteres):
 *
 * 1. **Ancho.** Con el chevron a un lado y el ⋮ al otro al título le quedaban
 *    ~250px a 20px de cuerpo: cortaba a mitad de palabra casi siempre. Aquí el
 *    título ocupa el ancho entero y admite dos líneas, así que cabe.
 * 2. **Contraste.** La ceja salía de `colors.muted`, un gris definido contra el
 *    fondo oscuro pero pintado encima del accent: 1.66:1 en `earthy`, 2.35:1 en
 *    `midnight`, 3.29:1 en `space`. Sobre el fondo de la app la ceja va en
 *    `accent`, que es el par que la app ya usa en todas partes.
 * 3. **Presupuesto de acento.** Una losa lima arriba compite con el lima de los
 *    datos (el número de ejercicio, el borde del Resumen, el segmento activo).
 *    Reducido a una regla de 5px, el acento vuelve a significar algo cuando
 *    aparece en el contenido.
 *
 * La solidez la da la masa tipográfica (25px Black, interlineado 1.06, tracking
 * negativo) y la regla que ancla la cabecera al contenido, no el bloque de
 * color.
 */

import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

import { spacing, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { ArrowIcon, PencilIcon, CheckIcon } from './EditorIcons';

// Alto de la regla accent. Fuera de la escala de `space/*` a propósito: es un
// grosor óptico, no un hueco — a 2px se lee como borde y a 10 como franja.
// Se exporta porque la cabecera de WorkoutScreen no puede reutilizar este
// componente (es sticky y colapsa) pero sí tiene que llevar la misma regla.
export const HEADER_RULE_H = 5;
// Ancho del chevron (`ArrowIcon` dibuja size*0.6 de ancho): es también el del
// hueco que ocupa cuando no hay atrás, para que la ceja no salte entre pasos
// del onboarding.
const BACK_W = 15 * 0.6;

export default function ScreenHeader({
  onBack,
  eyebrow,
  title,
  // Nodo, o función que recibe el color de tinta de la cabecera. Lo segundo
  // porque la tinta depende de sobre qué se pinta la cabecera, y así probar
  // otra variante sigue siendo un cambio de un solo archivo.
  right,
  // Título editable: con `onRenameStart` aparece el lápiz y el título es
  // pulsable. El estado (`renaming`/`draft`) se queda en la pantalla porque el
  // editor de programa lo mira para avisar de cambios sin guardar al salir.
  renaming = false,
  draft = '',
  onDraftChange,
  onRenameStart,
  onRenameCommit,
  placeholder,
}) {
  const th       = useTheme();
  const styles   = useThemedStyles(makeStyles);
  const editable = typeof onRenameStart === 'function';
  // Sobre el fondo de la app la tinta de la cabecera es el accent, no `onAccent`.
  const ink      = th.colors.accent;

  return (
    <>
      <View style={styles.header}>
        <View style={styles.topRow}>
          {onBack
            ? (
              <TouchableOpacity onPress={onBack} hitSlop={14} activeOpacity={0.6}>
                <ArrowIcon size={15} color={th.colors.accent} back />
              </TouchableOpacity>
            )
            : <View style={styles.backSpacer} />}

          {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : <View style={styles.grow} />}

          {(editable || right) && (
            <View style={styles.actions}>
              {editable && (
                <TouchableOpacity hitSlop={12} onPress={renaming ? onRenameCommit : onRenameStart}>
                  {renaming
                    ? <CheckIcon  size={17} color={th.colors.accent} />
                    : <PencilIcon size={15} color={th.colors.accent} />}
                </TouchableOpacity>
              )}
              {typeof right === 'function' ? right(ink) : right}
            </View>
          )}
        </View>

        {renaming ? (
          <TextInput
            autoFocus
            style={styles.titleInput}
            value={draft}
            onChangeText={onDraftChange}
            onBlur={onRenameCommit}
            onSubmitEditing={onRenameCommit}
            placeholder={placeholder}
            placeholderTextColor={withOpacity(th.colors.mutedLight, 0.6)}
            returnKeyType="done"
          />
        ) : (
          <Text
            style={styles.title}
            // Dos líneas: un nombre de arquetipo no cabe en una y truncarlo a
            // la primera palabra no distingue "Full Body · Hipertrofia" de
            // "Full Body · Hipertrofia · Barra libre".
            numberOfLines={2}
            onPress={editable ? onRenameStart : undefined}
            suppressHighlighting
          >
            {title ?? ''}
          </Text>
        )}
      </View>

      <View style={styles.rule} />
    </>
  );
}

const makeStyles = (th) => StyleSheet.create({
  header: {
    backgroundColor:   th.colors.bg,
    paddingHorizontal: spacing.lg,
    // `space/xxl`, un escalón por encima del `xl` que pedía el mockup: pegada
    // a la barra de estado la cabecera se leía como si se hubiera desbordado.
    paddingTop:        spacing.xxl,
    paddingBottom:     spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
    marginBottom:  spacing.md,
  },
  backSpacer: { width: BACK_W },
  grow:       { flex: 1 },
  actions:    { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  // `spacing-tag` un punto más grande: a 10px el tracking de 2 lo deshacía.
  // La caja fuerza mayúsculas porque las cadenas vienen mezcladas: unas ya están
  // en caja alta en el JSON (`programView.eyebrow` → "PROGRAMA") y otras no
  // (`planner.eyebrow` → "Planificar", `editor.sessionEyebrow` → "Sesión B").
  // Antes cada copia de la cabecera decidía por su cuenta y no coincidían.
  eyebrow: {
    ...textStyles.spacingTag,
    fontSize:      11,
    letterSpacing: 2.4,
    color:         th.colors.accent,
    textTransform: 'uppercase',
    flex:          1,
    minWidth:      0,
  },
  // `text/hero` subido de talla con el interlineado por debajo de 1.1 y tracking
  // negativo: la solidez sale de la masa de tinta, no del tamaño suelto.
  title: {
    ...textStyles.hero,
    fontSize:      25,
    lineHeight:    26,
    letterSpacing: -0.5,
    color:         th.colors.text,
  },
  titleInput: {
    ...textStyles.hero,
    fontSize:      25,
    lineHeight:    26,
    letterSpacing: -0.5,
    color:         th.colors.text,
    padding:       0,
  },
  rule: { height: HEADER_RULE_H, backgroundColor: th.colors.accent },
});
