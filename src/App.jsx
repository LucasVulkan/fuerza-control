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
  const view       = useStore(selectView);
  const importData = useStore((s) => s.importData);
  const isOnboarding = view === 'onboarding';
  const isPrint      = view === 'programPrint';

  const [importFile, setImportFile] = useState(null);

  // File Handling API — abre archivos .fcdata desde el sistema de archivos
  useEffect(() => {
    if (!('launchQueue' in window)) return;
    window.launchQueue.setConsumer(async (launchParams) => {
      if (!launchParams.files?.length) return;
      try {
        const file = await launchParams.files[0].getFile();
        setImportFile(file);
      } catch (e) {
        console.warn('launchQueue error:', e);
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
