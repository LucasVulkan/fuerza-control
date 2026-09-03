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
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import { parseImportFile } from '../utils/importFile';
import ImportModal from './ImportModal';

export default function ExternalImportModal() {
  const { t } = useTranslation();

  const pendingExternalImport      = useStore((s) => s.pendingExternalImport);
  const clearPendingExternalImport = useStore((s) => s.clearPendingExternalImport);
  const importData                 = useStore((s) => s.importData);
  const showToast                  = useStore((s) => s.showToast);
  const navigate                   = useStore((s) => s.navigate);
  const onboardingCompleted        = useStore((s) => s.profile?.onboardingCompleted);
  const clientSlotId               = useStore((s) => s.clientSync?.slotId);
  const unlinkFromTrainer          = useStore((s) => s.unlinkFromTrainer);

  const [importState, setImportState] = useState(null);

  useEffect(() => {
    if (!pendingExternalImport) return;
    const { rawContent, fileName } = pendingExternalImport;
    clearPendingExternalImport();
    const parsed = parseImportFile(rawContent);
    if (!parsed.ok) {
      Alert.alert(t('errors.invalidFile'), t(parsed.errorKey, parsed.errorParams));
      return;
    }
    setImportState({ fileName, parsedData: parsed.data });
  }, [pendingExternalImport]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleImport(parsedData, sections) {
    setImportState(null);
    importData(parsedData, sections, { silent: true });   // el toast lo damos aquí
    showToast(t('header.toastImported'), 2200, 'success');

    // Qué pasa después lo decide el ESTADO, no qué pantalla montó el modal —
    // que es lo que antes obligaba a tener dos copias del manejador.
    //
    // Sin onboarding terminado, importar un programa es exactamente lo que el
    // onboarding venía a hacer: se cierra. Y si además había un entrenador
    // vinculado, se suelta conservando el programa recién importado, igual que
    // hacía el `finish()` de `OnboardingScreen`.
    if (sections.program && !onboardingCompleted && clientSlotId) {
      unlinkFromTrainer({ keepProgram: true }).catch(() => {});
    }
    if (sections.program) navigate('home');
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
