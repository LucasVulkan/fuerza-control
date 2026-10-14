/**
 * OnboardingScreen.
 *
 * 4 modos:
 *   null              → selector (Auto / Manual / Importar / Plantilla / Entrenador)
 *   'auto'            → tres preguntas → propuestas → tu programa (O01-onboarding-simple.md)
 *   'manual'          → nombre + nº de sesiones
 *   'template_picker' → clonar una plantilla propia
 *
 * El modo 'auto' tiene tres fases (`autoPhase`): las tres preguntas (nivel,
 * qué buscas, días — auto-avanzan al tocar), la lista de plantillas
 * candidatas y el programa elegido con sus ajustes en vivo. Nada se guarda
 * hasta EMPEZAR/EDITAR — por eso "ver otro programa" no deja programas
 * huérfanos.
 *
 * Revisión 2 (docs/specs/O01-onboarding-simple.md): la UI ya no porta el
 * onboarding web (`OptionCard`/`OnboardingStep`/`OnboardingProgress`
 * desaparecieron) — cada pieza sale de una pantalla migrada ya cerrada, con
 * cita de fichero y línea en la spec.
 *
 * Se reutiliza como pantalla de "nuevo programa" desde dentro de la app
 * pasando el parámetro de navegación: { fromApp: true }.
 */

import { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '../components/ui/Text';
import { Path, G, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import { rankArchetypes } from '../data/archetypes';
import ClientCodeModal from '../components/ClientCodeModal';
import AdjustSheet from '../components/onboarding/AdjustSheet';
import ProposalCard from '../components/onboarding/ProposalCard';
import { ProgramPreviewItems } from '../components/onboarding/ProgramPreview';
import usePreviewModel from '../components/onboarding/usePreviewModel';
import useFitdataImport from '../components/onboarding/useFitdataImport';
import {
  SESSION_CHOICES, LEVEL_IDS, IDENTITY_OPTIONS, DEFAULT_ANSWERS,
} from '../components/onboarding/proposalData';
import { ArrowIcon } from '../components/ui/EditorIcons';
import ScreenHeader from '../components/ui/ScreenHeader';
import NumberChips from '../components/ui/NumberChips';
import NameField from '../components/ui/NameField';
import { RowIcon, ROW_CHEVRON } from '../components/ui/MenuList';
import { spacing, textStyles, borders } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { templatesOf } from '../utils/programOwnership';
import { allProgramDays } from '../utils/stageProgress';
import { showDialog } from '../components/ui/dialog';

// ─── Tarjeta de modo ──────────────────────────────────────────────────────────
//
// Misma anatomía que `QuestionCard` (§4 de O01-onboarding-simple.md: tarjeta de
// elección, NO lista agrupada), más el icono gris de `MenuList` y la flecha de
// fila navegable. Los emoji se van con la migración: no hay ni uno en ninguna
// pantalla ya cerrada.

const MODE_ICONS = {
  auto:     <Path d="m12 3.5 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9z" />,
  manual:   <Path d="M12 5v14M5 12h14" />,
  import:   <Path d="M12 5v14M6 13l6 6 6-6" />,
  template: <Path d="M4 7h16M4 12h16M4 17h10" />,
  trainer:  <G><Circle cx="12" cy="8" r="3.2" /><Path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></G>,
};

// Botón primario del onboarding. La flecha es el `ArrowIcon` de la cabecera
// —el asset real— y no un "→" de texto: el glifo salía fino y sin centrar.
function PrimaryBtn({ label, onPress, disabled }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.startBtn, disabled && styles.startBtnOff]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.85}
    >
      <Text style={[styles.startBtnText, disabled && styles.startBtnTextOff]}>{label}</Text>
      <ArrowIcon size={14} color={disabled ? th.colors.mutedLight : th.colors.onAccent} />
    </TouchableOpacity>
  );
}

function ModeCard({ icon, title, desc, badge, onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.modeCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.modeIcon}><RowIcon>{MODE_ICONS[icon]}</RowIcon></View>
      <View style={styles.modeBody}>
        <View style={styles.modeTitleLine}>
          <Text style={styles.modeTitle}>{title}</Text>
          {badge ? (
            <View style={styles.modeBadge}><Text style={styles.modeBadgeText}>{badge}</Text></View>
          ) : null}
        </View>
        <Text style={styles.modeDesc}>{desc}</Text>
      </View>
      <ArrowIcon size={ROW_CHEVRON} color={th.colors.muted} />
    </TouchableOpacity>
  );
}

