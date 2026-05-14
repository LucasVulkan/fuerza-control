/**
 * App.jsx — Router de vistas y layout raíz.
 *
 * No usa React Router: la navegación es un campo `view` en el store.
 * Esto mantiene la app sin dependencias extra y compatible con la PWA offline.
 */

import './index.css';
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

export default function App() {
  const view = useStore(selectView);
  const isOnboarding = view === 'onboarding';
  const isPrint = view === 'programPrint';

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: isPrint ? 'none' : 480, margin: '0 auto' }}>
      {!isOnboarding && !isPrint && <AppHeader />}

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
    </div>
  );
}
