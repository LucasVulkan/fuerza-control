/**
 * ArchivedProgramsSheet — la lista de programas archivados, la misma para los
 * tuyos (menú ≡) y los de un cliente (ficha → Programa).
 *
 * Eran dos interfaces viejas distintas: un `Modal` propio con su velo, y filas
 * con tres iconos sueltos (ver, descargar, `⋯`). Ahora, UNA `DragSheet` con dos
 * páginas, como `AssignProgramSheet` de Clientes: la lista (`MenuRow` con
 * galón) y, al tocar un programa, la suya de opciones, que entra deslizando por
 * la derecha con el nombre de título y un ‹ que vuelve (U09-pulido-ui.md §14,
 * §14.1). Antes las opciones eran una segunda hoja encima de la lista, y era la
 * única pareja de hojas apiladas de la app.
 *
 * La pieza no sabe de diálogos ni de toasts: recibe la lista, el historial donde
 * contar las sesiones y los callbacks, y quien la usa confirma y avisa. Las
 * `SheetRow` cierran la hoja entera por su cuenta (`sheet.dismiss()`, que acaba
 * en `onClose`) y llaman a su acción a la vez; Exportar es una `MenuRow` suelta
 * para NO cerrar y quedarse en las opciones. Sin `onSaveTemplate` la fila
 * «Guardar como plantilla» no sale (sin PRO iría a una pestaña que no ves).
 */
import { useState, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './ui/Text';
import Reanimated from 'react-native-reanimated';

import { Section, MenuRow, RowIcon } from './ui/MenuList';
import AnimatedHeight from './ui/AnimatedHeight';
import { useSlidePages } from './ui/useSlidePages';
import SheetRow from './ui/SheetRow';
import { ROW_ICON } from './ui/rowIcons';
import DragSheet from './DragSheet';
import { allProgramDays } from '../utils/stageProgress';
import { programTemplateOf } from '../utils/freeSessions';
import { spacing, textStyles } from '../theme';
import { useThemedStyles } from '../useTheme';

// Sesiones del historial que cuentan para este programa y la fecha de la última.
function programActivity(program, log) {
  const ids      = new Set(allProgramDays(program).map((d) => d.sessionTemplateId));
  const sessions = log.filter((e) => ids.has(programTemplateOf(e)));
  return {
    count: sessions.length,
    last:  sessions.length ? Math.max(...sessions.map((e) => e.timestamp)) : null,
  };
}

/**
 * `programs`: los archivados, en cualquier orden (aquí se ordenan por `archivedAt`).
 * `log`: el historial del dueño de esos programas.
 * `emptyText`: lo que dice la lista vacía (por defecto, el genérico).
 */
export default function ArchivedProgramsSheet({
  visible, onClose, programs, log, emptyText,
  onReactivate, onView, onExport, onSaveTemplate, onDelete,
}) {
  const { t, i18n } = useTranslation();
  const styles      = useThemedStyles(makeStyles);
  // El programa abierto en su página de opciones; null = la lista.
  const [optionsId, setOptionsId] = useState(null);
  const { slide, pageEntering, pageExiting } = useSlidePages();

  const sorted = useMemo(
    () => [...programs].sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [programs],
  );
  // Si el programa desaparece estando en sus opciones, `selected` es null y la
  // hoja vuelve sola a la lista.
  const selected = optionsId ? programs.find((p) => p.id === optionsId) ?? null : null;

  // Al reabrir sale la lista, no las opciones de la vez anterior (ajuste durante
  // el render, no un efecto: la hoja ya no se ve cuando `visible` pasa a false).
  if (!visible && optionsId) setOptionsId(null);

  const locale = i18n.language?.startsWith('es') ? 'es-ES' : 'en-GB';
  function metaOf(program) {
    const { count, last } = programActivity(program, log);
    return [
      count > 0 ? t('clients.programSessions', { count }) : t('clients.noSessionsYet'),
      last ? new Date(last).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null,
    ].filter(Boolean).join(' · ');
  }

  function open(id) { slide(1); setOptionsId(id); }
  function back()   { slide(-1); setOptionsId(null); }

  return (
    <DragSheet
      visible={visible}
      onClose={onClose}
      title={selected ? selected.name : t('archived.title')}
      onBack={selected ? back : undefined}
    >
      <AnimatedHeight>
        <Reanimated.View key={selected ? 'options' : 'list'} entering={pageEntering} exiting={pageExiting}>
          {selected ? (
            <Section style={styles.section}>
              <SheetRow icon={ROW_ICON.sync} label={t('archived.reactivate')} onPress={() => onReactivate(selected)} />
              <SheetRow icon={ROW_ICON.view} label={t('archived.view')}       onPress={() => onView(selected)} />
              {/* `MenuRow` y no `SheetRow`: no cierra la hoja. */}
              <MenuRow
                icon={<RowIcon>{ROW_ICON.export}</RowIcon>}
                label={t('archived.export')}
                onPress={() => onExport(selected)}
              />
              {onSaveTemplate && (
                <SheetRow icon={ROW_ICON.preset} label={t('archived.saveTemplate')} onPress={() => onSaveTemplate(selected)} />
              )}
              <SheetRow icon={ROW_ICON.trash} label={t('archived.delete')} onPress={() => onDelete(selected)} danger />
            </Section>
          ) : sorted.length === 0 ? (
            <Text style={styles.empty}>{emptyText ?? t('archived.empty')}</Text>
          ) : (
            <Section style={styles.section}>
              {sorted.map((p) => (
                <MenuRow key={p.id} label={p.name} sub={metaOf(p)} onPress={() => open(p.id)} />
              ))}
            </Section>
          )}
        </Reanimated.View>
      </AnimatedHeight>
    </DragSheet>
  );
}

const makeStyles = (th) => StyleSheet.create({
  section: { marginBottom: spacing.sm },
  empty: {
    ...textStyles.label,
    color:           th.colors.mutedLight,
    textAlign:       'center',
    paddingVertical: spacing.xl,
  },
});
