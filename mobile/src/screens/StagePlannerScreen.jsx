/**
 * StagePlannerScreen — el plan de un programa: sus etapas en el orden en que
 * van a pasar, y el sitio desde donde se añaden más.
 *
 * ── Por qué es una línea de tiempo y no una lista ────────────────────────────
 *
 * Se entra pulsando el `+` del `StageSelector`, así que lo primero que se ve
 * —tus etapas de ahora— parecía "lo que voy a añadir", un carrito de la compra.
 * Tres cosas lo provocaban, y la más fuerte era la última: un botón de acento a
 * pie de lista es un "confirmar", diga lo que diga la cabecera.
 *
 *   1. El marcador de cada etapa cuelga de una línea vertical, con su estado
 *      (hecha · en curso · por venir). Cuatro tarjetas sueltas son inventario;
 *      cuatro puntos en una línea son un programa en marcha.
 *   2. Lo nuevo se añade desde un HUECO PUNTEADO al final de esa misma línea,
 *      que continúa la numeración. Dice por sí solo "lo que venga aterriza
 *      aquí, detrás", que es lo que hace `addStageLadder`.
 *   3. Y las palabras: "plan del programa", "ya en el programa".
 *
 * ── La tarjeta es un acordeón ────────────────────────────────────────────────
 *
 * Mismo patrón que el panel de Info de la ficha de cliente (`InfoSection`):
 * cabecera con el resumen a la derecha, filete a sangre y `collapseOut` al
 * plegar. Plegada se lee de un vistazo; desplegada trae nombre, semanas, candado,
 * duplicar y eliminar — todo lo que iba a vivir en una hoja aparte, que así no
 * hace falta.
 *
 * El stepper de semanas SOLO existe desplegada: pedía la fila entera (76 px de
 * celda más dos botones) para un número que se toca una vez en la vida de la
 * etapa. Plegada, las semanas son texto.
 *
 * ── Lo que no cambia ─────────────────────────────────────────────────────────
 *
 * Nada del store. `addStageLadder` y `addStageToProgram` siguen añadiendo al
 * final: no se inserta en medio ni se reordena, porque eso movería las etapas
 * por debajo del `currentStageIndex` que el cliente guarda en su blob de
 * progreso, y ahí nadie lo reajusta.
 *
 * La base de una tanda es, por defecto, la última etapa SIN regla —la última
 * construida a mano—, y desde la hoja se puede elegir otra. Elegir la base
 * elige DE QUÉ SE COPIA, nunca dónde cae.
 *
 * Spec: `mobile/docs/specs/stage-planner.md` §14.
 */

import { useEffect, useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import Reanimated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Text, TextInput } from '../components/ui/Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { ownerClient } from '../utils/programOwnership';
import { isTrainerProgram } from '../utils/stageLocks';
import { spacing, textStyles, lh, LINE } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import DragSheet from '../components/DragSheet';
import StepField from '../components/ui/StepField';
import { ChevronDown, LockIcon, CheckIcon } from '../components/ui/EditorIcons';
import { collapseOut, FOLD_MS } from '../components/ui/collapseOut';
import ScreenHeader from '../components/ui/ScreenHeader';
import SegmentedControl from '../components/ui/SegmentedControl';
import {
  LADDER_IDS, RX_FIELDS, SCOPES, buildRungs, newRung, describeRx, isNoopRx, fieldLabelKey,
} from '../utils/stageRx';
import { athleteProgress, stageStatus, stageDaysPerWeek, stageWeekLabel, programTotals } from '../utils/stageProgress';
import { sessionStats } from '../utils/sessionStats';

const CHIP = 21;   // marcador de la línea de tiempo
// Alto de la cabecera de una tarjeta: el mismo 52 que la sección de Info de la
// ficha de cliente. Es lo que hace que el marcador caiga centrado sin medir
// nada — plegada, la tarjeta ES la cabecera.
const HEAD_H = 52;

