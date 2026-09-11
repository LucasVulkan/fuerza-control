/**
 * ScreenHeader — la cabecera de las pantallas de detalle/editor: detalle y
 * editor de programa, editor de sesión, planificador de etapas y onboarding.
 *
 * Estaba copiada literalmente cinco veces y ya había divergido entre copias
 * (uppercase sí/no, `overflow` sí/no, el lado de 26 vs 33 del onboarding, y el
 * estado "no encontrado" de ProgramDetail pintando la ceja con el estilo del
 * título). Esta es la única copia.
 *
 * ── Por qué es una barra y no un título grande ─────────────────────────────
 *
 * Antes de esto fue una barra lima flotante (se cayó: ver §1 de
 * `docs/specs/cabeceras.md`) y después un título de 25px Black con una regla
 * lima de 5px debajo. Lo segundo funcionaba, pero la cabecera se leía antes que
 * el contenido en las tres pantallas donde más contenido hay. Se maquetaron
 * ocho variantes con nombres reales del generador (`docs/specs/cabeceras.md`
 * §6) y ésta es la que gana:
 *
 * - **Una fila de 56.** La identidad va arriba en `accent` y el nombre debajo
 *   en blanco: primero te sitúas, luego lees qué es esto. La cabecera
 *   deja de tener masa tipográfica propia y el contenido manda.
 * - **Alineada a la izquierda, y el botón de volver sin destino escrito.** Un
 *   `‹ Programas` centrando el título le dejaba ~180px de los 345 —26
 *   caracteres— y los arquetipos generan nombres de 43. Sin etiqueta y a la
 *   izquierda, el nombre dispone de 286 (~32 a 16px). Lo que hace que el
 *   botón se lea como botón es su caja, no la palabra.
 * - **La regla de 5px pasa a `HeaderRule`**: segmentada donde hay algo que
 *   contar (pasos del onboarding, ejercicios del entreno) y hairline donde no.
 *   La ceja llegó a estar en gris por presupuesto de acento; volvió a `accent`
 *   porque es lo primero que hay que leer y en gris se leía lo último.
 */

import { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet, InteractionManager, useWindowDimensions } from 'react-native';
import { Text, TextInput } from './Text';

