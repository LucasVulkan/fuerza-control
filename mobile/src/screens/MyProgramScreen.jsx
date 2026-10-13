/**
 * MyProgramScreen — el tab «Programa»: dónde vas del programa.
 *
 * Spec: `docs/specs/U07-tab-programa.md` §4.
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
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useStore, selectActiveProgram } from '../../store/useStore';
import { stageDays, athleteProgress, stageStatus, weeklySessions } from '../utils/stageProgress';
import { ownerClient } from '../utils/programOwnership';
import { pickImportFile } from '../utils/pickImportFile';
import { isTrainerProgram } from '../utils/stageLocks';
import AppHeader from '../components/AppHeader';
import { startNewProgram } from '../utils/startNewProgram';
import { Text } from '../components/ui/Text';
import { Section } from '../components/ui/MenuList';
import SheetRow from '../components/ui/SheetRow';
import { ROW_ICON } from '../components/ui/rowIcons';
import DragSheet from '../components/DragSheet';
import HomeProgramCard from '../components/HomeProgramCard';
import { ProgramActions } from '../components/ui/ProgramCard';
import ProgramStages from '../components/ProgramStages';
import { Rise, Unfold } from '../components/ui/Rise';
import { useEnterClock, EnterClock } from '../hooks/useEnterClock';
import ProgramCardDetail from '../components/ProgramCardDetail';
import NoProgram from '../components/ui/NoProgram';
import { DocSheet } from '../components/ui/DocPoints';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { useFreeGates } from '../useFreeGates';
import { computeAdherence, adherencePct, STATUS } from '../utils/adherence';
import { sessionLoads, dailySeries } from '../utils/trainingLoad';
import { countsForProgram } from '../utils/freeSessions';

import { showDialog } from '../components/ui/dialog';
// ── MyProgramScreen ────────────────────────────────────────────────────────────

export default function MyProgramScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [weekDoc,    setWeekDoc]    = useState(false);
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
  const cloneProgramFromTemplate = useStore((s) => s.cloneProgramFromTemplate);
  const showToast          = useStore((s) => s.showToast);
  const importData         = useStore((s) => s.importData);
  const deleteProgram      = useStore((s) => s.deleteProgram);
  const shareSpecificProgram  = useStore((s) => s.shareSpecificProgram);
  const exportSpecificProgram = useStore((s) => s.exportSpecificProgram);
  // La misma regla que enseña la pestaña Plantillas (`showProTabs`): sin ella,
  // la plantilla iría a parar a donde no se ve.
  const hasTemplates       = useStore((s) => !(s.profile?.proTabsHidden ?? false));
  const { gates, gate }   = useFreeGates();

  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  // El despliegue y la entrada por partes (U14 §4.3): un reloj para toda la pantalla.
  const clock = useEnterClock();

  // ── Los 3 datos de la tarjeta ────────────────────────────────────────────────
  // Las mismas tres cifras que el entrenador ve del cliente, calculadas aquí del
  // lado del atleta: se ve de sí mismo exactamente lo que ven de él.
  // Los entrenos por semana de la etapa en la que está: son el objetivo de la
  // adherencia (P08-weeks-model.md §4.3).
  const perWeek = activeProgram
    ? weeklySessions(activeProgram.stages?.[athleteProgress(activeProgram).currentStageIndex])
    : 0;

  // Las sesiones libres solo cuentan si sustituyen a una del programa
  // (T06-free-sessions.md §8); la carga, en cambio, las cuenta todas.
  const programLog = useMemo(() => workoutLog.filter(countsForProgram), [workoutLog]);

  const adherence = useMemo(() => computeAdherence({
    sessions: programLog,
    perWeek,
  }), [programLog, perWeek]);

  const adherence4w = useMemo(
    () => adherencePct({ sessions: programLog, perWeek }),
    [programLog, perWeek],
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

  // Dónde va de la etapa. Sin memo: depende del día, y es aritmética de nada.
  const status = activeProgram ? stageStatus(activeProgram, athleteProgress(activeProgram)) : null;

  const pace = adherence.status === STATUS.NO_DATA ? null : adherence.recentPerWeek;

  // Quién hizo el programa: el entrenador de la primera plantilla que lo traiga,
  // igual que en la Home. Sin memo a propósito: `getEffectiveTemplate` es
  // estable y un memo sobre `activeProgram` no se enteraría de que se editó una sesión.
  const trainerName = activeProgram
    ? stageDays(activeProgram)
        .map(({ sessionTemplateId }) => getEffectiveTemplate(sessionTemplateId)?.trainerName)
        .find(Boolean) ?? null
    : null;

  // Cambiar de etapa se confirma en la hoja de `ProgramStages`; aquí llega ya
  // confirmado. El aviso no va dentro de la acción del store: `advanceStage` y
  // el editor de programa la llaman también, con su propio contexto.
  const selectStage = (idx) => {
    if (activeProgram && idx !== status?.stageIdx) setCurrentStage(activeProgram.id, idx);
  };

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
  const isTrainers = isMine && isTrainerProgram(activeProgram, clientSync);

  // Solo entrenos, nada más: con `{ log: true }` `importData` no toca programas
  // ni plantillas. El selector de archivos espera a que se cierre la hoja (dos
  // `Modal` a la vez se pisan), como en la ficha del cliente.
  async function handleImportHistory() {
    const picked = await pickImportFile(t);
    if (!picked) return;
    if (!picked.data.workoutLog?.length) {
      showDialog(t('errors.invalidFile'), t('errors.noHistoryInFile'));
      return;
    }
    importData(picked.data, { log: true, logMode: 'merge' }, { silent: true });
    showToast(t('header.toastImported'), 2200, 'success');
  }

  const confirmDelete = () => showDialog(
    t('clients.deleteProgramTitle'),
    t('clients.deleteProgramConfirm', { name: activeProgram.name }),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('clients.menuDelete'), style: 'destructive', onPress: () => deleteProgram(activeProgram.id, false) },
    ],
  );

  const handleArchive = (clearHistory) => {
    archiveProgram(activeProgram.id, clearHistory);
    setArchiveOpen(false);
  };
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />

      <EnterClock.Provider value={clock}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {activeProgram ? (
            <HomeProgramCard
              program={activeProgram}
              // Ida y vuelta: la misma tarjeta que trajo hasta aquí devuelve a Sesión.
              onOpen={() => navigation.navigate('Home')}
              openHint={t('myProgram.backToSessions')}
              onWeekInfo={() => setWeekDoc(true)}
            >
              <Unfold>
                <ProgramCardDetail
                  program={activeProgram}
                  status={status}
                  trainerName={trainerName}
                  adherence={adherence4w}
                  pace={pace}
                  loadPct={loadPct}
                />
              </Unfold>
            </HomeProgramCard>
          ) : (
            <NoProgram />
          )}

          {/* ── Las tres acciones ── van sobre las etapas: son lo que se viene
              a hacer aquí. Archivar no merece un tercio del ancho (se hace una
              vez en la vida del programa): va en el `⋯`. */}
          {!!activeProgram && (
            <Rise index={0}>
              <ProgramActions
                onEdit={canEdit ? () => navigate('programEditor') : null}
                // Se fija SIEMPRE el programa que se va a mirar:
                // `_viewingProgramId` es global, y entrar sin fijarlo dejaba ver
                // el último que se abrió (una plantilla, el de un cliente).
                onView={() => setPrintingProgram(activeProgram.id)}
                onMore={isMine ? () => setMenuOpen(true) : null}
              />
            </Rise>
          )}

          {/* Con una sola etapa no hay nada que elegir. */}
          {(activeProgram?.stages?.length ?? 0) > 1 && (
            <ProgramStages program={activeProgram} status={status} firstIndex={1} onSelect={selectStage} />
          )}

        </ScrollView>
      </EnterClock.Provider>

      <DocSheet visible={weekDoc} sectionId="week" onClose={() => setWeekDoc(false)} />

      {/* Las dos hojas del `⋯`, movidas enteras desde el visualizador: la lista
          de acciones y, dentro, la de archivar con sus dos salidas. */}
      {menuOpen && (
        <DragSheet visible onClose={() => setMenuOpen(false)} title={t('home.moreOptions')}>
          <Section style={styles.sheetSection}>
            {!isTrainers && <SheetRow icon={ROW_ICON.new} label={t('header.newProgramItem')} onPress={() => startNewProgram(t, clientSync, navigate)} />}
            {!isTrainers && <SheetRow icon={ROW_ICON.share} label={t('clients.menuShare')} onPress={() => shareSpecificProgram(activeProgram.id, true)} />}
            {!isTrainers && <SheetRow icon={ROW_ICON.export} label={t('clients.menuExport')} onPress={() => exportSpecificProgram(activeProgram.id, true)} />}
            <SheetRow icon={ROW_ICON.import} label={t('clients.menuImportHistory')} onPress={() => setTimeout(handleImportHistory, 250)} />
            {!isTrainers && hasTemplates && (
              <SheetRow
                icon={ROW_ICON.preset}
                label={t('clients.menuSaveTemplate')}
                labelColor={gates.newProgramTemplate ? th.colors.mutedLight : undefined}
                badge={gates.newProgramTemplate ? 'PRO' : undefined}
                onPress={gate(gates.newProgramTemplate, () => {
                  if (cloneProgramFromTemplate(activeProgram.id, { kind: 'template', name: activeProgram.name })) {
                    showToast(t('clients.toastSavedTemplate'));
                  }
                })}
              />
            )}
            {!isTrainers && (
              <SheetRow
                icon={ROW_ICON.archived}
                label={t('home.archive')}
                onPress={() => { setMenuOpen(false); setArchiveOpen(true); }}
              />
            )}
            <SheetRow icon={ROW_ICON.trash} label={t('clients.menuDelete')} onPress={confirmDelete} danger />
          </Section>
        </DragSheet>
      )}


      {archiveOpen && (
        <DragSheet visible onClose={() => setArchiveOpen(false)} title={t('home.archiveModal.title')}>
          <Text style={styles.sheetIntro}>
            <Text style={styles.sheetIntroName}>{activeProgram.name}</Text>
            {'\n'}{t('home.archiveModal.desc')}
          </Text>
          <View style={styles.sheetGroup}>
            <SheetRow
              isFirst
              icon={ROW_ICON.archived}
              label={t('home.archiveModal.keepHistory')}
              sub={t('home.archiveModal.keepHistoryDesc')}
              subLines={0}
              minHeight={62}
              onPress={() => handleArchive(false)}
            />
            <SheetRow
              isLast
              danger
              icon={ROW_ICON.trash}
              label={t('home.archiveModal.clearHistory')}
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
  // Arriba, el mismo relleno que Inicio (`spacing.sm`): la tarjeta del
  // programa cae en el mismo píxel en las dos pantallas y no salta (U14 §4.1).
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.sm,
    paddingBottom:     spacing.xxl * 2,
  },

  // Las mismas hojas que tenía el visualizador.
  sheetSection: { marginBottom: spacing.sm },
  sheetGroup: { gap: spacing.xs, paddingBottom: spacing.sm },
  sheetIntro: {
    ...textStyles.body,
    color:         th.colors.mutedLight,
    lineHeight:    18,
    paddingBottom: spacing.md,
  },
  sheetIntroName: { color: th.colors.text },

});
