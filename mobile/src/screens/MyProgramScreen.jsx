/**
 * MyProgramScreen — el tab «Programa»: dónde vas del programa.
 *
 * Spec: `docs/specs/tab-programa.md` §4.
 *
 * Pantalla PLANA, sin control segmentado: el visualizador sigue siendo
 * `ProgramDetailScreen`, una pantalla del stack, y aquí solo se dice en qué
 * punto estás. La tarjeta es la misma que tenía la Home al final de su scroll y
 * la misma que la ficha de cliente — no cambia por dentro, solo de pantalla.
 *
 * Lo que NO se muda: el aviso de «etapa terminada, avanzar» se queda en
 * Sesiones (§4.4). Es lo único con caducidad de la app y lo que decide qué
 * entrenas mañana; aquí solo llega como el punto del tab.
 *
 * Las acciones del programa —editar, ver, archivar— viven en el PIE de la
 * tarjeta, que ya existía para la ficha de cliente y es la variante `Secondary`
 * cerrada del componente Buttons de Figma. No se rehacen aquí: los botones de
 * esta app están decididos (docs/UI-MIGRATION.md §4).
 */
import { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useStore, selectActiveProgram } from '../../store/useStore';
import { stageDays } from '../utils/stageProgress';
import { ownerClient } from '../utils/programOwnership';
import { isStageLocked, isTrainerProgram } from '../utils/stageLocks';
import AppHeader from '../components/AppHeader';
import { Text } from '../components/ui/Text';
import { Section, MenuRow } from '../components/ui/MenuList';
import DragSheet from '../components/DragSheet';
import ProgramCard from '../components/ui/ProgramCard';
import NoProgram from '../components/ui/NoProgram';
import { DocSheet } from '../components/ui/DocPoints';
import { LockIcon, MenuIcon } from '../components/ui/EditorIcons';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { computeAdherence, adherencePct, adherenceColor, requiresAttention, STATUS } from '../utils/adherence';
import { sessionLoads, dailySeries } from '../utils/trainingLoad';

// ── Helpers ────────────────────────────────────────────────────────────────────
// Los dos vienen enteros de `HomeScreen`, que era donde vivía la tarjeta.

/**
 * Contador global de ciclos. `totalWeeksCompleted` sube en el programa cada vez
 * que se cierra un ciclo completo, sea cual sea la etapa; cambiar de etapa no
 * lo reinicia.
 */
function computeWeekNum(program) {
  return (program.totalWeeksCompleted ?? 0) + 1;
}

/**
 * Datos del bloque de etapa de la tarjeta (null cuando no hay nada que
 * enseñar).
 *
 * `totalWeeks` es null cuando la etapa no tiene techo de ciclos
 * (`durationWeeks: null`), y quien lo lea no puede contar hacia él.
 */
function computeStageInfo(program, t) {
  const stages = program.stages ?? [];
  if (stages.length === 0) return null;
  const stageIdx         = program.currentStageIndex ?? 0;
  const stage            = stages[stageIdx];
  if (!stage) return null;
  const totalWeeks       = stage.durationWeeks ?? null;
  // Una sola etapa y sin límite = programa sin periodizar. No hay nada que
  // contar ni total para la tira de ciclos, así que el bloque no se pinta.
  if (stages.length === 1 && totalWeeks == null) return null;
  // Un ciclo es una rotación cerrada, no un número de sesiones — repetir una
  // sesión no puede mover esto. Ver `docs/specs/stage-locks.md` §3.
  const cyclesDone       = program.stageWeeksCompleted ?? 0;
  const weekInStage      = totalWeeks == null ? cyclesDone + 1 : Math.min(cyclesDone + 1, totalWeeks);
  const defaultLabel     = t('home.stageDefault', { n: stageIdx + 1 });
  return {
    stageLabel: defaultLabel,
    stageName:  stage.name ?? defaultLabel,
    weekInStage,
    totalWeeks,
  };
}

function CheckIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Las etapas ────────────────────────────────────────────────────────────────
// Era una hoja (`DragSheet`) que había que abrir desde la tarjeta. Aquí están a
// la vista: en la pantalla donde la pregunta es *dónde voy*, cuántas etapas
// tiene el programa y cuál viene después no pueden estar detrás de un gesto
// (spec tab-programa.md §4.3).
//
// Al perder la hoja, elegir pierde el peso que le daba tener que abrirla, así
// que cambiar de etapa pasa a confirmarse — ver `confirmStage` más abajo.

