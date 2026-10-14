/**
 * Los estilos de la fila de Clientes (`ClientRow`). Viven aparte porque los
 * comparten `ClientsScreen` (la fila de «Reordenar» y el botón de «Enviar todo»
 * son de la misma familia) y un fichero de componentes no puede exportar otra cosa.
 */
import { StyleSheet } from 'react-native';
import { spacing, textStyles, withOpacity } from '../theme';

export const makeRowStyles = (th) => StyleSheet.create({
  // El aire va entre el nombre y el bloque de abajo, no dentro de él: la línea
  // de programa/aviso se lee pegada al ritmo, no colgando del nombre.
  // Congelado: se ve y se abre, pero se lee como fuera de juego.
  cCardFrozen: { opacity: 0.5 },
  // Fila de la lista agrupada (C08 §4.1): las esquinas las pone la lista.
  cCard: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    // Alto fijo: la fila no crece ni encoge según lleve botón, cuadraditos o
    // aviso. 70 = las dos líneas (20 + 4 + ~16) con `space/lg` arriba y abajo.
    height:            70,
    backgroundColor:   th.colors.surface,
    paddingHorizontal: spacing.md,
  },
  cContent: { flex: 1, minWidth: 0, gap: spacing.xs2 },
  cLine: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  // Bold y no Black: el nombre manda por posición y tamaño, no compite.
  cName: {
    ...textStyles.itemTitleQuiet,
    lineHeight:         20,
    includeFontPadding: false,
    color:              th.colors.text,
    flex:               1,
    minWidth:           0,
  },
  cNameDim:    { color: th.colors.mutedLight },
  cMeta:       { ...textStyles.label, color: th.colors.mutedLight, flex: 1, minWidth: 0 },
  cMetaStrong: { ...textStyles.labelStrong, color: th.colors.text },
  // El aviso, en el mismo 12 que la meta pero en negrita: es lo que se viene a cazar.
  cAviso:      { ...textStyles.labelStrong },
  cMore:       { ...textStyles.labelStrong, color: th.colors.mutedLight },
  cLast:       { ...textStyles.label, color: th.colors.mutedLight, flexShrink: 0 },
  // Cuadraditos: uno por sesión prevista de la semana (§4.4).
  cSegs: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs2,
    flexShrink:    0,
  },
  cSeg: {
    width:           10,
    height:          10,
    borderRadius:    th.radius.xxs ?? 2,
    backgroundColor: th.colors.surface3 ?? th.colors.border,
  },
  cSegOn: { backgroundColor: th.colors.accent },
  cExtra: { ...textStyles.labelStrong, color: th.colors.accent, marginLeft: spacing.xs },
  // Botón de la fila: fondo neutro, el color va en el icono (§4.3).
  cRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flexShrink:    0,
  },
  cCta: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingVertical:   spacing.sm2,
    paddingHorizontal: spacing.md,
    borderRadius:      th.radius.sm,
    backgroundColor:   th.colors.surface3 ?? th.colors.surface2,
  },
  // La voz de todo botón (`button`, la de «+ Cliente»), sin versales: en
  // mayúsculas se comía la línea.
  cCtaText: { ...textStyles.button, color: th.colors.text },
  // Sin revisar: globo delante del botón, o muesca en la esquina (§4.5).
  cGlobe: {
    minWidth:          18,
    height:            18,
    borderRadius:      9,
    paddingHorizontal: spacing.xs2,
    alignItems:        'center',
    justifyContent:    'center',
    backgroundColor:   th.colors.accent,
  },
  cGlobeText: { ...textStyles.labelStrong, color: th.colors.onAccent, includeFontPadding: false },
  cNotch: {
    position:          'absolute',
    right:             0,
    bottom:            0,
    minWidth:          30,
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderTopLeftRadius: th.radius.md,
    backgroundColor:   th.colors.accent,
  },
  cNotchText: { ...textStyles.labelStrong, color: th.colors.onAccent, includeFontPadding: false },
  cGlow: { backgroundColor: withOpacity(th.colors.accent, 0.18) },
  // Lente (§5.2): cifra del cliente y, en adherencia, su barrita.
  cLens:     { alignItems: 'flex-end', gap: spacing.sm, minWidth: 52, flexShrink: 0 },
  cLensRow:  { flexDirection: 'row', alignItems: 'baseline' },
  cLensNum:  { ...textStyles.itemTitleQuiet, includeFontPadding: false },
  cLensUnit: { ...textStyles.label, color: th.colors.mutedLight },
  cLensBar: {
    width:           52,
    height:          4,
    borderRadius:    2,
    overflow:        'hidden',
    backgroundColor: th.colors.surface3 ?? th.colors.border,
  },
  cLensFill: { height: '100%', borderRadius: 2 },
});
