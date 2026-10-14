/**
 * Importar una copia de seguridad `.fitdata` desde el onboarding: el selector de
 * archivos y el `ImportModal` que deja elegir qué secciones traer. Sale de
 * `OnboardingScreen` (`handlePickFile` + `handleImport`, ya borrada) y lo usan el
 * camino «por mi cuenta» (O03-04) y «Nuevo programa» (O03-11).
 *
 *   const { pickFile, modal } = useFitdataImport((data, sections) => { … });
 *
 * `pickFile` abre el selector; `modal` es el elemento que hay que pintar (nada
 * mientras no hay archivo). `onImport` corre al confirmar, con el modal ya cerrado.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import ImportModal from '../ImportModal';
import { showDialog } from '../ui/dialog';
import { parseImportFile } from '../../utils/importFile';

export default function useFitdataImport(onImport) {
  const { t } = useTranslation();
  const [importState, setImportState] = useState(null);

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const raw    = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
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

  const modal = importState && (
    <ImportModal
      fileName={importState.fileName}
      parsedData={importState.parsedData}
      onImport={(parsedData, sections) => { setImportState(null); onImport(parsedData, sections); }}
      onClose={() => setImportState(null)}
    />
  );

  return { pickFile, modal };
}
