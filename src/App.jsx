/**
 * App.jsx — Router de vistas y layout raíz.
 *
 * No usa React Router: la navegación es un campo `view` en el store.
 * Esto mantiene la app sin dependencias extra y compatible con la PWA offline.
 */

import './index.css';
import { useEffect, useState } from 'react';
import { useStore, selectView } from './store/useStore';
import AppHeader from './components/ui/AppHeader';
import Toast from './components/ui/Toast';
import RestTimerBar from './components/ui/RestTimerBar';
import HomeView from './components/home/HomeView';
import WorkoutView from './components/workout/WorkoutView';
import HistoryView from './components/history/HistoryView';
import StatsView from './components/stats/StatsView';
import ProgramEditorView from './components/editor/ProgramEditorView';
import OnboardingView from './components/onboarding/OnboardingView';
import ProgramSummaryView from './components/onboarding/ProgramSummaryView';
import ProgramPrintView from './components/program/ProgramPrintView';
import ImportModal from './components/ui/ImportModal';

export default function App() {
  const view       = useStore(selectView);
  const profile    = useStore((s) => s.profile);
  const importData = useStore((s) => s.importData);

  const isOnboarding = view === 'onboarding';
  const isPrint      = view === 'programPrint';

  // Estado global del modal de importación — compartido por AppHeader y Launch Handler
  const [importFile, setImportFile] = useState(null);

  // Aplicar theme guardado al montar
  useEffect(() => {
    const theme = profile.theme ?? 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  // Launch Handler API — abre el modal cuando el usuario toca un .json desde el gestor
  useEffect(() => {
    if (!('launchQueue' in window)) return;
    window.launchQueue.setConsumer(async (launchParams) => {
      const [fileHandle] = launchParams.files;
      if (!fileHandle) return;
      try {
        const file = await fileHandle.getFile();
        if (!file.name.endsWith('.json')) return;
        setImportFile(file); // abre el mismo modal que el menú
      } catch (e) {
        console.error('Error al abrir archivo:', e);
      }
    });
  }, []);

  async function handleImport(file, mode) {
    setImportFile(null);
    await importData(file, mode);
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: isPrint ? 'none' : 480, margin: '0 auto' }}>
      {!isOnboarding && !isPrint && <AppHeader onImportFile={setImportFile} />}

      {view === 'onboarding'     && <OnboardingView />}
      {view === 'programSummary' && <ProgramSummaryView />}
      {view === 'home'           && <HomeView />}
      {view === 'workout'        && <WorkoutView />}
      {view === 'history'        && <HistoryView />}
      {view === 'stats'          && <StatsView />}
      {view === 'programEditor'  && <ProgramEditorView />}
      {view === 'programPrint'   && <ProgramPrintView />}

      <Toast />
      {!isOnboarding && !isPrint && <RestTimerBar />}

      {/* Modal de importación — compartido por menú y Launch Handler */}
      {importFile && (
        <ImportModal
          file={importFile}
          onImport={handleImport}
          onClose={() => setImportFile(null)}
        />
      )}
    </div>
  );
}