/**
 * El volumen de una etapa: lo mismo que la tarjeta de sesión del editor dice de
 * una sesión, sumado a las de la etapa.
 *
 * Es la misma información en TODAS las tarjetas, y por eso sustituye a la regla
 * ("−3 reps en básicos") que solo tenían algunas: de un vistazo se compara el
 * trabajo de una etapa con el de la de al lado, que es lo que se va a mirar.
 * La procedencia no se pierde — baja al cuerpo desplegado.
 */
function stageVolume(stage, sessionTemplates, allExercises) {
  return (stage?.days ?? []).reduce((acc, { sessionTemplateId }) => {
    const st = sessionStats(sessionTemplates[sessionTemplateId], allExercises);
    return { sessions: acc.sessions + 1, exercises: acc.exercises + st.exercises, sets: acc.sets + st.sets };
  }, { sessions: 0, exercises: 0, sets: 0 });
}

/** Índice de la etapa base por defecto: la última sin regla (la última a mano). */
function baseStageIdx(stages) {
  for (let i = stages.length - 1; i >= 0; i--) if (!stages[i].rx) return i;
  return stages.length - 1;
}

/**
 * Marcador de la línea: hecha, en curso o por venir.
 *
 * Plegada, la fila centra el marcador contra la tarjeta entera. Desplegada, la
 * tarjeta crece hacia abajo y el marcador tiene que quedarse pegado a la
 * CABECERA, así que la fila pasa a alinear arriba y el marcador baja la mitad
 * de lo que mide esa cabecera.
 */
function Marker({ state, n, open }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const box    = [styles.chip, open && styles.chipOpen];
  if (state === 'done') {
    return (
      <View style={[...box, styles.chipDone]}>
        <CheckIcon size={11} color={th.colors.mutedLight} />
      </View>
    );
  }
  return (
    <View style={[...box, state === 'now' && styles.chipNow]}>
      <Text style={[styles.chipText, state === 'now' && styles.chipTextNow]}>{n}</Text>
    </View>
  );
}

// ─── Tarjeta de etapa ─────────────────────────────────────────────────────────

