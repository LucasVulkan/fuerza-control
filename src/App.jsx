import './index.css';
import { useState, useEffect } from 'react';
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
  const view        = useStore(selectView);
  const importData  = useStore((s) => s.importData);
  const isOnboarding = view === 'onboarding';
  const isPrint      = view === 'programPrint';

  const [importFile, setImportFile] = useState(null);

  // File Handling API — procesa archivos .json abiertos desde el sistema
  useEffect(() => {
    if (!('launchQueue' in window)) return;
    window.launchQueue.setConsumer(async (launchParams) => {
      if (!launchParams.files?.length) return;
      try {
        const fileHandle = launchParams.files[0];
        const file = await fileHandle.getFile();
        setImportFile(file);
      } catch (e) {
        console.warn('Error al leer archivo de lanzamiento:', e);
      }
    });
  }, []);

  async function handleImportFile(file, mode) {
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

      {/* Modal de importación global — se activa desde AppHeader o al abrir un .json */}
      {importFile && (
        <ImportModal
          file={importFile}
          onImport={handleImportFile}
          onClose={() => setImportFile(null)}
        />
      )}
    </div>
  );
}
