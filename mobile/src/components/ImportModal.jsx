/**
 * Import modal — la hoja que sale tras leer un .fitdata.
 *
 * Maqueta aprobada: docs/mockups/import.html (variante B) y choice.html (U40).
 * Es una `DragSheet` (U34); cancelar es cerrarla. Por dentro, las piezas de la
 * app y ninguna propia:
 *
 *   - Backup completo: lo que solo se activa o no (programa, ejercicios
 *     propios, clientes) va en filas con interruptor; historial y plantillas,
 *     que además pueden borrar lo que tienes, son una elección de tres con
 *     `ChoiceRow` (no importar · añadir · sustituir). Esas dos nacen SIN
 *     elegir: elegir mal borra datos (regla de `ChoiceRow`). Mientras falte
 *     alguna, «Importar» va apagado y, si se pulsa, su sección dice
 *     «Elige una» en rojo.
 *   - Programa: las formas de importarlo como `ChoiceRow` con su explicación.
 *     Aquí hay una opción segura evidente, así que viene elegida.
 *
 * Lo que el archivo no trae sale apagado («No hay en este archivo»), y las
 * elecciones de algo que no viene ni se enseñan.
 *
 * Props:
 *   fileName    — original file name
 *   parsedData  — already-parsed JSON object
 *   onImport(parsedData, sections) — called when user confirms
 *   onClose     — called to dismiss
 */
import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './ui/Text';
import DragSheet from './DragSheet';
import { Section, SectionLabel, MenuRow, ChoiceRow, RowIcon } from './ui/MenuList';
import { ROW_ICON } from './ui/rowIcons';
import { Switch } from './ui/EditorRows';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

// ── Formas de importar un programa ────────────────────────────────────────────

const PROGRAM_MODES = (hasLog) => [
  ...(hasLog ? [
    { id: 'full',     key: 'modeFull',    icon: ROW_ICON.import,  sections: { program: true,  log: true } },
    { id: 'log_only', key: 'modeLogOnly', icon: ROW_ICON.history, sections: { program: false, log: true } },
  ] : []),
  { id: 'program_only', key: 'modeProgramOnly', icon: ROW_ICON.text, sections: { program: true, log: false } },
];

// ── Una parte que se elige: no importar · añadir · sustituir ──────────────────