function StageCard({
  stage, n, state, nowLabel, volume, canDelete, canLock, open, onToggle,
  onRename, onWeeks, onDaysPerWeek, onLock, onDuplicate, onDelete,
}) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState(stage.name ?? '');

  // Procedencia, en pasado: `stage.rx` se congela al crear la etapa, y editar
  // sus ejercicios a mano NO lo actualiza (es el precio de materializar la
  // regla, spec §1). "Creada con +1 serie" sigue siendo verdad haga lo que haga
  // la etapa después; "+1 serie" a secas empieza a mentir en cuanto se toca.
  const rxParts = describeRx(stage.rx, t);

  // La derecha lleva duración Y estado en un solo renglón: "hecha" sobra —lo
  // dicen el ✓ y la tarjeta atenuada— y de la etapa en curso interesa cuánto
  // lleva, no una etiqueta.
  const duration = stage.durationWeeks == null
    ? t('editor.cyclesOpen')
    : state === 'now'
      ? nowLabel
      : t('editor.cyclesShort', { count: stage.durationWeeks });

  return (
    <Reanimated.View
      layout={LinearTransition.duration(FOLD_MS)}
      style={[styles.tlRow, open && styles.tlRowOpen]}
    >
      <Marker state={state} n={n} open={open} />

      <Reanimated.View
        layout={LinearTransition.duration(FOLD_MS)}
        style={[styles.card, state === 'done' && styles.cardDone]}
      >
        <TouchableOpacity
          style={styles.cardHead}
          onPress={onToggle}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <View style={styles.cardHeadLeft}>
            <Text style={styles.cardName} numberOfLines={1}>{stage.name}</Text>
            {/* Mismo renglón en TODAS las tarjetas, y el mismo que el editor
                pone bajo el nombre de una sesión: así se comparan de un vistazo
                en vez de leerse una a una. */}
            <Text style={styles.cardMeta} numberOfLines={1}>
              {t('planner.stageVolume', volume)}
            </Text>
          </View>
          {/* Candado plegado: estado, no control. Aro `muted` abierta, sólido
              `red-50` bloqueada — el mismo lenguaje que el `StageSelector`. */}
          {!!stage.locked && <LockIcon size={13} color={th.tint.red50} solid />}
          {!open && (
            <Text style={[styles.cardDur, state === 'now' && styles.cardDurNow]}>{duration}</Text>
          )}
          <View style={open ? styles.chevOpen : null}>
            <ChevronDown size={12} color={open ? th.colors.accent : th.colors.muted} />
          </View>
        </TouchableOpacity>

        {open && (
          <Reanimated.View entering={FadeIn.duration(180)} exiting={collapseOut} style={styles.cardBody}>
            <View style={styles.cardRule} />

            {/* La regla vive aquí desde que el renglón de la cabecera es el
                volumen. En pasado a propósito: es de dónde SALIÓ la etapa, no lo
                que la etapa es ahora. */}
            {rxParts.length > 0 && (
              <Text style={styles.provenance}>{t('planner.createdWith', { parts: rxParts.join(' · ') })}</Text>
            )}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('editor.stageNameLabel')}</Text>
              <TextInput
                style={styles.fieldInput}
                placeholderTextColor={th.colors.muted}
                value={name}
                onChangeText={setName}
                onBlur={() => {
                  const trimmed = name.trim();
                  if (trimmed && trimmed !== stage.name) onRename(trimmed);
                  else setName(stage.name ?? '');
                }}
                placeholder={t('planner.stagePlaceholder')}
                returnKeyType="done"
              />
            </View>

            {stage.durationWeeks == null ? (
              <TouchableOpacity style={styles.noLimitBtn} onPress={() => onWeeks(4)} activeOpacity={0.7}>
                <Text style={styles.noLimitText}>{t('editor.cyclesOpen')}</Text>
              </TouchableOpacity>
            ) : (
              <StepField
                horizontal flat
                label={t('editor.stageWeeksUnit')}
                value={stage.durationWeeks}
                onChange={onWeeks}
                min={1}
                max={52}
              />
            )}

            {/* Entrenos por semana: sin tocar, tantos como sesiones, y no se
                guarda (`stageDaysPerWeek`). */}
            <StepField
              horizontal flat
              label={t('editor.stageDaysUnit')}
              value={stageDaysPerWeek(stage)}
              onChange={onDaysPerWeek}
              min={1}
              max={7}
            />

            <View style={styles.actions}>
              <TouchableOpacity style={styles.action} onPress={onDuplicate} activeOpacity={0.8}>
                <Text style={styles.actionText}>{t('editor.stageDuplicateBtn')}</Text>
              </TouchableOpacity>
              {/* Solo por delante de donde está el cliente: bloquear la etapa que
                  entrena, o una de un programa que le llega de su entrenador, no
                  hace nada — ver `canLockStage` en ProgramEditorScreen. */}
              {canLock && (
                <TouchableOpacity style={styles.action} onPress={onLock} activeOpacity={0.8}>
                  <LockIcon size={13} color={stage.locked ? th.tint.red50 : th.colors.mutedLight} solid={!!stage.locked} />
                  <Text style={styles.actionText}>{t(stage.locked ? 'planner.unlock' : 'planner.lock')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {canDelete && (
              <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
                <Text style={styles.deleteText}>{t('editor.stageDeleteBtn')}</Text>
              </TouchableOpacity>
            )}
          </Reanimated.View>
        )}
      </Reanimated.View>
    </Reanimated.View>
  );
}

/** Desplegable de una sola elección: fila con lo elegido, opciones debajo. */
function Dropdown({ value, options, onChange }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);

  return (
    <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.dd}>
      <TouchableOpacity
        style={styles.ddHead}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.ddValue} numberOfLines={1}>{current?.label ?? ''}</Text>
        <View style={open ? styles.chevOpen : null}>
          <ChevronDown size={12} color={open ? th.colors.accent : th.colors.muted} />
        </View>
      </TouchableOpacity>

      {open && (
        <Reanimated.View entering={FadeIn.duration(180)} exiting={collapseOut} style={styles.ddList}>
          {options.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={styles.ddRow}
              onPress={() => { onChange(o.id); setOpen(false); }}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.ddRowText, o.id === value && styles.ddRowTextOn]}
                numberOfLines={1}
              >
                {o.label}
              </Text>
              {o.id === value && <CheckIcon size={13} color={th.colors.accent} />}
            </TouchableOpacity>
          ))}
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