function StageList({ program, onSelect }) {
  const { t }      = useTranslation();
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);
  const clientSync = useStore((s) => s.clientSync);
  const currentIdx = program.currentStageIndex ?? 0;
  return (
    <Section title={t('myProgram.stagesLabel')}>
      {program.stages.map((stage, idx) => {
        const isActive = idx === currentIdx;
        const locked   = isStageLocked(program, idx, clientSync);
        return (
          <MenuRow
            key={stage.id ?? idx}
            // El número va en la columna de icono de la fila, como la letra de
            // una sesión en la Home: dice el ORDEN, y lo que lo separa del
            // nombre es el `gap` de la fila, no un espacio dentro del texto.
            // Anidarlo en el `label` lo sacaba del papel tipográfico de la fila
            // —el wrapper de `Text` le resuelve la familia por su propio estilo,
            // no por el del padre— y salía en otra Inter.
            icon={<Text style={styles.stageNum}>{idx + 1}</Text>}
            label={stage.name}
            labelColor={isActive ? th.colors.accent : undefined}
            sub={locked
              ? t('home.stageLockedShort')
              : stage.durationWeeks == null
                ? t('home.stageMetaOpen', { sessions: stage.days?.length ?? 0 })
                : t('home.stageMeta',     { cycles: stage.durationWeeks, sessions: stage.days?.length ?? 0 })}
            minHeight={62}
            disabled={locked}
            onPress={() => onSelect(idx)}
            // La etapa en curso lleva el mismo check lima que las frecuencias
            // de Drive. El hueco vacío de las demás mata el chevron de
            // `MenuRow`: aquí se elige, no se navega.
            control={isActive
              ? <CheckIcon size={16} color={th.colors.accent} />
              : locked
                ? <LockIcon size={13} color={th.colors.muted} />
                : <View style={styles.rowControlSpacer} />}
          />
        );
      })}
    </Section>
  );
}

// ── MyProgramScreen ────────────────────────────────────────────────────────────

