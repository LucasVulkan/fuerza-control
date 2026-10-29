/**
 * Las pantallas del camino del entrenador del recorrido de entrada (O03-08, spec
 * §7, §24): nº de clientes y clases en grupo (datos), su primer cliente, su
 * cuenta y su código personal, el programa del cliente (constructor o catálogo +
 * asignar), invitarle y «¿también entrenas?».
 *
 * Todo es real: el cliente se crea siempre SIN app (`createClient(name)`) y, con
 * la cuenta hecha, pasa a la app con `connectClientToCloud` (§2.2.1). Asignar del
 * catálogo y guardar en el constructor ENVÍAN (§2.2.2), y sin programa enviado no
 * hay invitación (§2.2.3). La cuenta va por `useTrainerAccount`, como la hoja de
 * Clientes y «Mi cuenta».
 *
 * Maqueta: docs/mockups/onboarding-2.html (t_clients … t_self).
 */
import { useEffect, useRef, useState } from 'react';
import { View, Pressable, Share, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import { ARCHETYPES } from '../../../data/archetypes';
import { spacing, textStyles, getCardRadii } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { Text } from '../../../components/ui/Text';
import { Rise } from '../../../components/ui/Rise';
import NameField from '../../../components/ui/NameField';
import ClientRow from '../../../components/ClientRow';
import TrainerSyncModal from '../../../components/TrainerSyncModal';
import { newClientRow } from '../../../components/onboarding/learn/newClientRow';
import { totalWeeksOf } from '../../../components/onboarding/proposalData';
import useTrainerAccount from '../../../hooks/useTrainerAccount';
import { APPLE_AUTH_AVAILABLE } from '../../../services/appleAuth';
import { inviteUrl } from '../../../config/web';
import {
  FlowBody, FlowTitle, FlowOption, FlowTile, FlowFooter, FlowNote, shareAndContinue,
} from '../../../components/onboarding/flow';
import { afterProgram, learnStart } from '../../../utils/onboardingFlow';
import { startBuilder } from '../startBuilder';

import { isNetworkError } from '../../../utils/networkError';

const K = 'onboardingFlow.trainer';

// Constante y no `{}` en el selector: zustand 5 repinta sin fin si devuelve un objeto nuevo cada vez.
const NONE = {};
const answersOf = (s) => s.onboardingFlow?.answers ?? NONE;
const clientOf  = (s) => s.clients[answersOf(s).clientId] ?? null;

/** Una línea de «Listo» (§11.5). */
const done = (key, ok, label) => useStore.getState().flowDone({ key, ok, label });

/**
 * Pasa el cliente del recorrido a la app (le da hueco y código) si aún no lo
 * tiene. Un fallo no para el recorrido: queda sin app, se avisa, y desde su
 * ficha se pasa después («Pasar a la app»).
 */
async function connectClient(t) {
  const s = useStore.getState();
  const client = clientOf(s);
  if (!client || client.slotId) return;
  try {
    await s.connectClientToCloud(client.id);
  } catch (err) {
    console.warn('[onboarding] connectClientToCloud:', err?.message);
    s.showToast(t('clients.slotCreateError'), 3500, 'error');
  }
}

/** La fila de Clientes de verdad (C08) del cliente del recorrido, con `program` o sin él. */
function MyClientRow({ program }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const client = useStore(clientOf);
  if (!client) return null;
  const r = newClientRow(t, th.colors, { client, program, app: !!client.slotId });
  return (
    <View pointerEvents="none">
      <ClientRow
        client={r.client}
        link={r.link}
        badgeLabel={r.badgeLabel}
        radii={getCardRadii(th, true, true)}
        meta={r.meta}
        week={r.week}
        cta={r.cta}
      />
    </View>
  );
}

// ── 1 · ¿Con cuántos clientes trabajas? (§7.1) ────────────────────────────────

// Dos filas de dos baldosas grandes, como las de unidades.
const BANDS = [['1-5', '6-15'], ['16-30', '30+']];

function Clients({ goTo }) {
  const st = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const band       = useStore((s) => answersOf(s).clientsBand);
  const flowAnswer = useStore((s) => s.flowAnswer);
  const setProfile = useStore((s) => s.setProfile);

  function pick(b) {
    flowAnswer({ clientsBand: b });
    setProfile({ trainerClientsBand: b });
  }

  return (
    <FlowBody footer={<FlowFooter primary={{ label: t('onboardingFlow.common.next'), onPress: () => goTo('t_groups'), disabled: !band }} />}>
      <FlowTitle text={t(`${K}.clients.title`)} sub={t(`${K}.clients.sub`)} />
      {BANDS.map((row, r) => (
        <View key={r} style={st.tiles}>
          {row.map((b, i) => (
            <FlowTile
              key={b}
              index={2 + r * 2 + i}
              big={b === '30+' ? '+30' : b}
              label={t(`${K}.clients.unit`)}
              selected={band === b}
              onPress={() => pick(b)}
            />
          ))}
        </View>
      ))}
      {/* Lo que trae el plan gratis: solo informa, sin compra (§13). */}
      {!!band && <Rise index={6}><FlowNote tone="acc" text={t(`${K}.clients.free`)} style={st.gapTop} /></Rise>}
    </FlowBody>
  );
}

// ── 2 · ¿Das clases en grupo? (§7.2) ──────────────────────────────────────────

const GROUPS = ['yes', 'some', 'no'];

function Groups({ goTo }) {
  const st = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const groups     = useStore((s) => answersOf(s).groups);
  const flowAnswer = useStore((s) => s.flowAnswer);
  const setProfile = useStore((s) => s.setProfile);
  return (
    <FlowBody>
      <FlowTitle text={t(`${K}.groups.title`)} sub={t(`${K}.groups.sub`)} />
      <View style={st.opts}>
        {GROUPS.map((g, i) => (
          <FlowOption
            key={g}
            index={2 + i}
            title={t(`${K}.groups.${g}`)}
            selected={groups === g}
            // Solo dato: hoy no hay clases en grupo (C06-01 aparcada).
            onPress={() => { flowAnswer({ groups: g }); setProfile({ trainerGroups: g }); }}
            onPick={() => goTo('t_client')}
          />
        ))}
      </View>
    </FlowBody>
  );
}

// ── 3 · Crea tu primer cliente (§7.3) ─────────────────────────────────────────

function Client({ goTo }) {
  const st = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const th     = useTheme();
  const client = useStore(clientOf);
  const saved  = useStore((s) => answersOf(s).clientMode);
  const [name, setName] = useState(client?.name ?? '');
  const [mode, setMode] = useState(saved);
  const busy = useRef(false);

  async function create() {
    if (!name.trim() || !mode || busy.current) return;
    busy.current = true;
    const s = useStore.getState();
    // Volver atrás y cambiar el nombre renombra: no crea otro.
    let id = client?.id;
    if (id) { if (name.trim() !== client.name) s.renameClient(id, name); }
    else id = await s.createClient(name);   // siempre sin app: el hueco va con la cuenta
    busy.current = false;
    if (!id) return;   // el plan gratis lo paró (el store ya enseñó el paywall)

    s.flowAnswer({ clientId: id, clientMode: mode });
    done('client', true, t(`${K}.done.${mode === 'app' ? 'client' : 'clientSelf'}`, { name: name.trim() }));
    if (mode !== 'app') { goTo('t_program'); return; }
    if (!s.trainerSync.userId) { goTo('t_account'); return; }
    await connectClient(t);   // cuenta ya hecha (se volvió atrás): directo a su programa
    goTo('t_program');
  }

  return (
    <FlowBody footer={<FlowFooter primary={{ label: t(`${K}.client.create`), onPress: create, disabled: !name.trim() || !mode }} />}>
      <FlowTitle text={t(`${K}.client.title`)} sub={t(`${K}.client.sub`)} />
      <Rise index={2}>
        <NameField
          style={st.input}
          value={name}
          onChangeText={setName}
          placeholder={t(`${K}.client.placeholder`)}
          placeholderTextColor={th.colors.mutedLight}
          accessibilityLabel={t(`${K}.client.nameLabel`)}
          returnKeyType="done"
        />
      </Rise>
      <Rise index={3}><Text style={st.label}>{t('clients.newClientModal.modeLabel')}</Text></Rise>
      <View style={st.opts}>
        {['app', 'self'].map((m, i) => (
          <FlowOption
            key={m}
            index={4 + i}
            title={t(`clients.newClientModal.mode_${m}`)}
            desc={t(`clients.newClientModal.mode_${m}Sub`)}
            selected={mode === m}
            onPress={() => setMode(m)}
          />
        ))}
      </View>
      <Rise index={6}><Text style={st.hint}>{t(`${K}.client.hint`)}</Text></Rise>
    </FlowBody>
  );
}

// ── 4 · Tu cuenta de entrenador (§7.4) ────────────────────────────────────────
// Solo con app y sin «Saltar»: sin cuenta no hay código para el cliente.

function Account({ goTo }) {
  const st = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const th     = useTheme();
  const acct   = useTrainerAccount();
  const clientName  = useStore((s) => clientOf(s)?.name ?? '');
  const trainerName = useStore((s) => s.trainerSync.trainerName ?? '');
  const [name, setName]       = useState(trainerName);
  const [error, setError]     = useState(null);
  const [recover, setRecover] = useState(false);
  const busy = useRef(false);

  function saveName() {
    if (name.trim() && name.trim() !== trainerName) useStore.getState().setTrainerName(name);
  }

  /** Con la cuenta hecha: el cliente pasa a la app y se sigue. Con código, a guardarlo. */
  async function ready(how, reveal = true) {
    const s = useStore.getState();
    s.flowAnswer({ account: how, ...(how === 'code' && !reveal ? { codeSaved: true } : {}) });
    if (how !== 'code') done('account', true, t(`${K}.done.${how}`));
    else if (!reveal) done('account', true, t(`${K}.done.code`));
    else done('account', false, t(`${K}.done.codePending`));
    await connectClient(t);
    goTo(how === 'code' && reveal ? 't_code' : 't_program');
  }

  async function pick(how) {
    if (busy.current) return;
    setError(null);
    if (how !== 'code' && acct.isExpoGo) { setError(t('sync.onlyInstalled')); return; }
    busy.current = true;
    // El nombre antes de entrar: si ya hay uno, Google o Apple no lo pisan.
    saveName();
    try {
      if (how === 'code') await acct.createCode();
      else await (how === 'apple' ? acct.signInWithApple : acct.signInWithGoogle)();
      await ready(how);
    } catch (err) {
      if (!err?.cancelled) setError(err?.message ?? t(how === 'code' ? 'sync.errAccountBody' : 'sync.errGoogleBody'));
    } finally {
      busy.current = false;
    }
  }

  // «Ya tengo cuenta de entrenador»: la hoja de siempre, en recuperar. Ha ido bien
  // si al cerrarse hay cuenta en el móvil.
  function closeRecover() {
    setRecover(false);
    const ts = useStore.getState().trainerSync;
    if (ts.userId) { saveName(); ready(ts.mode ?? 'code', false); }
  }

  const opts = [
    ...(APPLE_AUTH_AVAILABLE ? ['apple'] : []),   // en Android, ni se pinta
    'google',
    'code',
  ];

  return (
    <FlowBody footer={<FlowFooter secondary={[{ label: t(`${K}.account.have`), onPress: () => setRecover(true) }]} />}>
      <FlowTitle text={t(`${K}.account.title`)} sub={t(`${K}.account.sub`, { name: clientName })} />
      <Rise index={2}><Text style={st.label}>{t(`${K}.account.nameLabel`)}</Text></Rise>
      <Rise index={3}>
        <NameField
          style={st.input}
          value={name}
          onChangeText={setName}
          onBlur={saveName}
          placeholder={t(`${K}.account.namePlaceholder`)}
          placeholderTextColor={th.colors.mutedLight}
          accessibilityLabel={t(`${K}.account.nameLabel`)}
          returnKeyType="done"
        />
      </Rise>
      <View style={st.opts}>
        {opts.map((how, i) => (
          <FlowOption
            key={how}
            index={4 + i}
            chevron
            title={t(`${K}.account.${how}`)}
            desc={t(`${K}.account.${how}Desc`)}
            disabled={acct.loading}
            onPick={() => pick(how)}
          />
        ))}
      </View>
      {!!error && <Rise index={7}><FlowNote tone="warn" text={error} style={st.gapTop} /></Rise>}
      {/* Montada solo mientras se usa: lleva su propia petición de Google. */}
      {recover && <TrainerSyncModal visible initialScreen="recovery" isFirstTime={false} onClose={closeRecover} />}
    </FlowBody>
  );
}

// ── 5 · Tu código personal (§7.5) ─────────────────────────────────────────────
// «Ya lo he guardado» no se activa hasta copiarlo o enviárselo: sin él la cuenta
// y los clientes no se recuperan.

function Code({ goTo }) {
  const { t } = useTranslation();
  const st = useThemedStyles(makeStyles);
  const code     = useStore((s) => s.trainerSync.code);
  const saved    = useStore((s) => !!answersOf(s).codeSaved);
  const flowBack = useStore((s) => s.flowBack);
  const [how, setHow] = useState(null);   // 'copy' | 'send': el ✓ del botón

  function keep(way) {
    setHow(way);
    useStore.getState().flowAnswer({ codeSaved: true });
    done('account', true, t(`${K}.done.code`));
  }
  async function copy() {
    await Clipboard.setStringAsync(code);
    keep('copy');
  }
  async function send() {
    try {
      const res = await Share.share({ message: code });
      if (res.action === Share.sharedAction) keep('send');
    } catch { /* hoja de compartir rota: queda Copiar */ }
  }

  // Sin código (el móvil entró con Google o Apple por otro lado): nada que guardar.
  useEffect(() => { if (!code) goTo('t_program'); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!code) return null;

  return (
    <FlowBody
      footer={(
        <FlowFooter
          primary={{ label: t(`${K}.code.${saved ? 'saved' : 'saveFirst'}`), onPress: () => goTo('t_program'), disabled: !saved }}
          // Vuelve a la cuenta: entrar con Google o Apple se lleva la cuenta y sus clientes.
          secondary={[{ label: t(`${K}.code.other`), onPress: flowBack }]}
        />
      )}
    >
      <FlowTitle text={t(`${K}.code.title`)} sub={t(`${K}.code.sub`)} />
      <Rise index={2}>
        <View style={st.codeBox}>
          <Text style={st.codeText}>{code}</Text>
          <Text style={st.codeHint}>{t(`${K}.code.label`)}</Text>
        </View>
      </Rise>
      <Rise index={3}>
        <View style={st.pair}>
          <SecondaryButton style={st.half} label={t(`${K}.code.${how === 'copy' ? 'copied' : 'copy'}`)} onPress={copy} />
          <SecondaryButton style={st.half} label={t(`${K}.code.${how === 'send' ? 'sent' : 'send'}`)} onPress={send} />
        </View>
      </Rise>
      <Rise index={4}><FlowNote tone="warn" text={t('sync.revealWarn')} style={st.gapTop} /></Rise>
    </FlowBody>
  );
}

function SecondaryButton({ label, onPress, style }) {
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable style={({ pressed }) => [st.btn2, style, pressed && st.pressed]} onPress={onPress} accessibilityRole="button">
      <Text style={st.btn2Txt}>{label}</Text>
    </Pressable>
  );
}

// ── 6 · Ahora, el programa de {cliente} (§7.6) ────────────────────────────────

function Program({ goTo }) {
  const st = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const client = useStore(clientOf);
  const name   = client?.name ?? '';
  const app    = !!client?.slotId;

  // Sin programa no hay invitación: queda pendiente con dónde se retoma.
  function later() {
    done('program', false, t(`${K}.done.program`, { name }));
    if (app) done('invite', false, t(`${K}.done.invitePending`, { name }));
    goTo(afterProgram(useStore.getState().onboardingFlow.answers));
  }

  return (
    <FlowBody footer={<FlowFooter secondary={[{ label: t(`${K}.program.later`), onPress: later }]} />}>
      <FlowTitle text={t(`${K}.program.title`, { name })} sub={t(`${K}.program.sub`)} />
      <View style={st.opts}>
        <FlowOption
          index={2}
          chevron
          title={t(`${K}.program.create`)}
          desc={t(`${K}.program.createDesc`)}
          tag={t(`${K}.program.createTag`)}
          onPick={() => startBuilder(goTo, 'trainer')}
        />
        <FlowOption
          index={3}
          chevron
          title={t(`${K}.program.catalog`)}
          desc={t(`${K}.program.catalogDesc`)}
          onPick={() => goTo('t_catalog')}
        />
      </View>
      {app && <Rise index={4}><Text style={st.hint}>{t(`${K}.program.inviteAfter`, { name })}</Text></Rise>}
    </FlowBody>
  );
}

// ── 7 · Del catálogo → asignar (§7.7) ─────────────────────────────────────────

/** «3 sesiones · 8 semanas» y debajo sus letras. */
function archetypeDesc(t, a) {
  const weeks = totalWeeksOf(a.phases);
  return [
    t('onboardingFlow.self.props.sessionsCount', { count: a.days.length }),
    weeks > 0 ? t('onboarding.proposals.weeks', { weeks }) : null,
  ].filter(Boolean).join(' · ') + '\n' + a.days.map((d) => d.label).join(' · ');
}

function Catalog({ goTo }) {
  const st = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const name = useStore((s) => clientOf(s)?.name ?? '');
  return (
    <FlowBody>
      <FlowTitle text={t(`${K}.catalog.title`, { name })} sub={t(`${K}.catalog.sub`)} />
      <View style={st.opts}>
        {ARCHETYPES.map((a, i) => (
          <FlowOption
            key={a.id}
            index={2 + i}
            chevron
            title={a.name}
            desc={archetypeDesc(t, a)}
            onPick={() => { useStore.getState().flowAnswer({ catalogId: a.id }); goTo('t_assign'); }}
          />
        ))}
      </View>
    </FlowBody>
  );
}

const ASSIGNED_MS = 1300;   // lo que se ve la fila cambiada antes de avanzar sola

function Assign({ goTo }) {
  const st = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const a       = useStore(answersOf);
  const client  = useStore(clientOf);
  const program = useStore((s) => (answersOf(s).programSource === 'catalog' ? s.programs[answersOf(s).programId] ?? null : null));
  const archetype = ARCHETYPES.find((x) => x.id === a.catalogId);
  // Asignado = el programa del recorrido salió de esta misma plantilla (al volver atrás se ve hecho).
  const assigned = !!program && a.assignedFrom === a.catalogId;
  const [busy, setBusy] = useState(false);
  const name = client?.name ?? '';
  const app  = !!client?.slotId;

  useEffect(() => {
    if (!assigned || !busy) return undefined;
    const timer = setTimeout(() => {
      if (useStore.getState().onboardingFlow?.screen === 't_assign') goTo(afterProgram(useStore.getState().onboardingFlow.answers));
    }, ASSIGNED_MS);
    return () => clearTimeout(timer);
  }, [assigned, busy, goTo]);

  async function assign() {
    if (busy || assigned || !client || !archetype) return;
    setBusy(true);
    const s = useStore.getState();
    const id = s.generateProgramForClient(client.id, archetype.id);
    if (!id) { setBusy(false); return; }
    s.setClientActiveProgram(client.id, id);
    let sent = false;
    if (app) {
      try {
        await s.uploadProgramToClient(client.id, id);
        sent = true;
      } catch (err) {
        // Sin red: queda en su ficha como «cambios sin enviar», y sin invitación.
        const net = isNetworkError(err);
        s.showToast(t(net ? 'sync.offlineQueued' : `${K}.assign.sendFailed`), 3500, net ? 'neutral' : 'error');
      }
    }
    s.flowAnswer({ programId: id, programSource: 'catalog', assignedFrom: archetype.id, sent });
    done('program', true, t(`${K}.done.${sent ? 'catalogSent' : 'catalog'}`, { program: archetype.name }));
    if (app && !sent) done('invite', false, t(`${K}.done.invitePending`, { name }));
  }

  if (!archetype) return null;

  return (
    <FlowBody
      footer={(
        <FlowFooter
          // Recién asignado: «✓ Asignado» y avanza solo. Ya asignado al volver atrás: «Siguiente».
          primary={assigned && !busy
            ? { label: t('onboardingFlow.common.next'), onPress: () => goTo(afterProgram(a)) }
            : { label: t(`${K}.assign.${assigned ? 'assigned' : 'assign'}`), onPress: assign, disabled: busy || assigned }}
        />
      )}
    >
      <FlowTitle
        text={t(`${K}.assign.${assigned ? 'titleDone' : 'title'}`, { name })}
        sub={t(`${K}.assign.${app ? 'subApp' : 'subSelf'}`)}
      />
      <Rise index={2}><Text style={st.label}>{t(`${K}.assign.fromCatalog`)}</Text></Rise>
      <View pointerEvents="none">
        <FlowOption index={3} title={archetype.name} desc={archetypeDesc(t, archetype)} selected />
      </View>
      <Rise index={4}><Text style={[st.label, st.gapTop]}>{t(`${K}.assign.clientsLabel`)}</Text></Rise>
      <Rise index={5}><MyClientRow program={program} /></Rise>
    </FlowBody>
  );
}

// ── 8 · Invita a {cliente} (§7.8) ─────────────────────────────────────────────
// Solo con app y con programa enviado: un código sin programa le da error.

function Invite({ goTo }) {
  const { t } = useTranslation();
  const st = useThemedStyles(makeStyles);
  const client  = useStore(clientOf);
  const program = useStore((s) => s.programs[clientOf(s)?.activeProgramId] ?? null);
  const [copied, setCopied] = useState(false);
  const name = client?.name ?? '';
  const code = client?.code ?? '';

  // «Lo envío después» y compartir dejan lo suyo en «Listo»; el reloj sigue en su fila.
  function later() {
    done('invite', false, t(`${K}.done.inviteLater`, { name }));
    goTo('t_self');
  }
  function send() {
    shareAndContinue(t('clients.codeCard.shareText', { code, url: inviteUrl(code) }), () => {
      done('invite', true, t(`${K}.done.invited`, { name }));
      done('wait', false, t(`${K}.done.wait`, { name }));
      goTo('t_self');
    });
  }
  async function copy() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
  }

  return (
    <FlowBody
      footer={(
        <FlowFooter
          primary={{ label: t(`${K}.invite.send`), onPress: send }}
          secondary={[{ label: t(`${K}.invite.later`), onPress: later }]}
        />
      )}
    >
      <FlowTitle text={t(`${K}.invite.title`, { name })} sub={t(`${K}.invite.sub`, { program: program?.name ?? '' })} />
      <Rise index={2}>
        <View style={st.codeBox}>
          <Text style={st.codeText}>{code}</Text>
          <Text style={st.codeHint}>{t(`${K}.invite.codeLabel`)}</Text>
        </View>
      </Rise>
      <Rise index={3}><SecondaryButton style={st.gapTop} label={t(`${K}.invite.${copied ? 'copied' : 'copy'}`)} onPress={copy} /></Rise>
      <Rise index={4}><Text style={[st.label, st.gapTop]}>{t(`${K}.invite.clientsLabel`)}</Text></Rise>
      <Rise index={5}><MyClientRow program={program} /></Rise>
    </FlowBody>
  );
}

