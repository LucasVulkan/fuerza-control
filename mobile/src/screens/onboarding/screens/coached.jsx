/**
 * Las pantallas del camino «con entrenador» del recorrido de entrada
 * (O03-05, spec §9, §21): el código (que abre el camino y lleva debajo las
 * salidas de quien no lo tiene o cuyo entrenador no usa la app), programa
 * encontrado, conectado, pedir el código y crear su programa.
 *
 * Cada una es un componente que `OnboardingFlowScreen` pinta por su id y recibe
 * `goTo(id)`. La lógica de conectarse (validar, avisos, historial, conectar) es
 * la de `ClientCodeModal`, extraída a `useClientCode`.
 *
 * Maqueta: docs/mockups/onboarding-2.html (c_app … c_copy).
 */
import { useEffect, useState } from 'react';
import { View, Share, Linking, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import { spacing, textStyles, lh, withOpacity } from '../../../theme';
import { useThemedStyles } from '../../../useTheme';
import { Text } from '../../../components/ui/Text';
import { Rise } from '../../../components/ui/Rise';
import CodeField from '../../../components/ui/CodeField';
import {
  FlowBody, FlowTitle, FlowOption, FlowFooter, FlowPanel, PanelButton, FlowNote, shareAndContinue,
} from '../../../components/onboarding/flow';
import useClientCode from '../../../hooks/useClientCode';
import ClientCodeModal from '../../../components/ClientCodeModal';
import { coachedExit } from '../../../utils/onboardingFlow';
import { WEB_URL } from '../../../config/web';
import { PRIVACY_URL } from '../../../config/legal';
import { startBuilder } from '../startBuilder';

// Constante y no `{}` en el selector: zustand 5 vuelve a pintar sin fin si devuelve un objeto nuevo cada vez.
const NONE = {};
const answersOf = (s) => s.onboardingFlow?.answers ?? NONE;

/** El nombre del entrenador sin los `*` (que `Marked` leería como énfasis), o `null`. */
const cleanName = (name) => (name ? name.replace(/\*/g, '').trim() : '') || null;

/** «Conectar con tu entrenador · Menú → Entrenador»: lo pendiente en «Listo» hasta que se conecte. */
const pendingItem = (t) => ({ key: 'coach', ok: false, label: t('onboardingFlow.coached.done.pending') });

// ── El código (§9.1-9.2) ──────────────────────────────────────────────────────
// Abre el camino: quien tiene código lo mete y sigue; debajo, «¿No te lo ha
// pasado?» y, si su entrenador no usa la app, invitarle o crear su programa.

function Code({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const answers    = useStore(answersOf);
  const entry      = useStore((s) => s.onboardingFlow?.entry);
  const pending    = useStore((s) => s.pendingInviteCode);
  const flowAnswer = useStore((s) => s.flowAnswer);
  const flowDone   = useStore((s) => s.flowDone);
  const setProfile = useStore((s) => s.setProfile);
  const clearPendingInviteCode = useStore((s) => s.clearPendingInviteCode);
  const { code, setCode, loading, error, errorCode, validate } = useClientCode();
  const { viaInvite, linked } = answers;
  const [social, setSocial] = useState(false);

  // Al llegar: por invitación esta persona no pasó por la bifurcación (§9.5), así
  // que se le pone el rol aquí, y el código viene puesto. Sin conectar, queda pendiente en «Listo».
  useEffect(() => {
    flowAnswer({ coachApp: 'code', ...(viaInvite ? { role: 'coached' } : {}) });
    if (viaInvite) setProfile({ role: 'coached', proTabsHidden: true, coachUsesApp: true });
    if (pending && !code) setCode(pending);
    if (!linked) flowDone(pendingItem(t));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Al salir del camino sin conectar, la invitación pendiente se descarta (si no, abriría
  // Conexión con entrenador al acabar). Pasar a «Programa encontrado» no es salir.
  useEffect(() => () => {
    const next = useStore.getState().onboardingFlow?.screen;
    if (next !== 'c_confirm' && next !== 'c_code') useStore.getState().clearPendingInviteCode();
  }, []);

  async function next() {
    if (code.length < 9 || loading) return;
    if (await validate()) goTo('c_confirm');
  }

  function later() {
    clearPendingInviteCode();
    goTo(coachedExit(answers, entry));
  }

  // Ya estuvo conectado con Google/Apple: la hoja de siempre busca su hueco y conecta.
  function linkedByAccount() {
    setSocial(false);
    const cs = useStore.getState().clientSync;
    const name = cleanName(cs.trainerName);
    const program = useStore.getState().programs[useStore.getState().profile.activeProgramId]?.name ?? '';
    flowAnswer({ linked: { trainerName: name, programName: program }, programSource: 'coach', coachApp: 'code' });
    flowDone({
      key: 'coach', ok: true,
      label: name ? t('onboardingFlow.coached.done.linked', { trainer: name }) : t('onboardingFlow.coached.done.linkedAnon'),
    });
    if (program) flowDone({ key: 'program', ok: true, label: t('onboardingFlow.coached.done.program', { program }) });
    clearPendingInviteCode();
    goTo('c_linked');
  }

  // Sin código: pedírselo. Su entrenador no usa la app: invitarle (no avanza) o crear su programa.
  function ask() {
    flowAnswer({ coachApp: 'nocode' });
    goTo('c_ask');
  }
  function noApp() {
    flowAnswer({ coachApp: 'no' });
    setProfile({ coachUsesApp: false });
  }
  function invite() {
    noApp();
    Share.share({ message: t('onboardingFlow.coached.noapp.inviteMessage', { url: WEB_URL }) }).catch(() => {});
  }

  return (
    <FlowBody
      footer={(
        <FlowFooter
          primary={{ label: t('onboardingFlow.coached.code.continue'), onPress: next, disabled: code.length < 9 || loading }}
          secondary={[{ label: t('onboardingFlow.coached.code.later'), onPress: later }]}
        />
      )}
    >
      <FlowTitle
        text={t('onboardingFlow.coached.code.title')}
        sub={t(viaInvite ? 'onboardingFlow.coached.code.subInvite' : 'onboardingFlow.coached.code.sub')}
      />
      <Rise index={2}>
        <CodeField value={code} onChangeText={setCode} groups={2} onSubmitEditing={next} error={error} />
      </Rise>

      {/* Ese código lo protege su cuenta de Google/Apple (C09 §4.7): la salida es
          entrar con ella, también si llegó por invitación. */}
      {viaInvite && errorCode === 'SEAT_LOCKED' && (
        <Rise index={3}>
          <Text style={styles.link} onPress={() => setSocial(true)} accessibilityRole="link">{t('onboardingFlow.coached.code.accountLink')}</Text>
        </Rise>
      )}

      {/* Quien llega por invitación ya tiene su código: no necesita las salidas. */}
      {!viaInvite && (
        <>
          <Rise index={3}>
            <Text style={styles.link} onPress={ask} accessibilityRole="link">{t('onboardingFlow.coached.code.askLink')}</Text>
            {/* Solo recupera una conexión hecha antes con esa cuenta: la primera vez hace falta el código. */}
            <Text style={styles.link} onPress={() => setSocial(true)} accessibilityRole="link">{t('onboardingFlow.coached.code.accountLink')}</Text>
          </Rise>
          <Rise index={4}><Text style={styles.label}>{t('onboardingFlow.coached.code.noApp')}</Text></Rise>
          <View style={styles.opts}>
            <FlowOption
              index={5}
              chevron
              title={t('onboardingFlow.coached.noapp.invite')}
              desc={t('onboardingFlow.coached.noapp.inviteDesc')}
              onPick={invite}
            />
            <FlowOption
              index={6}
              chevron
              title={t('onboardingFlow.coached.noapp.copy')}
              desc={t('onboardingFlow.coached.noapp.copyDesc')}
              onPick={() => { noApp(); goTo('c_copy'); }}
            />
          </View>
        </>
      )}
      {/* Montada solo mientras se usa: al desmontarse limpia el estado del código
          (`useClientCode`, compartido), y montada siempre lo borraba al pasar a
          «Programa encontrado». */}
      {social && <ClientCodeModal visible startWithSocial onClose={() => setSocial(false)} onSuccess={linkedByAccount} />}
    </FlowBody>
  );
}

// ── Programa encontrado (§9.3) ────────────────────────────────────────────────

function Confirm({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const flowBack   = useStore((s) => s.flowBack);
  const flowAnswer = useStore((s) => s.flowAnswer);
  const flowDone   = useStore((s) => s.flowDone);
  const clearPendingInviteCode = useStore((s) => s.clearPendingInviteCode);
  const { slotInfo, historyMode, setHistoryMode, alreadyLinked, loading, error, confirm } = useClientCode();

  // Sin hueco (el recorrido se retomó tras cerrar la app, o se vuelve desde «Conectado»): al código.
  useEffect(() => { if (!slotInfo) flowBack(); }, [slotInfo, flowBack]);
  if (!slotInfo) return null;

  const trainer = cleanName(slotInfo.trainerName);

  async function connect() {
    if (loading || !(await confirm())) return;
    const info = slotInfo;
    const name = trainer ?? cleanName(useStore.getState().clientSync.trainerName);
    flowAnswer({ linked: { trainerName: name, programName: info.programName }, programSource: 'coach', coachApp: 'code' });
    flowDone({
      key: 'coach', ok: true,
      label: name ? t('onboardingFlow.coached.done.linked', { trainer: name }) : t('onboardingFlow.coached.done.linkedAnon'),
    });
    flowDone({ key: 'program', ok: true, label: t('onboardingFlow.coached.done.program', { program: info.programName }) });
    clearPendingInviteCode();
    goTo('c_linked');
  }

  return (
    <FlowBody
      footer={(
        <FlowFooter
          primary={{
            label: t(loading ? 'onboardingFlow.coached.confirm.connecting' : 'onboardingFlow.coached.confirm.connect'),
            onPress: connect,
            disabled: loading,
          }}
        />
      )}
    >
      <FlowTitle text={t('onboardingFlow.coached.confirm.title')} />

      {/* Azul = del entrenador. */}
      <Rise index={1}>
        <View style={styles.found}>
          <Text style={styles.foundLabel}>
            {trainer ? t('onboardingFlow.coached.confirm.from', { trainer }) : t('onboardingFlow.coached.confirm.fromAnon')}
          </Text>
          <Text style={styles.foundName}>{slotInfo.programName}</Text>
        </View>
      </Rise>

      {alreadyLinked && <Rise index={2}><FlowNote tone="warn" text={t('trainer.codeAlreadyLinked')} /></Rise>}
      {/* Lo usa otro móvil: el código siempre entra y ese se desconecta (C09 §4.6). */}
      {slotInfo.alreadyLinked && <Rise index={2}><FlowNote tone="warn" text={t('trainer.codeSlotOccupied')} /></Rise>}
      {/* El error de conectar, arriba y a la vista (abajo quedaba bajo el pliegue). */}
      {!!error && <Rise index={2}><FlowNote tone="warn" text={error} /></Rise>}

      {/* La elección de historial solo existe si hay algo en la nube. */}
      {slotInfo.hasRemoteHistory && (
        <View style={styles.history}>
          {!slotInfo.alreadyLinked && <Rise index={3}><Text style={styles.bulletText}>{t('trainer.codeHistoryFromTrainer')}</Text></Rise>}
          {['program', 'merge'].map((mode, i) => (
            <FlowOption
              key={mode}
              index={4 + i}
              title={t(mode === 'program' ? 'trainer.codeHistoryProgram' : 'trainer.codeHistoryMerge')}
              desc={t(mode === 'program' ? 'trainer.codeHistoryProgramSub' : 'trainer.codeHistoryMergeSub')}
              selected={historyMode === mode}
              onPress={() => setHistoryMode(mode)}
            />
          ))}
        </View>
      )}

      <Rise index={6}>
        <Text style={styles.label}>{t('trainer.codeWhatHappens')}</Text>
        <View style={styles.bullets}>
          {['1', '2', '3', '4'].map((n) => (
            <View key={n} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>·</Text>
              <Text style={styles.bulletText}>
                {n === '2'
                  ? (trainer ? t('onboardingFlow.coached.confirm.implies2', { trainer }) : t('onboardingFlow.coached.confirm.implies2Anon'))
                  : t(`onboardingFlow.coached.confirm.implies${n}`)}
              </Text>
            </View>
          ))}
        </View>
        {/* Conectar es el consentimiento para compartir entrenos y peso (política §4, M02-06): la política, a un toque. */}
        {!!PRIVACY_URL && (
          <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
            {t('paywall.privacy')}
          </Text>
        )}
      </Rise>
    </FlowBody>
  );
}

// ── Conectado (§9.4) ──────────────────────────────────────────────────────────

function Linked({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const answers = useStore(answersOf);
  const entry   = useStore((s) => s.onboardingFlow?.entry);
  const { reset } = useClientCode();
  const trainer = answers.linked?.trainerName ?? null;
  const program = answers.linked?.programName ?? '';

  // Ya está conectado: lo del código se suelta.
  useEffect(() => { reset(); }, [reset]);

  const panel = (
    <FlowPanel desc={t('onboardingFlow.coached.linked.hint')}>
      {/* Desde la app no hay Aprende: el botón cierra el recorrido. */}
      <PanelButton
        label={t(entry === 'newProgram' ? 'onboardingFlow.done.cta' : 'onboardingFlow.common.next')}
        onPress={() => goTo(coachedExit(answers, entry))}
      />
    </FlowPanel>
  );

  return (
    <FlowBody footer={panel}>
      {!!trainer && (
        <Rise index={0}>
          <View style={styles.avatar}><Text style={styles.avatarTxt}>{trainer.charAt(0).toUpperCase()}</Text></View>
        </Rise>
      )}
      <FlowTitle
        index={1}
        text={trainer ? t('onboardingFlow.coached.linked.title', { trainer }) : t('onboardingFlow.coached.linked.titleAnon')}
        sub={trainer ? t('onboardingFlow.coached.linked.sub', { trainer, program }) : t('onboardingFlow.coached.linked.subAnon', { program })}
      />
    </FlowBody>
  );
}

// ── Sin código: pedírselo (§9.1) ──────────────────────────────────────────────

function Ask({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const message = t('onboardingFlow.coached.ask.message');
  // Enviado o no, la pantalla siguiente explica dónde meter el código cuando llegue.
  const next = () => goTo('c_wait');

  return (
    <FlowBody
      footer={(
        <FlowFooter
          primary={{ label: t('onboardingFlow.coached.ask.send'), onPress: () => shareAndContinue(message, next) }}
          secondary={[{ label: t('onboardingFlow.coached.ask.later'), onPress: next }]}
        />
      )}
    >
      <FlowTitle text={t('onboardingFlow.coached.ask.title')} sub={t('onboardingFlow.coached.ask.sub')} />
      <Rise index={2}>
        <View style={styles.msg}><Text style={styles.msgTxt}>{message}</Text></View>
      </Rise>
    </FlowBody>
  );
}

// ── Cuando llegue el código (O03 §28.2) ──────────────────────────────────────

function Wait({ goTo }) {
  const { t } = useTranslation();
  const answers = useStore(answersOf);
  const entry   = useStore((s) => s.onboardingFlow?.entry);
  return (
    <FlowBody
      footer={(
        <FlowFooter
          primary={{ label: t('onboardingFlow.coached.wait.next'), onPress: () => goTo(coachedExit(answers, entry)) }}
          secondary={[{ label: t('onboardingFlow.coached.wait.have'), onPress: () => goTo('c_code') }]}
        />
      )}
    >
      <FlowTitle text={t('onboardingFlow.coached.wait.title')} sub={t('onboardingFlow.coached.wait.sub')} />
      <Rise index={2}><FlowNote tone="blue" text={t('onboardingFlow.coached.wait.where')} /></Rise>
    </FlowBody>
  );
}

// ── Crear su programa en la app (§9.1) ────────────────────────────────────────

function Copy({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return (
    <FlowBody>
      <FlowTitle text={t('onboardingFlow.coached.copy.title')} sub={t('onboardingFlow.coached.copy.sub')} />
      <View style={styles.opts}>
        <FlowOption
          index={2}
          chevron
          title={t('onboardingFlow.coached.copy.hand')}
          desc={t('onboardingFlow.coached.copy.handDesc')}
          onPick={() => startBuilder(goTo, 'copy')}
        />
        <FlowOption
          index={3}
          chevron
          title={t('onboardingFlow.coached.copy.similar')}
          desc={t('onboardingFlow.coached.copy.similarDesc')}
          onPick={() => goTo('s_level')}
        />
      </View>
    </FlowBody>
  );
}

export default { c_code: Code, c_confirm: Confirm, c_linked: Linked, c_ask: Ask, c_wait: Wait, c_copy: Copy };

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  opts: { gap: spacing.md },

  // Programa encontrado: la tarjeta con borde azul (azul = entrenador).
  found: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    borderWidth:     2,
    borderColor:     th.colors.blue,
    padding:         spacing.lg,
    gap:             spacing.sm,
  },
  foundLabel: { ...textStyles.caps, color: th.colors.blue, textTransform: 'uppercase' },
  foundName:  { ...textStyles.itemTitle, color: th.colors.text },

  history: { gap: spacing.md, marginTop: spacing.lg },

  label:      { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.md },
  bullets:    { gap: spacing.sm },
  bulletRow:  { flexDirection: 'row', gap: spacing.sm },
  bulletDot:  { ...textStyles.body, color: th.colors.accent, lineHeight: lh(14) },
  bulletText: { ...textStyles.body, color: th.colors.mutedLight, lineHeight: lh(14), flex: 1 },
  link:       { ...textStyles.body, color: th.colors.accent, lineHeight: lh(14), marginTop: spacing.md },

  // Conectado
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: withOpacity(th.colors.blue, 0.14),
    marginBottom: spacing.lg,
  },
  avatarTxt: { ...textStyles.heroName, color: th.colors.blue },

  // Pedir el código: el mensaje tal como se enviará.
  msg:    { backgroundColor: th.colors.surface, borderRadius: th.radius.lg, padding: spacing.lg },
  msgTxt: { ...textStyles.body, color: th.colors.text, lineHeight: lh(14) },
});