// ─── Cabecera lima — §4: ProgramDetailScreen `styles.header` + `CycleDots` de
// HomeScreen. La usan las tres preguntas, propuestas y el programa elegido;
// sólo las preguntas pintan los tres puntos. ──────────────────────────────────

function LimeHeader({ eyebrow, title, onBack, dotsDone }) {
  return (
    <ScreenHeader
      onBack={onBack}
      eyebrow={eyebrow}
      title={title}
      // El paso ya no son tres puntos en el hueco de acciones: es la regla que
      // cierra la cabecera, partida en un segmento por pregunta. Por eso la ceja
      // se queda sólo con "NUEVO PROGRAMA" — el "2 de 3" está dibujado.
      progress={dotsDone != null ? [0, 1, 2].map((i) => i < dotsDone) : undefined}
    />
  );
}

// Contenedor de las tres preguntas: cabecera fija + pregunta + hint. Sin
// botón "Siguiente" — las tres auto-avanzan al tocar una opción (§6.1).
function QuestionScreen({ title, dotsDone, onBack, sectionLabel, hint, children }) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();
  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LimeHeader eyebrow={t('onboarding.newProgram', 'NUEVO PROGRAMA')} title={title} onBack={onBack} dotsDone={dotsDone} />
      <ScrollView contentContainerStyle={styles.qBody} showsVerticalScrollIndicator={false}>
        {sectionLabel ? <Text style={styles.sectionLabel}>{sectionLabel}</Text> : null}
        {children}
        {hint ? <Text style={styles.qHint}>{hint}</Text> : null}
      </ScrollView>
    </View>
  );
}

