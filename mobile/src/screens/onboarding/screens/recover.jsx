/**
 * «Ya tengo cuenta» del recorrido de entrada (O03-07, spec §12, §23): «Recupera
 * lo tuyo». Tres entradas:
 *
 *   · cuenta de entrenador → `r_trainer` «¿Cómo entrabas?»: código (`r_code`),
 *     Google o Apple, con `useTrainerAccount` (O03-13 §29.2; nunca crea cuenta)
 *   · entreno con entrenador → `r_client` «¿Cómo te conectabas?»: su código o
 *     Google/Apple, con `ClientCodeModal` (montado solo mientras se usa)
 *   · copia de seguridad → selector de archivo + `ImportModal`
 *
 * Si la recuperación sale bien se marca el onboarding como hecho y se va a la
 * app; si se cancela, se queda donde estaba.
 *
 * Maqueta: docs/mockups/onboarding-2.html (recover).
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useStore } from '../../../../store/useStore';
import { spacing } from '../../../theme';
import { Rise } from '../../../components/ui/Rise';
import { showDialog } from '../../../components/ui/dialog';
import CodeField from '../../../components/ui/CodeField';
import useTrainerAccount from '../../../hooks/useTrainerAccount';
import { APPLE_AUTH_AVAILABLE } from '../../../services/appleAuth';
import { FlowBody, FlowTitle, FlowOption, FlowNote, FlowFooter } from '../../../components/onboarding/flow';
import ClientCodeModal from '../../../components/ClientCodeModal';
import ImportModal from '../../../components/ImportModal';
import { parseImportFile } from '../../../utils/importFile';

function finish(profile) {
  const { setProfile, finishOnboardingFlow } = useStore.getState();
  if (profile) setProfile(profile);
  finishOnboardingFlow();
}

const finishTrainer = () => finish({ role: 'trainer', proTabsHidden: false });
const finishClient  = () => finish({ role: 'coached', proTabsHidden: true });

function Recover({ goTo }) {
  const { t } = useTranslation();
  const importData = useStore((s) => s.importData);
  const [importState, setImportState] = useState(null);

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = parseImportFile(raw);
      if (!parsed.ok) {
        showDialog(t('common.error', 'Error'), t(parsed.errorKey, parsed.errorParams));
        return;
      }
      setImportState({ fileName: result.assets[0].name, parsedData: parsed.data });
    } catch (err) {
      if (!err?.message?.includes('cancel')) {
        showDialog(t('common.error', 'Error'), err?.message ?? t('errors.cannotReadFile'));
      }
    }
  }

  const opts = [
    ['trainer', () => goTo('r_trainer')],
    ['client', () => goTo('r_client')],
    ['backup', pickFile],
  ];

  return (
    <FlowBody>
      <FlowTitle text={t('onboardingFlow.recover.title')} sub={t('onboardingFlow.recover.sub')} />
      <View style={styles.opts}>
        {opts.map(([key, onPick], i) => (
          <FlowOption
            key={key}
            index={2 + i}
            chevron
            title={t(`onboardingFlow.recover.${key}`)}
            desc={t(`onboardingFlow.recover.${key}Desc`)}
            onPick={onPick}
          />
        ))}
      </View>
      <Rise index={5}><FlowNote tone="blue" text={t('onboardingFlow.recover.note')} /></Rise>

      {importState && (
        <ImportModal
          fileName={importState.fileName}
          parsedData={importState.parsedData}
          onImport={(data, sections) => { setImportState(null); importData(data, sections); finish(); }}
          onClose={() => setImportState(null)}
        />
      )}
    </FlowBody>
  );
}

// ── Cómo entrabas (cuenta de entrenador, §29.2) ───────────────────────────────

/** Los errores de entrar se quedan en la pantalla; en Expo Go Google y Apple no pueden. */
function useTrainerEntry() {
  const { t } = useTranslation();
  const [error, setError] = useState(null);
  const account = useTrainerAccount();
  /** Entra y termina; cancelar no es un error. */
  const enter = (run) => async () => {
    setError(null);
    try {
      await run();
      finishTrainer();
    } catch (err) {
      if (!err?.cancelled) setError(err?.message ?? t('sync.errGoogleBody'));
    }
  };
  const social = (run) => () => {
    if (account.isExpoGo) { setError(t('sync.onlyInstalled')); return; }
    enter(run)();
  };
  return { ...account, error, setError, enter, social };
}

function RecoverTrainer({ goTo }) {
  const { t } = useTranslation();
  const { signInWithGoogle: google, signInWithApple: apple, error, social } = useTrainerEntry();
  return (
    <FlowBody>
      <FlowTitle text={t('onboardingFlow.recover.rTrainer.title')} sub={t('onboardingFlow.recover.rTrainer.sub')} />
      <View style={styles.opts}>
        <FlowOption index={2} chevron title={t('onboardingFlow.recover.rTrainer.code')} desc={t('onboardingFlow.recover.rTrainer.codeDesc')} onPick={() => goTo('r_code')} />
        <FlowOption index={3} chevron title={t('onboardingFlow.recover.google')} onPick={social(google)} />
        {APPLE_AUTH_AVAILABLE && <FlowOption index={4} chevron title={t('onboardingFlow.recover.apple')} onPick={social(apple)} />}
      </View>
      {!!error && <Rise index={5}><FlowNote tone="warn" text={error} /></Rise>}
    </FlowBody>
  );
}

function RecoverCode() {
  const { t } = useTranslation();
  const { loading, recover, error, setError, enter: enterWith } = useTrainerEntry();
  const [code, setCode] = useState('');

  function enter() {
    if (!code.trim() || loading) return;
    enterWith(() => recover(code))();
  }

  return (
    <FlowBody
      footer={<FlowFooter primary={{ label: t('onboardingFlow.recover.rCode.enter'), onPress: enter, disabled: !code.trim() || loading }} />}
    >
      <FlowTitle text={t('onboardingFlow.recover.rCode.title')} sub={t('onboardingFlow.recover.rCode.sub')} />
      <Rise index={2}>
        <CodeField value={code} onChangeText={(v) => { setCode(v); setError(null); }} groups={3} onSubmitEditing={enter} error={error} />
      </Rise>
    </FlowBody>
  );
}

// ── Cómo te conectabas (entreno con entrenador, §29.2) ────────────────────────

function RecoverClient() {
  const { t } = useTranslation();
  // 'code' = hoja normal con su código · 'social' = busca la conexión hecha con Google/Apple.
  // Montada solo mientras se usa: al desmontarse limpia el estado compartido de `useClientCode`.
  const [open, setOpen] = useState(null);
  return (
    <FlowBody>
      <FlowTitle text={t('onboardingFlow.recover.rClient.title')} sub={t('onboardingFlow.recover.rClient.sub')} />
      <View style={styles.opts}>
        <FlowOption index={2} chevron title={t('onboardingFlow.recover.rClient.code')} onPick={() => setOpen('code')} />
        <FlowOption index={3} chevron title={t('onboardingFlow.recover.google')} onPick={() => setOpen('social')} />
        {APPLE_AUTH_AVAILABLE && <FlowOption index={4} chevron title={t('onboardingFlow.recover.apple')} onPick={() => setOpen('social')} />}
      </View>
      {open && (
        <ClientCodeModal visible startWithSocial={open === 'social'} onClose={() => setOpen(null)} onSuccess={finishClient} />
      )}
    </FlowBody>
  );
}

const styles = StyleSheet.create({
  opts: { gap: spacing.md },
});

export default { recover: Recover, r_trainer: RecoverTrainer, r_code: RecoverCode, r_client: RecoverClient };
