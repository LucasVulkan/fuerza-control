/**
 * «Ya tengo cuenta» del recorrido de entrada (O03-07, spec §12, §23): «Recupera
 * lo tuyo». Tres entradas que abren lo que la app ya tiene:
 *
 *   · cuenta de entrenador → `TrainerSyncModal` en su pantalla de recuperar
 *   · entreno con entrenador → `ClientCodeModal` con `startWithSocial`
 *   · copia de seguridad → selector de archivo + `ImportModal`
 *
 * Si la recuperación sale bien se marca el onboarding como hecho y se va a la
 * app; si se cancela, se queda aquí.
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
import { FlowBody, FlowTitle, FlowOption, FlowNote } from '../../../components/onboarding/flow';
import TrainerSyncModal from '../../../components/TrainerSyncModal';
import ClientCodeModal from '../../../components/ClientCodeModal';
import ImportModal from '../../../components/ImportModal';
import { parseImportFile } from '../../../utils/importFile';

/** Lo que cambia cuando una cuenta de entrenador se recupera (la modal solo avisa con `onClose`). */
const syncKey = () => {
  const s = useStore.getState().trainerSync;
  return `${s.mode}|${s.code}|${s.userId}`;
};

function Recover() {
  const { t } = useTranslation();
  const importData = useStore((s) => s.importData);
  const [open, setOpen] = useState(null);   // 'trainer' | 'client' | null
  const [importState, setImportState] = useState(null);
  const [before, setBefore] = useState(null);

  function finish(profile) {
    const { setProfile, finishOnboardingFlow } = useStore.getState();
    if (profile) setProfile(profile);
    finishOnboardingFlow();
  }

  function openTrainer() { setBefore(syncKey()); setOpen('trainer'); }

  function closeTrainer() {
    setOpen(null);
    const s = useStore.getState().trainerSync;
    if (s.mode && s.mode !== 'offline' && syncKey() !== before) finish({ role: 'trainer', proTabsHidden: false });
  }

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
    ['trainer', openTrainer],
    ['client', () => setOpen('client')],
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

      <TrainerSyncModal visible={open === 'trainer'} onClose={closeTrainer} initialScreen="recovery" />
      <ClientCodeModal
        visible={open === 'client'}
        startWithSocial
        onClose={() => setOpen(null)}
        onSuccess={() => finish({ role: 'coached', proTabsHidden: true })}
      />
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

const styles = StyleSheet.create({
  opts: { gap: spacing.md },
});

export default { recover: Recover };