// Tarjeta de opción de nivel/identidad — §4: "tarjetas de navegación"
// (Clientes/History/HomeView), NO lista agrupada (`getCardRadii` es para
// listas densas de datos, no de elección). Selección: `tint.accent10` +
// borde `accent50` + nombre en `accent` (§6.1).
function QuestionCard({ title, subtitle, selected, onPress }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={[styles.qCard, selected && styles.qCardOn]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[styles.qCardTitle, selected && styles.qCardTitleOn]}>{title}</Text>
      {subtitle ? <Text style={styles.qCardSubtitle}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const route      = useRoute();
  const fromApp    = route.params?.fromApp ?? false;

  const { t } = useTranslation();
  const generateAndActivateProgram = useStore((s) => s.generateAndActivateProgram);
  const createEmptyProgram         = useStore((s) => s.createEmptyProgram);
  const cloneProgramFromTemplate   = useStore((s) => s.cloneProgramFromTemplate);
  // Invitación (M01-04): con un código pendiente la hoja del código está
  // abierta, en cuanto se llega a elegir modo. La hoja lo borra al cerrarse.
  const pendingInvite              = useStore((s) => s.pendingInviteCode);
  const importData                 = useStore((s) => s.importData);
  const storeNavigate              = useStore((s) => s.navigate);
  const programs                   = useStore((s) => s.programs);
  const clientSync                 = useStore((s) => s.clientSync);
  const unlinkFromTrainer          = useStore((s) => s.unlinkFromTrainer);

  const templateList = useMemo(() => templatesOf(programs), [programs]);

  const [mode,               setMode]              = useState(null);
  // `openCode`: la salida provisional de «Con un entrenador» del recorrido nuevo
  // (O03-01 §17.5) llega con la hoja del código ya abierta.
  const [showClientCode,     setShowClientCode]     = useState(route.params?.openCode ?? false);
  const [step,               setStep]              = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [templateProgramName, setTemplateProgramName] = useState('');
  const [loading,          setLoading]         = useState(false);
  const [manualSessions,   setManualSessions]  = useState(3);
  const [manualName,       setManualName]      = useState('');

  // El .fitdata abierto desde el explorador lo atiende `ExternalImportModal`,
  // en `RootNavigator`. La copia que había aquí existía porque `AppHeader` no
  // está montado durante el onboarding; con el modal global eso deja de
  // importar, y el cierre del onboarding tras importar un programa lo decide
  // allí `profile.onboardingCompleted` en vez de qué pantalla montó el modal.


  const [answers, setAnswers] = useState(DEFAULT_ANSWERS);

  // Fase del modo auto: preguntas → propuestas → programa elegido.
  const [autoPhase, setAutoPhase] = useState('questions');
  const [showAll,   setShowAll]   = useState(false);   // "ver todas" en propuestas
  const [chosenId,  setChosenId]  = useState(null);    // plantilla elegida
  const [sheetOpen, setSheetOpen] = useState(false);           // hoja de ajustes (§7)

  // Nivel, identidad y días son las tres preguntas de verdad — auto-avanzan.
  const stepIds     = ['level', 'identity', 'days'];
  const totalSteps  = stepIds.length;
  const currentStep = stepIds[Math.min(step, totalSteps - 1)];

  function set_(field, value) {
    setAnswers((a) => ({ ...a, [field]: value }));
  }

  // SIN material a propósito (§9): en este punto no se ha preguntado, y
  // `equipment` ausente le dice a `rankArchetypes` que no lo puntúe. Pasarle
  // `[]` sería decirle que el usuario no tiene nada, que es otra cosa.
  const ranked = useMemo(() => (autoPhase === 'questions' ? [] : rankArchetypes({
    level:       answers.level,
    discipline:  answers.discipline,
    goal:        answers.goal,
    daysPerWeek: answers.daysPerWeek,
  })), [autoPhase, answers.level, answers.discipline, answers.goal, answers.daysPerWeek]);

  const chosenEntry = chosenId ? ranked.find((r) => r.archetype.id === chosenId) : null;

  // El motor en vivo (programa adaptado, recorte de tiempo y ajustes): compartido con el recorrido nuevo.
  const model = usePreviewModel(chosenEntry, answers);
  const { submitAnswers, tuned, timeCuts, dedupedSubs } = model;

  function finish() {
    // If the user was connected to a trainer, disconnect now that they have
    // a new program. keepProgram=true so the newly created program is not
    // overwritten by the pre-link previousActiveProgramId.
    if (clientSync?.slotId) {
      unlinkFromTrainer({ keepProgram: true }).catch(() => {});
    }
    if (fromApp) {
      navigation.goBack();
    } else {
      navigation.replace('Main');
    }
  }

  function handleEditProgram() {
    navigation.replace('Main');
    setTimeout(() => storeNavigate('programEditor'), 150);
  }

  // Elegir una plantilla NO guarda nada: va directo al programa, donde se
  // adapta en vivo. Sólo se crea al confirmar, para que "ver otro programa"
  // no vaya dejando programas a medias en el store.
  function chooseArchetype(entry) {
    setChosenId(entry.archetype.id);
    setSheetOpen(false);
    setAutoPhase('preview');
  }

  function backToProposals() {
    setChosenId(null);
    setAutoPhase('proposals');
  }

  async function persistChosen() {
    // §9: `distribution` ya no se pregunta, pero el snapshot la sigue llevando —
    // se toma de la plantilla elegida.
    const finalAnswers = { ...submitAnswers, distribution: chosenEntry?.archetype.distribution ?? 'full_body' };
    return generateAndActivateProgram(finalAnswers, chosenId);
  }

  // `after` corre con el programa ya guardado y activo.
  async function confirmProgram(after) {
    setLoading(true);
    try {
      await persistChosen();
      after();
    } catch (err) {
      console.error('Error generando programa:', err);
      showDialog(t('common.error', 'Error'), t('onboarding.generateError', 'No se pudo generar el programa. Inténtalo de nuevo.'));
      setLoading(false);
    }
  }

  function handleManualCreate() {
    createEmptyProgram(manualSessions, manualName.trim() || t('onboarding.programNamePlaceholder', 'Mi programa'));
    // Navigate to Main first (activeProgramId is now set, ProgramEditor picks it up as fallback)
    if (fromApp) {
      navigation.goBack();
    } else {
      navigation.replace('Main');
    }
    setTimeout(() => storeNavigate('programEditor'), 150);
  }

  function handleLoadTemplate() {
    const src = programs[selectedTemplateId];
    if (!src) return;
    const name = templateProgramName.trim() || src.name;
    if (!cloneProgramFromTemplate(selectedTemplateId, { name })) return; // el plan gratis lo paró
    finish();
  }

  // «Importar archivo»: el selector y la hoja de qué traer, compartidos con el recorrido nuevo.
  const fitdata = useFitdataImport((parsedData, sections) => {
    importData(parsedData, sections);
    finish();
  });

  function nextStep() {
    if (step >= totalSteps - 1) { setAutoPhase('proposals'); return; }
    setStep((s) => s + 1);
  }
  function prevStep() { setStep((s) => Math.max(0, s - 1)); }

  // Volver atrás no pierde nada — `answers` no se toca.
  function backToQuestions() {
    setShowAll(false);
    setChosenId(null);
    setStep(totalSteps - 1);
    setAutoPhase('questions');
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top }]}>
        <Text style={styles.loadingTitle}>{t('onboarding.generating', 'GENERANDO...')}</Text>
        <ActivityIndicator color={th.colors.accent} size="large" style={{ marginTop: spacing.lg }} />
        <Text style={styles.loadingDesc}>{t('onboarding.buildingPlan', 'Construyendo tu plan...')}</Text>
      </View>
    );
  }

  // ── Tu programa: el elegido, todavía sin guardar ─────────────────────────────
  // Se pinta del `adaptArchetype` en vivo, y la hoja de ajustes (§7) lo
  // repinta con cada toque. La cabecera va FIJA, fuera del `ScrollView` — es
  // lo que responde a la hoja (trampa §12).
  if (mode === 'auto' && autoPhase === 'preview' && tuned) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LimeHeader
          eyebrow={t('onboarding.preview.eyebrow', 'TU PROGRAMA')}
          title={tuned.program.name}
          onBack={backToProposals}
        />

        <ScrollView contentContainerStyle={styles.previewList} showsVerticalScrollIndicator={false}>
          <ProgramPreviewItems model={model} answers={answers} onOpenSheet={() => setSheetOpen(true)} />
        </ScrollView>

        {/* Aquí es donde el programa se guarda por primera vez. */}
        <View style={styles.previewFooter}>
          <View style={styles.previewFooterInner}>
            <Text style={styles.changeLaterText}>
              {t('onboarding.preview.changeLater', 'Puedes cambiar cualquier cosa después, en el editor.')}
            </Text>
            <View style={styles.previewFooterBtns}>
              <TouchableOpacity style={styles.editBtn} onPress={() => confirmProgram(handleEditProgram)} activeOpacity={0.85}>
                <Text style={styles.editBtnText}>{t('onboarding.preview.edit', 'EDITAR')}</Text>
              </TouchableOpacity>
              <PrimaryBtn label={t('onboarding.preview.start')} onPress={() => confirmProgram(finish)} />
            </View>
          </View>
        </View>

        <AdjustSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          answers={answers}
          onChange={set_}
          timeCuts={timeCuts}
          subs={dedupedSubs}
          unresolved={tuned.unresolved}
        />
      </View>
    );
  }

  // ── Propuestas ───────────────────────────────────────────────────────────────
  // Todavía sin saber el material: la tarjeta enseña la ESTRUCTURA (sesiones
  // por semana y semanas), que no depende de lo que el usuario tenga.
  if (mode === 'auto' && autoPhase === 'proposals') {
    const visible = showAll ? ranked : ranked.slice(0, 3);
    const levelLabel = t(`onboarding.levels.${answers.level}.label`, answers.level ?? '');

    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LimeHeader
          eyebrow={t('onboarding.proposals.eyebrow', {
            level: levelLabel.toUpperCase(), count: answers.daysPerWeek,
            defaultValue: `${levelLabel.toUpperCase()} · ${answers.daysPerWeek} DÍAS`,
          })}
          title={t('onboarding.proposals.title', 'Tus programas')}
          onBack={backToQuestions}
        />

        <ScrollView contentContainerStyle={styles.previewList} showsVerticalScrollIndicator={false}>
          {visible.map((entry, i) => (
            <ProposalCard
              key={entry.archetype.id}
              entry={entry}
              recommended={i === 0}
              daysPerWeek={answers.daysPerWeek}
              onPress={() => chooseArchetype(entry)}
            />
          ))}

          {ranked.length > 3 && (
            <TouchableOpacity onPress={() => setShowAll((v) => !v)} activeOpacity={0.75} style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>
                {showAll
                  ? t('onboarding.proposals.seeTop', 'Ver sólo las recomendadas')
                  : t('onboarding.proposals.seeAll', {
                    total: ranked.length,
                    defaultValue: `Ver las ${ranked.length} plantillas`,
                  })}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Selector de modo ─────────────────────────────────────────────────
  if (mode === null) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LimeHeader
          eyebrow={t('onboarding.newProgram', 'NUEVO PROGRAMA')}
          title={t('onboarding.howToCreate')}
          onBack={fromApp ? () => navigation.goBack() : null}
        />

        <ScrollView
          contentContainerStyle={styles.modeCards}
          showsVerticalScrollIndicator={false}
        >
          <ModeCard
            icon="auto"
            title={t('onboarding.modeAuto')}
            desc={t('onboarding.modeAutoDesc')}
            badge={t('onboarding.modeRecommended')}
            onPress={() => setMode('auto')}
          />
          <ModeCard
            icon="manual"
            title={t('onboarding.modeManual')}
            desc={t('onboarding.modeManualDesc')}
            onPress={() => setMode('manual')}
          />
          <ModeCard
            icon="import"
            title={t('onboarding.modeImport')}
            desc={t('onboarding.modeImportDesc')}
            onPress={fitdata.pickFile}
          />
          {templateList.length > 0 && (
            <ModeCard
              icon="template"
              title={t('onboarding.modeTemplate')}
              desc={t('onboarding.modeTemplateDesc', { count: templateList.length })}
              onPress={() => {
                setSelectedTemplateId(null);
                setTemplateProgramName('');
                setMode('template_picker');
              }}
            />
          )}
          <ModeCard
            icon="trainer"
            title={t('onboarding.modeTrainer')}
            desc={t('onboarding.modeTrainerDesc')}
            onPress={() => setShowClientCode(true)}
          />

          <Text style={styles.modeFooterHint}>{t('onboarding.modeFooterHint')}</Text>
        </ScrollView>

        {fitdata.modal}

        <ClientCodeModal
          visible={showClientCode || !!pendingInvite}
          onClose={() => setShowClientCode(false)}
          onSuccess={() => navigation.replace('Main')}
        />
      </View>
    );
  }

  // ── Modo manual ────────────────────────────────────────────────────
  if (mode === 'manual') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LimeHeader
          eyebrow={t('onboarding.newProgram', 'NUEVO PROGRAMA')}
          title={t('onboarding.modeManual')}
          onBack={() => setMode(null)}
        />

        {/* Pie y cuerpo dentro del KAV: si no, el teclado tapa los botones y no
            se puede crear el programa sin cerrarlo antes. */}
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <ScrollView
          contentContainerStyle={styles.formBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={styles.sectionLabel}>{t('onboarding.programName')}</Text>
            <NameField
              style={styles.textInput}
              value={manualName}
              onChangeText={setManualName}
              placeholder={t('onboarding.programNamePlaceholder')}
              autoFocus
            />
          </View>

          <View>
            <Text style={styles.sectionLabel}>{t('onboarding.sessionsPerWeek')}</Text>
            {/* Mismo rango que la pregunta de días (1-7): una sola sesión es un
                programa válido, y siete es el techo en las dos pantallas. */}
            <NumberChips values={SESSION_CHOICES} value={manualSessions} onChange={setManualSessions} />
            <Text style={[styles.qHint, styles.hintGap]}>
              {t('onboarding.emptySessionsHint', { count: manualSessions })}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.previewFooter}>
          <View style={styles.previewFooterBtns}>
            <TouchableOpacity style={styles.editBtn} onPress={() => setMode(null)} activeOpacity={0.85}>
              <Text style={styles.editBtnText}>{t('onboarding.back')}</Text>
            </TouchableOpacity>
            <PrimaryBtn
              label={t('onboarding.createAndEdit')}
              onPress={handleManualCreate}
              disabled={!manualName.trim()}
            />
          </View>
        </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Modo template picker ───────────────────────────────────────────
  if (mode === 'template_picker') {
    const selectedTpl = selectedTemplateId ? programs[selectedTemplateId] : null;

    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LimeHeader
          eyebrow={t('onboarding.newProgram', 'NUEVO PROGRAMA')}
          title={t('onboarding.modeTemplate')}
          onBack={() => setMode(null)}
        />

        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <ScrollView
          contentContainerStyle={styles.formBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={styles.sectionLabel}>{t('onboarding.yourTemplates')}</Text>
            <View style={styles.qCards}>
              {templateList.map((tpl) => {
                const dayCount = allProgramDays(tpl).length;
                return (
                  <QuestionCard
                    key={tpl.id}
                    title={tpl.name}
                    subtitle={dayCount > 0 ? t('onboarding.templateMeta', { count: dayCount }) : null}
                    selected={tpl.id === selectedTemplateId}
                    onPress={() => {
                      setSelectedTemplateId(tpl.id);
                      setTemplateProgramName(tpl.name);
                    }}
                  />
                );
              })}
            </View>
          </View>

          {selectedTpl && (
            <View>
              <Text style={styles.sectionLabel}>{t('onboarding.programName')}</Text>
              <NameField
                style={styles.textInput}
                value={templateProgramName}
                onChangeText={setTemplateProgramName}
                placeholder={selectedTpl.name}
                autoCorrect={false}
              />
              <Text style={[styles.qHint, styles.hintGap]}>
                {t('onboarding.templateCopyHint')}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.previewFooter}>
          <View style={styles.previewFooterBtns}>
            <TouchableOpacity style={styles.editBtn} onPress={() => setMode(null)} activeOpacity={0.85}>
              <Text style={styles.editBtnText}>{t('onboarding.back')}</Text>
            </TouchableOpacity>
            <PrimaryBtn
              label={t('onboarding.createProgram')}
              onPress={handleLoadTemplate}
              disabled={!selectedTemplateId}
            />
          </View>
        </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Modo automático — las tres preguntas ──────────────────────────────────────
  const onBack = step === 0 ? () => setMode(null) : prevStep;
  switch (currentStep) {
    case 'level':    return <StepLevel    answers={answers} set_={set_} onNext={nextStep} onBack={onBack} />;
    case 'identity': return <StepIdentity answers={answers} set_={set_} onNext={nextStep} onBack={onBack} />;
    case 'days':     return <StepDays     answers={answers} set_={set_} onNext={nextStep} onBack={onBack} />;
    default:         return null;
  }
}

// ─── Pasos individuales — §6.1 ─────────────────────────────────────────────────

function StepLevel({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <QuestionScreen
      title={t('onboarding.stepLevel.headerTitle', 'Tu nivel')}
      dotsDone={1}
      onBack={onBack}
      sectionLabel={t('onboarding.stepLevel.title', '¿Cuál es tu nivel?')}
      hint={t('onboarding.stepLevel.hint', 'Marca tu banda de volumen y qué programas te proponemos.')}
    >
      <View style={{ gap: spacing.sm }}>
        {LEVEL_IDS.map((id) => (
          <QuestionCard
            key={id}
            title={t(`onboarding.levels.${id}.label`, id)}
            subtitle={t(`onboarding.levels.${id}.description`, '')}
            selected={answers.level === id}
            onPress={() => { set_('level', id); onNext(); }}
          />
        ))}
      </View>
    </QuestionScreen>
  );
}

// §5.1: "¿Qué buscas?" — una sola pregunta que fija `discipline` y `goal`.
// Ninguna tarjeta se bloquea nunca: la identidad se pregunta antes que el
// nivel no gana nada bloqueando, así que no hay nada contra lo que validar.
function StepIdentity({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <QuestionScreen
      title={t('onboarding.identity.title', '¿Qué buscas?')}
      dotsDone={2}
      onBack={onBack}
      sectionLabel={t('onboarding.identity.title', '¿Qué buscas?')}
      hint={t('onboarding.identity.subtitle', 'Con esto elegimos el tipo de programa.')}
    >
      <View style={{ gap: spacing.sm }}>
        {IDENTITY_OPTIONS.map(({ id, discipline, goal }) => (
          <QuestionCard
            key={id}
            title={t(`onboarding.identity.${id}.label`, id)}
            subtitle={t(`onboarding.identity.${id}.description`, '')}
            selected={answers.discipline === discipline && answers.goal === goal}
            onPress={() => {
              set_('discipline', discipline);
              set_('goal', goal);
              onNext();
            }}
          />
        ))}
      </View>
    </QuestionScreen>
  );
}

// Chips 1-7 (`NumberChips`). Ninguno premarcado al entrar — `daysPerWeek: null`
// en `DEFAULT_ANSWERS`.
function StepDays({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();
  const d = answers.daysPerWeek;

  return (
    <QuestionScreen
      title={t('onboarding.stepDays.headerTitle', 'Días por semana')}
      dotsDone={3}
      onBack={onBack}
      sectionLabel={t('onboarding.stepDays.subtitleFrequency', '¿Cuántos días a la semana entrenas?')}
      hint={t('onboarding.stepDays.daysHint',
        'Cada sesión del programa es un entreno a la semana. Si un programa no cuadra con tus días, te lo decimos.')}
    >
      <NumberChips
        values={SESSION_CHOICES}
        value={d}
        onChange={(n) => { set_('daysPerWeek', n); onNext(); }}
      />
    </QuestionScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  // ── Selector de modo (§4: tarjeta de elección + icono y flecha de fila) ────
  modeCards: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  modeCard: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.lg,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
  },
  modeIcon:      { width: 20, alignItems: 'center', flexShrink: 0 },
  modeBody:      { flex: 1, minWidth: 0, gap: 3 },
  modeTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modeTitle:     { ...textStyles.itemTitle, color: th.colors.text, flexShrink: 1 },
  // Badge sólido de las propuestas (`proposalBadge`): marca la ruta por
  // defecto sin usar el tratamiento accent10/accent50, que significa ELEGIDO.
  modeBadge: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs2,
    flexShrink:        0,
  },
  modeBadgeText:  { ...textStyles.caps, color: th.colors.onAccent },
  modeDesc:       { ...textStyles.body, color: th.colors.mutedLight, lineHeight: 17 },
  modeFooterHint: {
    ...textStyles.body,
    color:             th.colors.mutedLight,
    lineHeight:        18,
    paddingHorizontal: spacing.xs2,
    paddingTop:        spacing.sm,
  },

  // ── Formularios (programa vacío / cargar plantilla) ────────────────────────
  formBody: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  qCards:   { gap: spacing.sm },
  hintGap:  { marginTop: spacing.md },
  // Caja de `nameInput` (CustomExerciseScreen) con el texto de 14 ExtraBold de
  // `MenuList.rowLabel`: en `itemTitle` (16) el nombre se veía enorme.
  textInput: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm2,
    ...textStyles.bodyStrong,
    fontFamily:        'Inter_800ExtraBold',
    color:             th.colors.text,
  },


  screen: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },

  // Brand tag

  // ── Las tres preguntas ─────────────────────────────────────────────────────
  qBody: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  sectionLabel: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  qHint: { ...textStyles.body, color: th.colors.mutedLight, lineHeight: 12 * 1.5 },
  // Columna, no fila: en fila el subtítulo se quedaba el ancho y el título se
  // comprimía hasta no leerse. El borde va también en la tarjeta apagada, en
  // transparente, para que seleccionar no mueva el layout 1 px.
  qCard: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    gap:               3,
    borderWidth:       borders.thin,
    borderColor:       'transparent',
  },
  qCardOn: {
    backgroundColor: th.tint.accent10,
    borderColor:     th.tint.accent50,
  },
  qCardTitle:   { ...textStyles.itemTitle, color: th.colors.text },
  qCardTitleOn: { color: th.colors.accent },
  qCardSubtitle: { ...textStyles.body, color: th.colors.mutedLight },

  // Programa elegido
  previewList: {
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.xxl,
    gap:               spacing.md,
  },
  kav: { flex: 1, minHeight: 0 },
  // Sin filete: §4.6 deja los bordes sólo como highlight de acento, y los dos
  // botones ya se leen como pie.
  previewFooter: {
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.lg,
  },
  previewFooterInner: { gap: spacing.sm },
  changeLaterText: { ...textStyles.body, color: th.colors.mutedLight },
  previewFooterBtns: { flexDirection: 'row', gap: spacing.sm },
  editBtn: {
    flex:            1,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: th.colors.surface2,
  },
  editBtnText: { ...textStyles.button, color: th.colors.text },
  startBtn: {
    flex:            2,
    flexDirection:   'row',
    gap:             spacing.sm,
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  startBtnText:    { ...textStyles.button, color: th.colors.onAccent },
  startBtnOff:     { backgroundColor: th.colors.surface2 },
  startBtnTextOff: { color: th.colors.mutedLight },

  // Enlaces de texto ("ver todas")
  linkBtn: {
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  linkBtnText: { ...textStyles.body, color: th.colors.accent },

  // Loading
  loadingScreen: {
    flex:            1,
    backgroundColor: th.colors.bg,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
  },
  loadingTitle: {
    ...textStyles.title,
    color:     th.colors.accent,
    textAlign: 'center',
  },
  loadingDesc: { ...textStyles.body, color: th.colors.mutedLight, textAlign: 'center' },




  // Template picker
});