function ChoiceSection({ title, value, onChange, missing, replaceKey }) {
  const { t } = useTranslation();
  const th = useTheme();
  const s = useThemedStyles(makeS);
  const options = [
    { id: 'none',    icon: ROW_ICON.skip, label: t('import.choiceNone') },
    { id: 'merge',   icon: ROW_ICON.new,  label: t('import.choiceMerge') },
    { id: 'replace', icon: ROW_ICON.sync, label: t(replaceKey), danger: true },
  ];
  return (
    <View>
      {/* El título a la izquierda y lo que falta a la derecha, en la misma
          línea: donde está el problema, sin empujar el título. */}
      <View style={s.choiceHead}>
        <SectionLabel style={s.choiceTitle}>{title}</SectionLabel>
        {missing && <Text style={s.missing}>{t('import.pickOne')}</Text>}
      </View>
      <Section style={s.section}>
        {options.map((o) => (
          <ChoiceRow
            key={o.id}
            icon={<RowIcon color={o.danger ? th.colors.redText : undefined}>{o.icon}</RowIcon>}
            label={o.label}
            labelColor={o.danger ? th.colors.redText : undefined}
            selected={value === o.id}
            onPress={() => onChange(o.id)}
          />
        ))}
      </Section>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ImportModal({ fileName, parsedData, onImport, onClose }) {
  const { t } = useTranslation();
  const s = useThemedStyles(makeS);

  const isBackup = (parsedData?.exportType ?? 'program') === 'full';
  const logCount = (parsedData?.workoutLog ?? []).length;
  const hasLog   = logCount > 0;

  // ── Qué trae el archivo ──
  const hasPrograms = Object.keys(parsedData?.programs ?? {}).length > 0 || !!parsedData?.program;
  // Los presets de bloque entran por la casilla de ejercicios (ver `importData`),
  // así que también la habilitan: un backup con presets y sin ejercicios propios
  // la dejaba apagada y no había forma de traerlos.
  const custExCount = Object.keys(parsedData?.customExercises ?? {}).length;
  const hasCustEx   = custExCount > 0 || (parsedData?.blockPresets ?? []).length > 0;
  const clientCount = Object.keys(parsedData?.clients ?? {}).length;
  const tplCount    = Object.values(parsedData?.programs ?? {}).filter((p) => (p.kind ?? p.mode) === 'template').length;

  // ── Backup: interruptores y las dos elecciones (null = sin elegir) ──
  const [on, setOn] = useState({ program: hasPrograms, customExercises: hasCustEx, clients: clientCount > 0 });
  const [logChoice, setLogChoice] = useState(null);
  const [tplChoice, setTplChoice] = useState(null);
  const [showMissing, setShowMissing] = useState(false);

  // ── Programa: viene elegida la primera ──
  const modes = PROGRAM_MODES(hasLog);
  const [mode, setMode] = useState(modes[0].id);

  const logMissing = isBackup && hasLog && !logChoice;
  const tplMissing = isBackup && tplCount > 0 && !tplChoice;
  const missing    = logMissing || tplMissing;
  const nothing    = isBackup
    && !on.program && !on.customExercises && !on.clients
    && (logChoice ?? 'none') === 'none' && (tplChoice ?? 'none') === 'none';
  const ready = !missing && !nothing;

  function handleImport() {
    if (!ready) {
      // Apagado pero pulsable: señala lo que falta y no hace nada más.
      setShowMissing(true);
      return;
    }
    if (isBackup) {
      const log = (logChoice ?? 'none') !== 'none';
      const tpl = (tplChoice ?? 'none') !== 'none';
      onImport(parsedData, {
        ...on,
        log,
        logMode:       log ? logChoice : 'merge',
        templates:     tpl,
        templatesMode: tpl ? tplChoice : 'merge',
      });
    } else {
      onImport(parsedData, modes.find((m) => m.id === mode).sections);
    }
  }

  const typeLabel = isBackup ? t('import.typeFullBackup')
    : hasLog ? t('import.typeProgramWithLog') : t('import.typeProgram');
  const notInFile = t('import.notInFile');
  const toggle = (key) => setOn((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <DragSheet visible onClose={onClose} title={t('import.title')}>
      <View style={s.body}>
        {/* El tipo va detrás del nombre, en versales lima: antes era una pastilla. */}
        <View style={s.fileRow}>
          <Text style={s.fileName} numberOfLines={1}>{fileName}</Text>
          <Text style={s.fileType}>{`· ${typeLabel}`}</Text>
        </View>

        {isBackup ? (
          <>
            <Section style={s.section}>
              <MenuRow
                icon={<RowIcon>{ROW_ICON.text}</RowIcon>}
                label={t('import.sectionProgram')}
                sub={hasPrograms ? t('import.sectionProgramDesc') : notInFile}
                disabled={!hasPrograms}
                onPress={() => toggle('program')}
                control={<Switch value={on.program} />}
              />
              <MenuRow
                icon={<RowIcon>{ROW_ICON.exercise}</RowIcon>}
                label={t('import.sectionCustomExercises')}
                sub={hasCustEx ? t('common.exercises', { count: custExCount }) : notInFile}
                disabled={!hasCustEx}
                onPress={() => toggle('customExercises')}
                control={<Switch value={on.customExercises} />}
              />
              <MenuRow
                icon={<RowIcon>{ROW_ICON.user}</RowIcon>}
                label={t('import.sectionClients')}
                // Solo suma: los del archivo se añaden (o actualizan el mismo
                // cliente) y los tuyos que no vienen se quedan.
                sub={clientCount > 0 ? t('import.clientsDesc', { count: clientCount }) : notInFile}
                disabled={clientCount === 0}
                onPress={() => toggle('clients')}
                control={<Switch value={on.clients} />}
              />
            </Section>

            {hasLog && (
              <ChoiceSection
                title={t('import.logTitle', { count: logCount })}
                value={logChoice}
                onChange={setLogChoice}
                missing={showMissing && logMissing}
                replaceKey="import.logReplace"
              />
            )}
            {tplCount > 0 && (
              <ChoiceSection
                title={t('import.templatesTitle', { count: tplCount })}
                value={tplChoice}
                onChange={setTplChoice}
                missing={showMissing && tplMissing}
                replaceKey="import.templatesReplace"
              />
            )}
          </>
        ) : (
          <Section style={s.section}>
            {modes.map((m) => (
              <ChoiceRow
                key={m.id}
                icon={<RowIcon>{m.icon}</RowIcon>}
                label={t(`import.${m.key}`)}
                sub={t(`import.${m.key}Desc`)}
                subLines={0}
                minHeight={62}
                selected={mode === m.id}
                onPress={() => setMode(m.id)}
              />
            ))}
          </Section>
        )}

        <TouchableOpacity
          style={[s.cta, !ready && s.ctaOff]}
          onPress={handleImport}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={[s.ctaText, !ready && s.ctaTextOff]}>{t('import.importBtn')}</Text>
        </TouchableOpacity>
      </View>
    </DragSheet>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeS = (th) => StyleSheet.create({
  body:     { gap: spacing.lg, paddingBottom: spacing.sm },
  fileRow:  { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  fileName: { ...textStyles.label, color: th.colors.mutedLight, flexShrink: 1 },
  fileType: { ...textStyles.caps, color: th.colors.accent, textTransform: 'uppercase', flexShrink: 0 },
  // `Section` trae su margen de separar secciones; aquí lo pone el `gap`.
  section:  { marginBottom: 0 },
  // Título de una elección con «Elige una» a la derecha, en rojo.
  choiceHead:  { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm2 },
  choiceTitle: { marginBottom: 0, flexShrink: 1 },
  missing:     { ...textStyles.labelStrong, color: th.colors.redText, paddingHorizontal: spacing.xs2 },
  // El botón de la app: lima, 44, `radius/md`. Apagado mientras falte algo,
  // pero pulsable (como «Añadir» en Nuevo ejercicio).
  cta: {
    height:          44,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  ctaOff:     { backgroundColor: th.colors.surface2 },
  ctaText:    { ...textStyles.button, color: th.colors.onAccent },
  ctaTextOff: { color: th.colors.muted },
});