// ── 9 · ¿Y tú también entrenas? (§7.9) ────────────────────────────────────────

/**
 * «Sí» empalma con «por mi cuenta», que crea su propio programa con las mismas
 * respuestas (`programId`, `builderCtx`) y las mismas líneas de «Listo»
 * (`program`, `fill`). Las del cliente se apartan con otro nombre y su programa
 * se guarda en `clientProgramId`; al volver aquí se recuperan.
 */
const CLIENT_KEYS = { program: 'clientProgram', fill: 'clientFill' };

function rekeyDone(map) {
  useStore.setState((s) => (s.onboardingFlow
    ? { onboardingFlow: { ...s.onboardingFlow, done: s.onboardingFlow.done.map((d) => (map[d.key] ? { ...d, key: map[d.key] } : d)) } }
    : {}));
}

function Self({ goTo }) {
  const st = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const a          = useStore(answersOf);
  const flowAnswer = useStore((s) => s.flowAnswer);
  const setProfile = useStore((s) => s.setProfile);

  // De vuelta desde «por mi cuenta»: el programa del recorrido vuelve a ser el del cliente.
  useEffect(() => {
    if (!a.clientProgramId) return;
    flowAnswer({ programId: a.clientProgramId, builderCtx: a.clientBuilderCtx ?? null, clientProgramId: null });
    rekeyDone(Object.fromEntries(Object.entries(CLIENT_KEYS).map(([k, v]) => [v, k])));
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  function pick(yes) {
    flowAnswer({ alsoTrains: yes });
    // El que no entrena arranca en Clientes; Inicio sigue estando.
    setProfile({ alsoTrains: yes, homeTab: yes ? 'Home' : 'Clients' });
  }

  function next(yes) {
    if (!yes) { goTo(learnStart(useStore.getState().onboardingFlow.answers)); return; }
    const cur = useStore.getState().onboardingFlow.answers;
    flowAnswer({ clientProgramId: cur.programId ?? null, clientBuilderCtx: cur.builderCtx ?? null, programId: null, builderCtx: null });
    rekeyDone(CLIENT_KEYS);
    goTo('s_level');
  }

  return (
    <FlowBody>
      <FlowTitle text={t(`${K}.self.title`)} sub={t(`${K}.self.sub`)} />
      <View style={st.opts}>
        {[true, false].map((yes, i) => (
          <FlowOption
            key={String(yes)}
            index={2 + i}
            title={t(`${K}.self.${yes ? 'yes' : 'no'}`)}
            desc={t(`${K}.self.${yes ? 'yesDesc' : 'noDesc'}`)}
            selected={a.alsoTrains === yes}
            onPress={() => pick(yes)}
            onPick={() => next(yes)}
          />
        ))}
      </View>
    </FlowBody>
  );
}

export default {
  t_clients: Clients, t_groups: Groups, t_client: Client, t_account: Account, t_code: Code,
  t_program: Program, t_catalog: Catalog, t_assign: Assign, t_invite: Invite, t_self: Self,
};

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  opts:    { gap: spacing.md },
  tiles:   { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  pair:    { flexDirection: 'row', gap: spacing.sm2, marginTop: spacing.md },
  half:    { flex: 1 },
  gapTop:  { marginTop: spacing.lg },
  pressed: { opacity: 0.85 },
  input: {
    ...textStyles.bodyStrong, color: th.colors.text,
    backgroundColor: th.colors.surface, borderRadius: th.radius.md,
    paddingVertical: spacing.lg - 2, paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  label: { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase', marginBottom: spacing.sm2 },
  hint:  { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.md },

  codeBox: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    paddingVertical: spacing.xl,
    alignItems:      'center',
    gap:             spacing.sm,
  },
  codeText: { ...textStyles.code, color: th.colors.accent, fontVariant: ['tabular-nums'] },
  codeHint: { ...textStyles.label, color: th.colors.mutedLight },
  btn2: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  btn2Txt: { ...textStyles.button, color: th.colors.text },
});
