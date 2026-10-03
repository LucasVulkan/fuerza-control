/**
 * ArchivedProgramsSheet — la lista de programas archivados, la misma para los
 * tuyos (menú ≡) y los de un cliente (ficha → Programa).
 *
 * Eran dos interfaces viejas distintas: un `Modal` propio con su velo, y filas
 * con tres iconos sueltos (ver, descargar, `⋯`). Ahora, una `DragSheet` con
 * filas de la app (`MenuRow`, con galón); tocar una abre sus opciones en otra
 * hoja, encima, con las mismas acciones en los dos sitios (U09-pulido-ui.md §14).
 *
 * La pieza no sabe de diálogos ni de toasts: recibe la lista, el historial donde
 * contar las sesiones y los callbacks, y quien la usa confirma y avisa. Reactivar,
 * Ver, Guardar y Eliminar cierran antes la lista (si abren un diálogo, que no
 * salga con la hoja yéndose); Exportar la deja abierta. Sin `onSaveTemplate` la
 * fila «Guardar como plantilla» no sale (sin PRO iría a una pestaña que no ves).
 */
import { useState, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './ui/Text';
import { Section, MenuRow } from './ui/MenuList';
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
  const [optionsId, setOptionsId] = useState(null);

  const sorted = useMemo(
    () => [...programs].sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [programs],
  );
  const selected = optionsId ? programs.find((p) => p.id === optionsId) ?? null : null;

  const locale = i18n.language?.startsWith('es') ? 'es-ES' : 'en-GB';
  function metaOf(program) {
    const { count, last } = programActivity(program, log);
    return [
      count > 0 ? t('clients.programSessions', { count }) : t('clients.noSessionsYet'),
      last ? new Date(last).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null,
    ].filter(Boolean).join(' · ');
  }

  // Cierra la lista (y suelta las opciones, que ya no tienen dónde estar) y
  // luego actúa.
  const closeThen = (fn) => () => { setOptionsId(null); onClose(); fn(selected); };

  return (
    <DragSheet visible={visible} onClose={onClose} title={t('archived.title')}>
      {sorted.length === 0 ? (
        <Text style={styles.empty}>{emptyText ?? t('archived.empty')}</Text>
      ) : (
        <Section style={styles.section}>
          {sorted.map((p) => (
            <MenuRow key={p.id} label={p.name} sub={metaOf(p)} onPress={() => setOptionsId(p.id)} />
          ))}
        </Section>
      )}

      {/* Las opciones, encima de la lista. */}
      {selected && (
        <DragSheet visible onClose={() => setOptionsId(null)} title={selected.name}>
          <Section style={styles.section}>
            <SheetRow icon={ROW_ICON.sync}   label={t('archived.reactivate')} onPress={closeThen(onReactivate)} />
            <SheetRow icon={ROW_ICON.view}   label={t('archived.view')}       onPress={closeThen(onView)} />
            <SheetRow icon={ROW_ICON.export} label={t('archived.export')}     onPress={() => onExport(selected)} />
            {onSaveTemplate && (
              <SheetRow icon={ROW_ICON.preset} label={t('archived.saveTemplate')} onPress={closeThen(onSaveTemplate)} />
            )}
            <SheetRow icon={ROW_ICON.trash}  label={t('archived.delete')}     onPress={closeThen(onDelete)} danger />
          </Section>
        </DragSheet>
      )}
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
