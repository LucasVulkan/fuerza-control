/**
 * ExternalImportModal — el diálogo de importación de un `.fitdata` abierto
 * desde fuera de la app (explorador de archivos, hoja de compartir).
 *
 * Vive UNA sola vez, colgado de `RootNavigator` junto al `<Toast />` y por la
 * misma razón: es global. Antes el efecto que reacciona a
 * `pendingExternalImport` estaba dentro de `AppHeader`, que va montado en seis
 * pantallas, y el Tab navigator mantiene vivas las pestañas ya visitadas. Todas
 * las instancias leían el mismo valor en el mismo commit —`clearPending…` no
 * cancela efectos ya encolados— así que cada una abría su propio modal: cerrabas
 * uno y aparecía otro debajo, tantos como pestañas hubieras visitado.
 * `OnboardingScreen` tenía además su propia copia del efecto, escrita porque
 * ahí `AppHeader` no está montado; con el modal aquí arriba ya no hace falta.
 *
 * Fallo 11 de `docs/specs/auditoria-tecnica.md`.
 *
 * El "importar" del menú (`handlePickFile` en `AppHeader`) NO se mueve: ese sí
 * es local a una interacción concreta del usuario.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import { parseImportFile } from '../utils/importFile';
import ImportModal from './ImportModal';
import { restoredMessage, restoreErrorMessage } from '../utils/restoreSummary';
import { useDisconnectFromTrainer } from '../hooks/useDisconnectFromTrainer';

import { showDialog } from './ui/dialog';
export default function ExternalImportModal() {
  const { t } = useTranslation();

  const pendingExternalImport      = useStore((s) => s.pendingExternalImport);
  const clearPendingExternalImport = useStore((s) => s.clearPendingExternalImport);
  const restoreBackup              = useStore((s) => s.restoreBackup);
  const showToast                  = useStore((s) => s.showToast);
  const navigate                   = useStore((s) => s.navigate);
  const { guardProgramChange }     = useDisconnectFromTrainer();

  const [importState, setImportState] = useState(null);

  useEffect(() => {
    if (!pendingExternalImport) return;
    const { rawContent, fileName } = pendingExternalImport;
    clearPendingExternalImport();
    const parsed = parseImportFile(rawContent);
    if (!parsed.ok) {
      showDialog(t('errors.invalidFile'), t(parsed.errorKey, parsed.errorParams));
      return;
    }
    setImportState({ fileName, parsedData: parsed.data });
  }, [pendingExternalImport]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleImport(parsedData, sections) {
    setImportState(null);
    const run = async () => {
      try {
        const result = await restoreBackup(parsedData, sections);   // el toast lo damos aquí
        showToast(restoredMessage(t, result, t('header.toastImported')), 2200, 'success');
        if (sections.program) navigate('home');
      } catch (err) {
        showToast(restoreErrorMessage(t, err), 3000, 'error');
      }
    };
    // Importar un programa es usar otro: con entrenador, antes se pregunta (R1,
    // E67). Nada se desconecta en silencio.
    if (sections.program) guardProgramChange(parsedData.program?.id, run); else run();
  }

  if (!importState) return null;

  return (
    <ImportModal
      fileName={importState.fileName}
      parsedData={importState.parsedData}
      onImport={handleImport}
      onClose={() => setImportState(null)}
    />
  );
}