// ─── Tarjeta de etapa por añadir (dentro de la hoja) ──────────────────────────

function RungCard({ rung, n, name, open, onToggle, onPatch, onRemove }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const parts  = describeRx(rung.rx, t);

  return (
    <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.rung}>
      <TouchableOpacity
        style={styles.rungHead}
        onPress={onToggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        {/* La numeración continúa la del plan: es lo que dice, sin escribirlo,
            que estas etapas se suman DETRÁS de las que ya hay. */}
        <Text style={styles.rungNum}>{n}</Text>
        <View style={styles.cardHeadLeft}>
          <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {parts.length ? parts.join(' · ') : t('planner.noChanges')}
          </Text>
        </View>
        <View style={open ? styles.chevOpen : null}>
          <ChevronDown size={12} color={open ? th.colors.accent : th.colors.muted} />
        </View>
      </TouchableOpacity>

      {open && (
        <Reanimated.View entering={FadeIn.duration(180)} exiting={collapseOut} style={styles.rungBody}>
          {RX_FIELDS.map((f) => (
            <StepField
              key={f.key}
              horizontal flat
              label={t(fieldLabelKey(f, rung.rx.scope))}
              value={rung.rx[f.key] ?? 0}
              onChange={(v) => onPatch({ rx: { [f.key]: v } })}
              min={f.min}
              max={f.max}
              step={f.step}
            />
          ))}

          <View style={styles.scopeBlock}>
            <Text style={styles.fieldLabel}>{t('planner.fields.scope')}</Text>
            <SegmentedControl
              options={SCOPES.map((id) => ({ id, label: t(`planner.scopes.${id}`) }))}
              value={rung.rx.scope ?? 'all'}
              onChange={(id) => onPatch({ rx: { scope: id } })}
            />
          </View>

          {/* No es un control: "sin progresión" solo se entiende como lo que ES
              una descarga, no como un interruptor de una etapa cualquiera. */}
          {rung.kind === 'deload' && <Text style={styles.fixedLine}>{t('planner.deloadFixedLine')}</Text>}

          <View style={styles.rungRule} />
          <TouchableOpacity onPress={onRemove} activeOpacity={0.8}>
            <Text style={styles.deleteText}>{t('planner.removeRung')}</Text>
          </TouchableOpacity>
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function StagePlannerScreen({ navigation, route }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const programs        = useStore((s) => s.programs);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const clients         = useStore((s) => s.clients);
  const clientSync      = useStore((s) => s.clientSync);
  const profile         = useStore((s) => s.profile);
  const ui              = useStore((s) => s.ui);
  const updateStage     = useStore((s) => s.updateStage);
  const removeStage     = useStore((s) => s.removeStageFromProgram);
  const addStage        = useStore((s) => s.addStageToProgram);
  const addStageLadder  = useStore((s) => s.addStageLadder);
  const markProgramDirtyForClients = useStore((s) => s.markProgramDirtyForClients);
  const showToast       = useStore((s) => s.showToast);

  const [openStageId, setOpenStageId] = useState(null);
  const [addOpen,     setAddOpen]     = useState(false);
  const [sourceIdx,   setSourceIdx]   = useState(null);
  // Sin preset seleccionado al abrir, y la lista vacía: "empezar de cero" es la
  // AUSENCIA de preset, no un cuarto preset. Como pastilla no cabía —cuatro
  // segmentos en una línea parten "Volumen total"— y como estado inicial no
  // ocupa nada.
  const [ladderId,    setLadderId]    = useState(null);
  const [rungs,       setRungs]       = useState([]);
  const [openRung,    setOpenRung]    = useState(null);

  // Por ruta cuando se entra desde el cliente (ficha de Clientes): ahí nadie
  // abre ni cierra el editor, y dejar `_editingProgramId` puesto al volver haría
  // que el siguiente "Editar programa" abriera el del cliente.
  const programId = route?.params?.programId ?? ui._editingProgramId ?? profile.activeProgramId;
  const program   = programs[programId];
  const stages    = program?.stages ?? [];

  // Desde la ficha del cliente nadie pasa por `useEditorExit`: sin esto, las
  // etapas añadidas aquí no se ofrecían para subir (qa-sep-conexion.md §5).
  // La acción compara firmas, así que salir sin cambios no marca nada.
  useEffect(() => () => markProgramDirtyForClients(programId), [programId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!program || stages.length === 0) return null;

  // Donde va el ATLETA: en el móvil del entrenador, su blob — no la copia del
  // programa (weeks-model.md §3.7).
  const owner       = ownerClient(clients, program);
  const status      = stageStatus(program, athleteProgress(program, owner));
  const activeIdx   = status.stageIdx;
  const defaultBase = baseStageIdx(stages);
  const baseIdx     = sourceIdx ?? defaultBase;
  const allExercises = { ...exerciseLibrary, ...customExercises };

  // Mismo criterio que la hoja de etapa del editor: bloquear solo tiene efecto
  // por delante de donde está el cliente, y nunca en un programa que llega del
  // entrenador (su copia es de solo lectura).
  const fromTrainer = isTrainerProgram(program, clientSync);
  const canLock     = (idx) => !fromTrainer && !!owner && idx > 0 && idx > activeIdx;

  // Una etapa sin límite hace el total indeterminado: se suman las que sí lo
  // tienen y se marca con "+".
  const totals = programTotals(program);

  const workCountBefore = (i) => rungs.slice(0, i).filter((r) => r.kind === 'work').length;

  // El nombre se cuenta por orden DENTRO de su tipo, no por posición en la
  // lista: con una descarga en medio, la siguiente etapa de trabajo es la 2ª,
  // no la 3ª.
  function rungName(rung, i) {
    if (rung.kind === 'deload') return t('planner.rungs.deload');
    return t(`planner.rungNames.${ladderId ?? 'blank'}`, { n: workCountBefore(i) + 1 });
  }

  function openAddSheet() {
    setLadderId(null);
    setRungs([]);
    setOpenRung(null);
    setSourceIdx(null);
    setAddOpen(true);
  }

  function pickLadder(id) {
    setLadderId(id);
    setRungs(buildRungs(id));
    setOpenRung(null);
  }

  function addRung(kind) {
    setRungs((rs) => [...rs, newRung(kind)]);
    setOpenRung(null);
  }

  function patchRung(idx, patch) {
    setRungs((rs) => rs.map((r, i) => (
      i === idx ? { ...r, ...patch, rx: { ...r.rx, ...(patch.rx ?? {}) } } : r
    )));
  }

  function removeRung(idx) {
    setRungs((rs) => rs.filter((_, i) => i !== idx));
    setOpenRung(null);
  }

  function handleApply() {
    const payload = rungs.map((r, i) => ({
      name:          rungName(r, i),
      durationWeeks: r.durationWeeks,
      // `{}` es truthy: sin esto, una etapa de trabajo a la que no se le tocó
      // nada se guardaría CON regla, y `baseStageIdx` —que busca la última
      // etapa sin `rx`— no volvería a elegirla como base nunca.
      rx:            isNoopRx(r.rx) ? null : r.rx,
    }));
    const firstIdx = addStageLadder(programId, { sourceStageIdx: baseIdx, rungs: payload });
    setAddOpen(false);
    if (firstIdx != null) showToast(t('planner.toastAdded', { count: payload.length }), 2400, 'success');
  }

  function handleDuplicate(idx) {
    const src = stages[idx];
    addStage(programId, {
      sourceStageIdx: idx,
      // Al final de la lista, nunca detrás de la fuente: insertar en medio
      // desplazaría las etapas por debajo del índice que el cliente guarda en su
      // blob de progreso, y ahí nadie lo reajusta.
      name:           `${src.name} ${t('editor.copySuffix')}`,
      // `?? 4` porque una etapa abierta no se copia como abierta — misma regla
      // que `duplicateStageInProgram`.
      durationWeeks:  src.durationWeeks ?? 4,
    });
    setOpenStageId(null);
    showToast(t('editor.toastStageDuplicated'), 2200, 'success');
  }

  function handleDelete(idx) {
    Alert.alert(
      t('planner.deleteTitle'),
      t('planner.deleteBody', { name: stages[idx].name ?? '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: () => { setOpenStageId(null); removeStage(programId, idx); },
        },
      ],
    );
  }

  const applyAction = rungs.length
    ? { label: t('planner.applyCount', { count: rungs.length }), onPress: handleApply }
    : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        eyebrow={t('planner.eyebrow')}
        title={program.name ?? ''}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTag}>{t('planner.summaryTag')}</Text>
          <Text style={styles.summaryMain}>
            {totals.open
              ? t('planner.summaryOpen', { weeks: totals.weeks, stages: stages.length })
              : t('planner.summary',     { weeks: totals.weeks, stages: stages.length })}
          </Text>
          <Text style={styles.summaryHint}>{t('planner.summaryPerCycle', { count: status.daysPerWeek })}</Text>
        </View>

        <Text style={styles.secTitle}>{t('planner.sectionStages')}</Text>

        <View style={styles.timeline}>
          {/* La línea va por detrás de los marcadores, que se pintan en `bg` y
              la tapan. Empieza y acaba dentro para no salir por los extremos. */}
          <View style={styles.spine} pointerEvents="none" />

          {stages.map((stage, idx) => (
            <StageCard
              // El id como key: por índice, renombrar una y borrar otra reciclaba
              // el TextInput con el texto de la vecina.
              key={stage.id ?? idx}
              stage={stage}
              n={idx + 1}
              state={idx < activeIdx ? 'done' : idx === activeIdx ? 'now' : 'next'}
              nowLabel={stageWeekLabel(status, t)}
              volume={stageVolume(stage, sessionTemplates, allExercises)}
              canDelete={stages.length > 1}
              canLock={canLock(idx)}
              open={openStageId === (stage.id ?? idx)}
              onToggle={() => setOpenStageId((cur) => (cur === (stage.id ?? idx) ? null : (stage.id ?? idx)))}
              onRename={(name) => updateStage(programId, idx, { name })}
              onWeeks={(v) => updateStage(programId, idx, { durationWeeks: v })}
              onDaysPerWeek={(v) => updateStage(programId, idx, { daysPerWeek: v })}
              onLock={() => updateStage(programId, idx, { locked: !stage.locked })}
              onDuplicate={() => handleDuplicate(idx)}
              onDelete={() => handleDelete(idx)}
            />
          ))}

          {/* El hueco del final: mismo sitio en la línea que las etapas, con el
              número que le tocaría. Es la entrada a la hoja Y el mensaje de que
              lo nuevo va detrás. Un botón de acento aquí leía como "confirmar
              esta lista". */}
          <View style={styles.tlRow}>
            <View style={[styles.chip, styles.chipNext]}>
              <Text style={styles.chipTextNext}>{stages.length + 1}</Text>
            </View>
            <TouchableOpacity style={styles.slot} onPress={openAddSheet} activeOpacity={0.75}>
              <Text style={styles.slotText}>{t('planner.addSlot')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <DragSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('planner.addStagesTitle')}
        action={applyAction}
        tall
      >
        {/* Tres pasos numerados, como la hoja de progresión del editor de
            ejercicio: de qué se parte, con qué se empieza y qué sale. */}
        <View style={styles.sheetBody}>

          <View>
            <Text style={styles.stepTitle}>
              <Text style={styles.stepNum}>1 · </Text>{t('planner.fromStage')}
            </Text>
            <Dropdown
              value={baseIdx}
              options={stages.map((s, idx) => ({ id: idx, label: s.name ?? '' }))}
              onChange={setSourceIdx}
            />
            {/* Elegir la base elige DE QUÉ SE COPIA, no dónde cae. */}
            <Text style={styles.hint}>{t('planner.fromStageHint')}</Text>
          </View>

          <View>
            <Text style={styles.stepTitle}>
              <Text style={styles.stepNum}>2 · </Text>{t('planner.startWith')}
            </Text>
            <SegmentedControl
              options={LADDER_IDS.map((id) => ({ id, label: t(`planner.ladders.${id}`) }))}
              value={ladderId}
              onChange={pickLadder}
            />
            <Text style={styles.hint}>
              {ladderId ? t(`planner.ladderDesc.${ladderId}`) : t('planner.startWithHint')}
            </Text>
          </View>

          <View>
            <Text style={styles.stepTitle}>
              <Text style={styles.stepNum}>3 · </Text>{t('planner.stagesToAdd')}
            </Text>
            <View style={styles.rungList}>
              {rungs.map((rung, i) => (
                <RungCard
                  key={i}
                  rung={rung}
                  n={stages.length + i + 1}
                  name={rungName(rung, i)}
                  open={openRung === i}
                  onToggle={() => setOpenRung((cur) => (cur === i ? null : i))}
                  onPatch={(patch) => patchRung(i, patch)}
                  onRemove={() => removeRung(i)}
                />
              ))}
              <View style={styles.addRow}>
                <TouchableOpacity style={styles.addBtn} onPress={() => addRung('work')} activeOpacity={0.8}>
                  <Text style={styles.addBtnText}>{t('planner.addWork')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={() => addRung('deload')} activeOpacity={0.8}>
                  <Text style={styles.addBtnText}>{t('planner.addDeload')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </DragSheet>

    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: th.colors.bg },

  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xs2 },

  summaryCard: {
    backgroundColor: th.tint.accent10,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    gap:             spacing.xs,
  },
  summaryTag:  { ...textStyles.caps, color: th.colors.accent },
  summaryMain: { ...textStyles.bodyStrong, color: th.colors.text },
  summaryHint: { ...textStyles.body, color: th.colors.mutedLight },

  secTitle: { ...textStyles.caps, color: th.colors.mutedLight, paddingTop: spacing.md },

  // ── Línea de tiempo ──
  timeline: { position: 'relative', gap: spacing.sm, paddingTop: spacing.xs2 },
  spine: {
    position:        'absolute',
    left:            (CHIP - 1) / 2,
    top:             spacing.xxl,
    bottom:          spacing.xl,
    width:           1,
    backgroundColor: th.colors.border,
  },
  // Plegada, el marcador se centra contra la tarjeta entera; desplegada, contra
  // su cabecera.
  tlRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tlRowOpen: { alignItems: 'flex-start' },
  chip: {
    width:           CHIP,
    height:          CHIP,
    borderRadius:    CHIP / 2,
    alignItems:      'center',
    justifyContent:  'center',
    // Opaco a propósito: es lo que corta la línea por detrás.
    backgroundColor: th.colors.bg,
    borderWidth:     1,
    borderColor:     th.colors.muted,
  },
  chipOpen:     { marginTop: (HEAD_H - CHIP) / 2 },
  chipNow:      { backgroundColor: th.colors.accent, borderColor: th.colors.accent },
  chipDone:     { backgroundColor: th.colors.border, borderColor: th.colors.border },
  chipNext:     { borderStyle: 'dashed' },
  chipText:     { ...textStyles.labelStrong, color: th.colors.mutedLight },
  chipTextNow:  { color: th.colors.onAccent },
  chipTextNext: { ...textStyles.labelStrong, color: th.colors.muted },

  // ── Tarjeta de etapa ──
  // Radio, paddings y voces son los de la tarjeta de sesión del editor
  // (`sesCard`): una tarjeta de lista es una tarjeta de lista, y estas dos se
  // ven a un toque de distancia. Nombre `bodyStrong` sobre meta `label`, sin
  // aire entre los dos, contenido a 15 del borde.
  card: {
    flex:            1,
    minWidth:        0,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  cardDone: { opacity: 0.5 },
  cardHead: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    minHeight:         HEAD_H,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
  },
  cardHeadLeft: { flex: 1, minWidth: 0 },
  cardName:     { ...textStyles.bodyStrong, color: th.colors.text },
  cardMeta:     { ...textStyles.label, color: th.colors.mutedLight },
  cardDur:      { ...textStyles.label, color: th.colors.mutedLight },
  cardDurNow:   { ...textStyles.labelStrong, color: th.colors.accent },
  chevOpen:     { transform: [{ rotate: '180deg' }] },

  cardBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.lg,
    gap:               spacing.md,
    overflow:          'hidden',
  },
  provenance: { ...textStyles.body, color: th.colors.mutedLight },
  // Filete a sangre, como el de `InfoSection`: separa cabecera y cuerpo sin
  // meter una segunda superficie dentro de la tarjeta.
  cardRule: {
    height:           1,
    backgroundColor:  th.colors.border,
    marginHorizontal: -spacing.lg,
  },

  field:      { gap: spacing.sm },
  fieldLabel: { ...textStyles.caps, color: th.colors.mutedLight },
  // Un hueco, no un relieve: el campo va MÁS OSCURO que la tarjeta que lo
  // lleva, como la celda del valor de `StepField`. En `surface2` se levantaba
  // por encima de la tarjeta y parecía un botón.
  fieldInput: {
    ...textStyles.bodyStrong,
    color:             th.colors.text,
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
  },

  noLimitBtn: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      th.radius.sm,
    backgroundColor:   th.colors.surface2,
    alignSelf:         'flex-start',
  },
  noLimitText: { ...textStyles.labelStrong, color: th.colors.mutedLight },

  // Mismo par que cierra la hoja de etapa del editor: secundario `surface2` y
  // destructivo sin fondo, solo texto en `tint/red-50`.
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    paddingVertical: spacing.md,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
  },
  actionText: { ...textStyles.labelStrong, color: th.colors.text },
  deleteBtn:  { paddingVertical: spacing.sm, alignItems: 'center' },
  deleteText: { ...textStyles.labelStrong, color: th.tint.red50 },

  // ── Hueco del final ──
  slot: {
    flex:           1,
    borderWidth:    1,
    borderStyle:    'dashed',
    borderColor:    th.colors.muted,
    borderRadius:   th.radius.md,
    minHeight:      HEAD_H,
    alignItems:     'center',
    justifyContent: 'center',
  },
  slotText: { ...textStyles.labelStrong, color: th.colors.mutedLight },

  // ── Hoja de añadir ──
  sheetBody: { gap: spacing.lg, paddingBottom: spacing.md },
  // Copiados tal cual de la hoja de progresión del editor de ejercicio: `caps`
  // NO lleva `textTransform` de serie —medio centenar de sitios ya mandan la
  // cadena en mayúsculas— así que aquí se pone a mano, igual que allí.
  stepTitle: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  stepNum:   { color: th.colors.accent },
  hint: {
    ...textStyles.body,
    color:      th.colors.mutedLight,
    lineHeight: lh(textStyles.body.fontSize, LINE.row),
  },

  // ── Desplegable ──
  dd: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  ddHead: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    minHeight:         HEAD_H,
    paddingHorizontal: spacing.lg,
  },
  ddValue:  { ...textStyles.bodyStrong, color: th.colors.text, flex: 1, minWidth: 0 },
  ddList:   { paddingBottom: spacing.sm, overflow: 'hidden' },
  ddRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth:    1,
    borderTopColor:    th.colors.border,
  },
  ddRowText:   { ...textStyles.body, color: th.colors.mutedLight, flex: 1, minWidth: 0 },
  ddRowTextOn: { ...textStyles.bodyStrong, color: th.colors.accent },

  rungList: { gap: spacing.sm },

  // Las mismas medidas que la tarjeta del plan: lo que se configura aquí sale
  // ahí, y verlo cambiar de caja entre una pantalla y otra no ayuda a nadie.
  rung: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  rungHead: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    minHeight:         HEAD_H,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rungNum:  { ...textStyles.bodyStrong, color: th.colors.accent, minWidth: 14, textAlign: 'center' },
  rungBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.lg,
    gap:               spacing.sm,
    overflow:          'hidden',
  },
  rungRule: {
    height:           1,
    backgroundColor:  th.colors.border,
    marginHorizontal: -spacing.lg,
    marginTop:        spacing.xs2,
  },
  scopeBlock: { gap: spacing.sm, paddingTop: spacing.xs2 },
  fixedLine:  { ...textStyles.label, color: th.colors.mutedLight },

  addRow: { flexDirection: 'row', gap: spacing.sm },
  addBtn: {
    flex:            1,
    paddingVertical: spacing.md,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
  },
  addBtnText: { ...textStyles.labelStrong, color: th.colors.text },
});
