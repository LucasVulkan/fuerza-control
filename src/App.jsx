import './index.css';
import { useState, useEffect } from 'react';
import { useStore, selectView } from './store/useStore';
import { readFileAsText, parseImportFile } from './utils/storage';
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
import ArchivedProgramsView from './components/program/ArchivedProgramsView';
import ImportModal from './components/ui/ImportModal';

export default function App() {
  const view       = useStore(selectView);
  const importData = useStore((s) => s.importData);
  const showToast  = useStore((s) => s.showToast);
  const isOnboarding = view === 'onboarding';
  const isPrint      = view === 'programPrint';

  // { fileName, parsedData } — se pasa al ImportModal ya parseado
  const [importState, setImportState] = useState(null);

  // File Handling API — abre archivos desde el sistema de archivos
  useEffect(() => {
    if (!('launchQueue' in window)) return;
    window.launchQueue.setConsumer(async (launchParams) => {
      if (!launchParams.files?.length) return;
      try {
        const file = await launchParams.files[0].getFile();
        handleImportFile(file);
      } catch (e) {
        console.warn('launchQueue error:', e);
      }
    });
  }, []);

  async function handleImportFile(file) {
    try {
      const text = await readFileAsText(file);
      const result = parseImportFile(text);
      if (!result.ok) {
        showToast(`Error: ${result.error}`);
        return;
      }
      setImportState({ fileName: file.name, parsedData: result.data });
    } catch {
      showToast('No se pudo leer el archivo');
    }
  }

  async function handleImport(parsedData, sections) {
    setImportState(null);
    await importData(parsedData, sections);
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: isPrint ? 'none' : 480, margin: '0 auto' }}>
      {!isOnboarding && !isPrint && <AppHeader onImportFile={handleImportFile} />}

      {view === 'onboarding'     && <OnboardingView />}
      {view === 'programSummary' && <ProgramSummaryView />}
      {view === 'home'           && <HomeView />}
      {view === 'workout'        && <WorkoutView />}
      {view === 'history'        && <HistoryView />}
      {view === 'stats'          && <StatsView />}
      {view === 'programEditor'     && <ProgramEditorView />}
      {view === 'programPrint'      && <ProgramPrintView />}
      {view === 'archivedPrograms'  && <ArchivedProgramsView />}

      <Toast />
      {!isOnboarding && !isPrint && <RestTimerBar />}

      {importState && (
        <ImportModal
          fileName={importState.fileName}
          parsedData={importState.parsedData}
          onImport={handleImport}
          onClose={() => setImportState(null)}
        />
      )}
    </div>
  );
}