export default function MyProgramScreen() {
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [cycleDoc,    setCycleDoc]    = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const activeProgram      = useStore(selectActiveProgram);
  const workoutLog         = useStore((s) => s.workoutLog);
  const exerciseLibrary    = useStore((s) => s.exerciseLibrary);
  const customExercises    = useStore((s) => s.customExercises);
  const setPrintingProgram = useStore((s) => s.setPrintingProgram);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  // Suscrito SOLO para repintar al editar una sesión: `getEffectiveTemplate` es
  // estable y por sí sola nunca dispara un render (mismo truco que la Home).
  // eslint-disable-next-line no-unused-vars
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const setCurrentStage    = useStore((s) => s.setCurrentStage);
  const archiveProgram     = useStore((s) => s.archiveProgram);
  const navigate           = useStore((s) => s.navigate);
  const clients            = useStore((s) => s.clients);
  const clientSync         = useStore((s) => s.clientSync);

  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  // ── Los 3 datos de la tarjeta ────────────────────────────────────────────────
  // Las mismas tres cifras que el entrenador ve del cliente, calculadas aquí del
  // lado del atleta: se ve de sí mismo exactamente lo que ven de él.
  const sessionsPerCycle = activeProgram ? Math.max(1, stageDays(activeProgram).length) : 0;

  const adherence = useMemo(() => computeAdherence({
    sessions: workoutLog,
    sessionsPerCycle,
  }), [workoutLog, sessionsPerCycle]);

  const adherence4w = useMemo(
    () => adherencePct({ sessions: workoutLog, sessionsPerCycle }),
    [workoutLog, sessionsPerCycle],
  );

  // Carga media: media de carga externa de los últimos 7 días frente a la de los
  // 28, en %. Con menos de dos semanas de historial no hay contra qué comparar.
  const loadPct = useMemo(() => {
    if (workoutLog.length < 2) return null;
    const days = dailySeries(sessionLoads(workoutLog, allExercises));
    if (days.length < 14) return null;
    const ext = days.map((d) => d.external ?? 0);
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const m28 = avg(ext.slice(-28));
    if (!m28) return null;
    return Math.round((avg(ext.slice(-7)) / m28 - 1) * 100);
  }, [workoutLog, allExercises]);

  /**
   * Cambiar de etapa se confirma. No es solo por el gesto: `setCurrentStage`
   * pone `stageWeeksCompleted: 0` y `cycleCompletedIds: []`, o sea que **borra
   * el ciclo en curso** — las sesiones que llevaras marcadas de esta rotación.
   * Eso pasaba sin decir nada.
   *
   * El aviso va aquí y no dentro de la acción del store: `advanceStage` y el
   * editor de programa la llaman también, con su propio contexto, y un `Alert`
   * dentro se los comería a los tres.
   */
  const confirmStage = (idx) => {
    if (!activeProgram || idx === (activeProgram.currentStageIndex ?? 0)) return;
    const name    = activeProgram.stages[idx]?.name ?? t('home.stageDefault', { n: idx + 1 });
    const pending = activeProgram.cycleCompletedIds?.length ?? 0;
    Alert.alert(
      t('myProgram.stageConfirm.title', { name }),
      pending > 0
        ? t('myProgram.stageConfirm.bodyReset', { count: pending })
        : t('myProgram.stageConfirm.body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('myProgram.stageConfirm.confirm'), onPress: () => setCurrentStage(activeProgram.id, idx) },
      ],
    );
  };

  const stageIdx  = activeProgram?.currentStageIndex ?? 0;

  // Las mismas condiciones que tenía el visualizador, que es de donde vienen
  // estas dos acciones. Aquí el programa es el activo por construcción, así que
  // lo único que queda por comprobar es que no sea el de un cliente (el
  // entrenador lo edita desde la ficha) y, para editar, que no venga de un
  // entrenador: esa edición no sube por el canal y la siguiente actualización
  // la reemplazaría entera.
  const isMine   = !!activeProgram && !ownerClient(clients, activeProgram);
  const canEdit  = isMine && !isTrainerProgram(activeProgram, clientSync);

  // Archivar deja el tab sin programa que enseñar, y eso es correcto: se queda
  // el estado vacío con su oferta de crear uno. No hay a dónde volver — el
  // visualizador hacía `goBack()` porque era una pantalla del stack.
  const handleArchive = (clearHistory) => {
    archiveProgram(activeProgram.id, clearHistory);
    setArchiveOpen(false);
  };
  const stageInfo = activeProgram ? computeStageInfo(activeProgram, t) : null;

  // El nombre del entrenador sale de la primera plantilla que lo traiga, igual
  // que en la Home. Sin memo a propósito: `getEffectiveTemplate` es estable y un
  // memo sobre `activeProgram` no se enteraría de que se editó una sesión.
  const trainerName = activeProgram
    ? stageDays(activeProgram)
        .map(({ sessionTemplateId }) => getEffectiveTemplate(sessionTemplateId)?.trainerName)
        .find(Boolean) ?? null
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeProgram ? (
          <ProgramCard
            variant="self"
            name={activeProgram.name}
            cycleNum={computeWeekNum(activeProgram)}
            trainerName={trainerName}
            stage={stageInfo && {
              label:       stageInfo.stageLabel,
              name:        stageInfo.stageName,
              weekInStage: stageInfo.weekInStage,
              totalWeeks:  stageInfo.totalWeeks,
            }}
            // La barra pinta el PROGRAMA: un tramo por etapa, de ancho
            // proporcional a sus ciclos. La etapa abierta no tiene techo y la
            // tarjeta le da el peso mínimo.
            stages={activeProgram.stages?.map((s) => ({ cycles: s.durationWeeks }))}
            stageIdx={stageIdx}
            adherence={adherence4w}
            adherenceColor={requiresAttention(adherence.status) ? adherenceColor(th, adherence.status) : null}
            pace={adherence.status === STATUS.NO_DATA ? null : adherence.recentPerWeek}
            loadPct={loadPct}
            // La tarjeta no navega, no abre el selector y no lleva pie: dentro
            // del tab de Programa nada de eso hace falta desambiguar, y el pie
            // metía tres celdas con filetes dentro de una tarjeta que ya tiene
            // dos bloques. Las acciones van sueltas debajo, en botones.
            onCycleInfo={() => setCycleDoc(true)}
          />
        ) : (
          <NoProgram />
        )}

        {/* ── Las tres acciones ── botones `Secondary` (relleno `surface2`,
            sin borde, `radius/md`, texto `labelStrong`), que es la variante ya
            cerrada de la app — la misma que el botón «Sustituir» del editor de
            sesión. Van sobre las etapas: son lo que se viene a hacer aquí. */}
        {!!activeProgram && (
          <View style={styles.actions}>
            {canEdit && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigate('programEditor')}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Text style={styles.actionBtnText} numberOfLines={1}>{t('programCard.edit')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionBtn}
              // Se fija SIEMPRE el programa que se va a mirar:
              // `_viewingProgramId` es global, y entrar sin fijarlo dejaba ver
              // el último que se abrió (una plantilla, el de un cliente).
              onPress={() => setPrintingProgram(activeProgram.id)}
              activeOpacity={0.75}
              accessibilityRole="button"
            >
              <Text style={styles.actionBtnText} numberOfLines={1}>{t('programCard.view')}</Text>
            </TouchableOpacity>
            {/* Archivar no merece un tercio del ancho: se hace una vez en la
                vida del programa. Va en un `⋯` del mismo ancho que el del pie
                de `ProgramCard`, y como todo `⋯` abre una lista — nunca
                ejecuta. Los otros dos se reparten lo que deja. */}
            {isMine && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnIcon]}
                onPress={() => setMenuOpen(true)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('home.moreOptions')}
              >
                <MenuIcon horizontal color={th.colors.mutedLight} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Con una sola etapa no hay nada que elegir. */}
        {(activeProgram?.stages?.length ?? 0) > 1 && (
          <View style={styles.stagesBlock}>
            <StageList program={activeProgram} onSelect={confirmStage} />
          </View>
        )}

      </ScrollView>

      <DocSheet visible={cycleDoc} sectionId="cycle" onClose={() => setCycleDoc(false)} />

      {/* Las dos hojas del `⋯`, movidas enteras desde el visualizador: la lista
          de acciones y, dentro, la de archivar con sus dos salidas. */}
      {menuOpen && (
        <DragSheet visible onClose={() => setMenuOpen(false)} title={t('home.moreOptions')}>
          <View style={styles.sheetGroup}>
            <MenuRow
              isFirst
              isLast
              label={t('home.archive')}
              onPress={() => { setMenuOpen(false); setArchiveOpen(true); }}
            />
          </View>
        </DragSheet>
      )}

      {archiveOpen && (
        <DragSheet visible onClose={() => setArchiveOpen(false)} title={t('home.archiveModal.title')}>
          <Text style={styles.sheetIntro}>
            <Text style={styles.sheetIntroName}>{activeProgram.name}</Text>
            {'\n'}{t('home.archiveModal.desc')}
          </Text>
          <View style={styles.sheetGroup}>
            <MenuRow
              isFirst
              label={t('home.archiveModal.keepHistory')}
              sub={t('home.archiveModal.keepHistoryDesc')}
              subLines={0}
              minHeight={62}
              onPress={() => handleArchive(false)}
            />
            <MenuRow
              isLast
              label={t('home.archiveModal.clearHistory')}
              labelColor={th.tint.red50}
              sub={t('home.archiveModal.clearHistoryDesc')}
              subLines={0}
              minHeight={62}
              onPress={() => handleArchive(true)}
            />
          </View>
        </DragSheet>
      )}

    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.xxl * 2,
  },
  // Botones `Secondary`: relleno `surface2` sólido, sin borde, `radius/md` y
  // texto `labelStrong` — el vocabulario que ya usan el pie de `ProgramCard` y
  // el «Sustituir» del editor de sesión.
  actions: {
    flexDirection: 'row',
    gap:           spacing.sm2,
    marginTop:     spacing.lg,
  },
  actionBtn: {
    flex:            1,
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  // El mismo ancho que el `⋯` del pie de `ProgramCard`.
  actionBtnIcon: { flex: 0, width: 52 },
  actionBtnText: { ...textStyles.labelStrong, color: th.colors.text, textAlign: 'center' },

  // `Section` ya trae su propio `marginBottom`; el aire de arriba lo pone el
  // bloque, que es lo que lo separa de los botones.
  stagesBlock: { marginTop: spacing.xl },
  // Todos en acento, no solo el de la etapa en curso: en `mutedLight` se
  // fundían con el meta de la propia fila, que va en ese gris y una línea más
  // abajo. Quien marca dónde estás es el check, no el número.
  //
  // La columna de icono de `MenuRow` mide 20 y CENTRA su contenido, con un
  // `gap` de 15 pensado para un icono de 18 que la llena. Una cifra ocupa ocho
  // píxeles, así que sobra aire a los dos lados y el nombre se iba lejos.
  //
  // Se corrige SOLO por la derecha, con un margen negativo. Alinear la cifra a
  // la derecha de su caja cerraba ese hueco pero abría otro peor: dejaba la
  // sangría izquierda de la fila vacía, y esa sangría es la que alinea estas
  // filas con las de Drive, Entrenador y el menú. La cifra se queda donde
  // estaría un icono y lo único que se recorta es la distancia al nombre.
  //
  // El `gap` de la fila no se toca: es de `MenuRow` y lo comparte media app.
  // Las mismas hojas que tenía el visualizador.
  sheetGroup: { gap: spacing.xs, paddingBottom: spacing.sm },
  sheetIntro: {
    ...textStyles.body,
    color:         th.colors.mutedLight,
    lineHeight:    18,
    paddingBottom: spacing.md,
  },
  sheetIntroName: { color: th.colors.text },

  stageNum: {
    ...textStyles.bodyStrong,
    color:       th.colors.accent,
    marginRight: -spacing.md,
  },
  rowControlSpacer: { width: 16 },
});