import { spacing, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { NAME_MAX } from '../../utils/names';
import { ArrowIcon } from './EditorIcons';

// Alto de la regla segmentada. Fuera de la escala de `space/*` a propósito: es
// un grosor óptico, no un hueco. Se exporta porque la cabecera de WorkoutScreen
// no puede reutilizar este componente (es sticky y lleva un reloj vivo) pero sí
// tiene que llevar la misma regla.
export const HEADER_RULE_H = 3;
// Lado del botón de volver. Es también el ancho del hueco que ocupa cuando no
// hay atrás, para que el título no salte entre pasos del onboarding.
const BACK_BTN = 32;

/**
 * La regla que cierra la cabecera. Con `progress` —un booleano por unidad— sale
 * partida en segmentos: lleno en `accent`, pendiente al 25%. Sin él, una
 * hairline de 1px.
 *
 * Un segmento por unidad y `flex: 1`: con 3 pasos o con 20 ejercicios el ancho
 * se reparte solo. El hueco de 2px la lee como regla discontinua y no como
 * puntos, que es lo que la separa de unos dots de progreso.
 */
export function HeaderRule({ progress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!progress?.length) return <View style={styles.hairline} />;

  return (
    <View style={styles.ruleRow}>
      {progress.map((done, i) => (
        <View
          key={i}
          style={[
            styles.ruleSeg,
            { backgroundColor: done ? th.colors.accent : withOpacity(th.colors.accent, 0.25) },
          ]}
        />
      ))}
    </View>
  );
}

export default function ScreenHeader({
  onBack,
  eyebrow,
  title,
  // Nodo, o función que recibe el color de tinta de las acciones. Lo segundo
  // porque la tinta depende de sobre qué se pinta la cabecera, y así probar
  // otra variante sigue siendo un cambio de un solo archivo.
  right,
  // Un booleano por unidad para la regla segmentada (ver `HeaderRule`).
  progress,
  // Título editable: con `onRenameStart` el nombre es pulsable y se renombra
  // ahí mismo. No hay lápiz ni botón de confirmar — el hueco de acciones es del
  // check de "listo", y dos confirmaciones idénticas en la misma esquina no se
  // distinguen. Renombrando, la cabecera se queda SOLA: el resto se apaga tras
  // un velo y tocar en cualquier sitio confirma. Lo que recuerda que se puede
  // renombrar es "Editar nombre" en el menú de la pantalla.
  // Desplegable de título: `{ items: [{ id, label }], currentId, onSelect }`.
  // Con él el nombre lleva un chevron y abre la lista de hermanos anclada bajo
  // la cabecera — es como se salta de ejercicio o de bloque sin volver a la
  // sesión. Excluyente con el título editable: el toque solo puede hacer una
  // cosa, y ni el ejercicio ni el bloque se renombran desde aquí.
  menu,
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
  const draftLen = (draft ?? '').length;
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const { height: winH } = useWindowDimensions();

  // `autoFocus` solo basta cuando el renombrado arranca de un toque en el
  // propio nombre. Desde el menú "···" hay un `Modal` de `DragSheet`
  // desmontándose en el mismo tick y el foco se pierde con él, así que se pide
  // otra vez cuando las animaciones han terminado.
  useEffect(() => {
    if (!renaming) return undefined;
    const task = InteractionManager.runAfterInteractions(() => inputRef.current?.focus());
    return () => task.cancel();
  }, [renaming]);
  // La tinta de las acciones que pinta el llamante. Gris: el acento del cromo
  // es la ceja, el chevron y el check de "listo" — un "···" lima al lado sería
  // el cuarto y ninguno mandaría.
  const ink      = th.colors.mutedLight;

  return (
    // El envoltorio es el ancla del desplegable, y lleva el `zIndex` para pintar
    // por encima del contenido de la pantalla, que es su hermano posterior.
    <View style={styles.wrap}>
      <View style={styles.header}>
        {/* Renombrando no hay atrás: el velo cubre todo lo demás y el único
            gesto posible es confirmar. Un chevron vivo aquí se llevaría el
            nombre a medio escribir a otra pantalla. */}
        {onBack && !renaming
          ? (
            <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={10} activeOpacity={0.7}>
              <ArrowIcon size={15} color={th.colors.accent} back />
            </TouchableOpacity>
          )
          : <View style={styles.backSpacer} />}

        <View style={styles.mid}>
          {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}

          {renaming ? (
            <TextInput
              ref={inputRef}
              autoFocus
              style={styles.titleInput}
              value={draft}
              onChangeText={onDraftChange}
              onBlur={onRenameCommit}
              onSubmitEditing={onRenameCommit}
              placeholder={placeholder}
              placeholderTextColor={withOpacity(th.colors.mutedLight, 0.6)}
              returnKeyType="done"
              // Ver `utils/names.js`: el máximo se abre a lo que ya hay para no
              // recortar en Android un nombre largo de antes del límite.
              maxLength={Math.max(NAME_MAX, draftLen)}
            />
          ) : (
            <View style={styles.titleRow}>
              <Text
                style={styles.title}
                // Una línea: a 16px caben ~32 caracteres. Escribir está
                // limitado a `NAME_MAX` (25), pero lo guardado de antes puede ser
                // más largo y trunca a propósito: partirlo en dos haría que la
                // barra cambiase de alto según el programa que abras.
                numberOfLines={1}
                onPress={editable ? onRenameStart : (menu ? () => setMenuOpen((o) => !o) : undefined)}
                suppressHighlighting
              >
                {title ?? ''}
              </Text>
              {menu && (
                <TouchableOpacity
                  onPress={() => setMenuOpen((o) => !o)}
                  hitSlop={12}
                  style={[styles.titleChevron, menuOpen && styles.titleChevronOpen]}
                >
                  <ArrowIcon size={7.69} color={th.colors.mutedLight} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Renombrando, el hueco es SOLO del check que cierra el nombre: si a su
            lado siguiera el de "listo", dos checks idénticos a 20px harían que
            confirmar un nombre y salir del editor fuesen el mismo gesto. */}
        {(right && !renaming) ? (
          <View style={styles.actions}>
            {typeof right === 'function' ? right(ink) : right}
          </View>
        ) : <View style={styles.backSpacer} />}

        {/* El contador va FUERA del flujo: en el hueco de acciones ensanchaba el
            lado derecho y descentraba el título justo mientras escribes, que es
            cuando más se nota. Cae sobre el final del input, que con el texto
            centrado está vacío. Sólo mientras renombras. */}
        {editable && renaming && (
          <View style={styles.countWrap} pointerEvents="none">
            <Text style={[styles.count, draftLen > NAME_MAX && styles.countOver]}>
              {draftLen}/{NAME_MAX}
            </Text>
          </View>
        )}
      </View>

      <HeaderRule progress={progress} />

      {/* El velo. Cuelga del borde inferior de la cabecera y mide la pantalla
          entera: apaga el cuerpo para que el nombre sea lo único encendido, y
          es además el "tocar en cualquier parte para confirmar". */}
      {renaming && (
        <Pressable style={[styles.scrim, { height: winH }]} onPress={onRenameCommit} />
      )}

      {menu && menuOpen && (
        <View style={styles.menuList}>
          {menu.items.map((item) => {
            const isCurrent = item.id === menu.currentId;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuItem, isCurrent && styles.menuItemSel]}
                onPress={() => { setMenuOpen(false); menu.onSelect(item.id); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.menuText, isCurrent && styles.menuTextSel]} numberOfLines={1}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  wrap: { zIndex: 100 },
  // Una fila, no una columna: el bloque ceja+nombre es tan bajo que los iconos
  // se alinean con él sin quedar a media altura, que era el motivo de que la
  // versión anterior los subiera a una fila aparte.
  header: {
    backgroundColor:   th.colors.bg,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.lg,
    // `space/md` arriba y abajo dan los 56 de alto con el bloque de dos líneas
    // dentro. La cabecera anterior necesitaba `xxl` porque su título de 25px
    // pegado a la barra de estado se leía como desbordado; una barra de 56 no.
    paddingVertical:   spacing.md,
  },
  backBtn: {
    width:           BACK_BTN,
    height:          BACK_BTN,
    borderRadius:    th.radius.md,
    // El mismo material que las celdas del entreno: lo que dice "esto se pulsa"
    // es la caja, no el glifo — el chevron suelto dibujaba 9px de ancho.
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  backSpacer: { width: BACK_BTN },
  // Centrado: el bloque ceja+nombre se centra dentro de `mid`, y para que ese
  // centro sea el de la BARRA los dos huecos laterales miden lo mismo — de ahí
  // el `minWidth` de las acciones y el hueco que se pinta cuando no hay ninguna.
  // (Renombrando, el contador ensancha el lado derecho y el título se descentra
  // unos píxeles mientras dura.)
  mid:        { flex: 1, minWidth: 0, alignItems: 'center' },
  actions: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-end',
    minWidth:       BACK_BTN,
    gap:            spacing.lg,
  },
  // `card-type` tal cual (12 / 800 / +1.2), el token de los tags "SESIÓN X" —
  // que son exactamente este tipo de etiqueta. A 10 la ceja no aguantaba ser lo
  // primero que se lee. La caja fuerza mayúsculas porque las
  // cadenas vienen mezcladas: unas ya están en caja alta en el JSON
  // (`programView.eyebrow` → "PROGRAMA") y otras no (`planner.eyebrow` →
  // "Planificar", `editor.sessionEyebrow` → "Sesión B"). Antes cada copia de la
  // cabecera decidía por su cuenta y no coincidían.
  // En `accent`: es la línea que te sitúa, y en gris se leía después del nombre
  // en vez de antes. Revierte el "el acento se gasta una sola vez" de §6 de
  // `docs/specs/cabeceras.md` — el contraste ya estaba medido y es el mejor de
  // los dos (§1.2).
  eyebrow: {
    ...textStyles.caps,
    color:         th.colors.accent,
    textTransform: 'uppercase',
  },
  // 16 ExtraBold con tracking negativo: el tamaño de `text/Exercice`, la línea
  // con más peso de la barra. Muy por debajo de los 25px Black de antes, pero a
  // 14 el nombre pesaba menos que el propio contenido.
  title: {
    ...textStyles.heading,
    color:      th.colors.text,
    textAlign:  'center',
    flexShrink: 1,
  },
  // Título y chevron del desplegable como una sola fila centrada: el chevron
  // cuelga del nombre, no del borde de la barra, para que se lea como parte de
  // él. `minWidth: 0` en el texto o un nombre largo empuja al chevron fuera.
  // El `marginTop` que separa el nombre de la ceja vive aquí y no en el texto:
  // puesto en el texto, el chevron quedaba 2px más alto que el nombre.
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    maxWidth:      '100%',
    marginTop:     spacing.xs,
  },
  titleChevron:     { transform: [{ rotate: '90deg'  }] },
  titleChevronOpen: { transform: [{ rotate: '270deg' }] },

  // Mismo negro que el backdrop de `DragSheet`: apagar el fondo ya tiene un
  // material en la app y no hacía falta otro.
  scrim: {
    position:        'absolute',
    top:             '100%',
    left:            0,
    right:           0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  // Cuelga del borde inferior de la cabecera —regla incluida— a todo el ancho.
  menuList: {
    position:          'absolute',
    top:               '100%',
    left:              0,
    right:             0,
    backgroundColor:   th.colors.surface2,
    borderBottomLeftRadius:  th.radius.sm,
    borderBottomRightRadius: th.radius.sm,
    overflow:          'hidden',
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius:  10,
    elevation:     12,
  },
  menuItem:    { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  menuItemSel: { backgroundColor: th.tint.accent10 },
  menuText:    { ...textStyles.body, color: th.colors.mutedLight },
  menuTextSel: { color: th.colors.text },

  // El input no tiene ancho propio: centrado por `alignItems` mediría cero, así
  // que ocupa todo `mid` y lo que se centra es su texto.
  titleInput: {
    ...textStyles.heading,
    color:     th.colors.text,
    marginTop: spacing.xs,
    padding:   0,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  // Pegado al hueco de acciones por la derecha y centrado en el alto de la barra.
  countWrap: {
    position:       'absolute',
    right:          spacing.lg + BACK_BTN + spacing.md,
    top:            0,
    bottom:         0,
    justifyContent: 'center',
  },
  count: {
    ...textStyles.caps,
    color:       th.colors.mutedLight,
    fontVariant: ['tabular-nums'],
  },
  countOver: { color: th.colors.red },
  hairline: { height: 1, backgroundColor: th.colors.border },
  ruleRow:  { height: HEADER_RULE_H, flexDirection: 'row', gap: 2 },
  ruleSeg:  { flex: 1, height: HEADER_RULE_H },
});
