import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import OnboardingProgress from './OnboardingProgress';
import OnboardingStep from './OnboardingStep';
import OptionCard from './OptionCard';
import ImportModal from '../ui/ImportModal';

// ─── Datos estáticos (IDs) ────────────────────────────────────────────────────

const LEVEL_IDS   = ['beginner', 'intermediate', 'advanced'];
const DISC_IDS    = ['standard', 'calisthenics', 'glutes_legs', 'strength'];
const DIST_IDS    = ['full_body', 'upper_lower', 'push_pull_legs'];
const GOAL_IDS    = ['hypertrophy', 'endurance', 'strength', 'max_strength'];
const EQUIP_IDS   = ['machines', 'dumbbells', 'barbell', 'pullup_bar', 'parallettes', 'kettlebell', 'resistance_band', 'ab_wheel'];
const LIMIT_IDS   = ['none', 'shoulder', 'lower_back', 'knee'];
const PROG_IDS    = ['double_progression', 'linear', 'reps_progression'];

const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

const DIST_MIN_LEVEL = { full_body: 'beginner', upper_lower: 'intermediate', push_pull_legs: 'intermediate' };
const DIST_FOR = {
  full_body:       ['standard', 'calisthenics', 'glutes_legs', 'strength'],
  upper_lower:     ['standard', 'calisthenics', 'strength'],
  push_pull_legs:  ['standard', 'calisthenics', 'strength'],
};
const GOAL_MIN_LEVEL = { hypertrophy: 'beginner', endurance: 'beginner', strength: 'intermediate', max_strength: 'advanced' };

function goalIsAvailable(goalId, level) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[GOAL_MIN_LEVEL[goalId]];
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function OnboardingView() {
  const { t } = useTranslation();
  const generateAndActivateProgram = useStore((s) => s.generateAndActivateProgram);
  const createEmptyProgram = useStore((s) => s.createEmptyProgram);
  const importData = useStore((s) => s.importData);
  const navigate   = useStore((s) => s.navigate);

  const [mode, setMode] = useState(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [manualSessions, setManualSessions] = useState(3);
  const [manualName, setManualName] = useState('');
  const fileInputRef = useRef(null);
  const [answers, setAnswers] = useState({
    level: null,
    discipline: null,
    distribution: null,
    daysPerWeek: 3,
    goal: null,
    equipment: [],
    limitations: [],
    progressionModel: 'double_progression',
  });

  const totalSteps = answers.level === 'advanced' ? 8 : 7;

  function set_(field, value) {
    setAnswers((a) => ({ ...a, [field]: value }));
  }

  function toggleMulti(field, id) {
    setAnswers((a) => {
      const current = a[field];
      if (id === 'none') return { ...a, [field]: ['none'] };
      const without = current.filter((x) => x !== 'none');
      return {
        ...a,
        [field]: without.includes(id) ? without.filter((x) => x !== id) : [...without, id],
      };
    });
  }

  async function handleFinish() {
    setLoading(true);
    await generateAndActivateProgram(answers);
    setLoading(false);
  }

  function handleManualCreate() {
    createEmptyProgram(manualSessions, manualName || t('onboarding.programNamePlaceholder'));
  }

  async function handleImport(file, mode) {
    setImportFile(null);
    setLoading(true);
    await importData(file, mode);
    setLoading(false);
    navigate('home');
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportFile(file);
  }

  function nextStep() {
    if (step === 6 && answers.level !== 'advanced') {
      handleFinish();
      return;
    }
    if (step === totalSteps - 1) {
      handleFinish();
      return;
    }
    setStep((s) => s + 1);
  }

  function prevStep() { setStep((s) => Math.max(0, s - 1)); }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'var(--bg)',
      }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: 'var(--accent)', letterSpacing: 2 }}>
          {t('onboarding.generating')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('onboarding.buildingPlan')}</div>
      </div>
    );
  }

  // ── Pantalla de selección de modo ──────────────────────────────────────────
  if (mode === null) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', padding: '40px 20px 32px' }}>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />

        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--accent)', letterSpacing: 1, marginBottom: 8 }}>
          {t('onboarding.appName')}
        </div>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 1, lineHeight: 1.1, marginBottom: 8 }}>
          {t('onboarding.newProgram')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 32 }}>
          {t('onboarding.howToCreate')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          <ModeCard
            icon="🤖"
            title={t('onboarding.modeAuto')}
            desc={t('onboarding.modeAutoDesc')}
            onClick={() => setMode('auto')}
            accent
          />
          <ModeCard
            icon="✏️"
            title={t('onboarding.modeManual')}
            desc={t('onboarding.modeManualDesc')}
            onClick={() => setMode('manual')}
          />
          <ModeCard
            icon="📥"
            title={t('onboarding.modeImport')}
            desc={t('onboarding.modeImportDesc')}
            onClick={() => fileInputRef.current?.click()}
          />
        </div>

        {importFile && (
          <ImportModal file={importFile} onImport={handleImport} onClose={() => setImportFile(null)} />
        )}
      </div>
    );
  }

  // ── Modo manual ─────────────────────────────────────────────────────────────
  if (mode === 'manual') {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 20px 16px' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--accent)', letterSpacing: 1, marginBottom: 4 }}>
            {t('onboarding.appName')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1 }}>{t('onboarding.manualProgram')}</div>
        </div>

        <div style={{ flex: 1, padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              {t('onboarding.programName')}
            </div>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder={t('onboarding.programNamePlaceholder')}
              style={{
                width: '100%', background: 'var(--surface2)',
                border: 'var(--border-width) solid var(--border-card)', borderRadius: 8,
                color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
                fontSize: 14, padding: '10px 14px', outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              {t('onboarding.numberOfSessions')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setManualSessions(n)}
                  style={{
                    flex: 1, height: 56,
                    borderRadius: 8, border: 'var(--border-width) solid',
                    borderColor: manualSessions === n ? 'var(--accent)' : 'var(--border)',
                    background: manualSessions === n ? 'var(--accent-tint-active)' : 'var(--surface)',
                    color: manualSessions === n ? 'var(--accent)' : 'var(--text)',
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: 26,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
              {t('onboarding.addMoreFromEditor')}
            </p>
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, background: 'var(--surface)', borderRadius: 8, padding: '12px 14px', border: 'var(--border-width) solid var(--border-card)' }}>
            {t('onboarding.emptySessionsHint', { count: manualSessions })}
          </p>
        </div>

        <div style={{ padding: '12px 20px 28px', borderTop: 'var(--border-width) solid var(--border)', display: 'flex', gap: 10 }}>
          <button
            onClick={() => setMode(null)}
            style={{
              flex: 1, background: 'var(--surface)',
              border: 'var(--border-width) solid var(--border-card)', borderRadius: 10,
              color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
              fontSize: 13, padding: 13, cursor: 'pointer',
            }}
          >
            {t('common.back')}
          </button>
          <button
            onClick={handleManualCreate}
            disabled={!manualName.trim()}
            style={{
              flex: 2,
              background: manualName.trim() ? 'var(--accent)' : 'var(--surface2)',
              border: 'none', borderRadius: 10,
              color: manualName.trim() ? '#0d0d0d' : 'var(--muted)',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 20, letterSpacing: 1.5,
              padding: 13, cursor: manualName.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {t('onboarding.createAndEdit')}
          </button>
        </div>
      </div>
    );
  }

  // ── Modo automático ─────────────────────────────────────────────────────────
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />

      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--accent)', letterSpacing: 1, marginBottom: 12 }}>
          {t('onboarding.appName')}
        </div>
        <OnboardingProgress current={step + 1} total={totalSteps} />
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8, letterSpacing: 1 }}>
          {t('onboarding.stepIndicator', { current: step + 1, total: totalSteps })}
        </div>
      </div>

      {step === 0 && <StepLevel answers={answers} set_={set_} onNext={nextStep} />}
      {step === 1 && <StepDiscipline answers={answers} set_={set_} onNext={nextStep} onBack={prevStep} />}
      {step === 2 && <StepDistribution answers={answers} set_={set_} onNext={nextStep} onBack={prevStep} />}
      {step === 3 && <StepDays answers={answers} set_={set_} onNext={nextStep} onBack={prevStep} />}
      {step === 4 && <StepGoal answers={answers} set_={set_} onNext={nextStep} onBack={prevStep} />}
      {step === 5 && <StepEquipment answers={answers} toggleMulti={toggleMulti} onNext={nextStep} onBack={prevStep} />}
      {step === 6 && <StepLimitations answers={answers} toggleMulti={toggleMulti} onNext={nextStep} onBack={prevStep} isLast={answers.level !== 'advanced'} />}
      {step === 7 && answers.level === 'advanced' && <StepProgression answers={answers} set_={set_} onNext={nextStep} onBack={prevStep} isLast />}

      {importFile && (
        <ImportModal file={importFile} onImport={handleImport} onClose={() => setImportFile(null)} />
      )}
    </div>
  );
}

// ─── Pasos individuales ───────────────────────────────────────────────────────

function StepLevel({ answers, set_, onNext }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepLevel.title')}
      subtitle={t('onboarding.stepLevel.subtitle')}
      onNext={onNext}
      nextDisabled={!answers.level}
      showBack={false}
    >
      {LEVEL_IDS.map((id) => (
        <OptionCard
          key={id}
          id={id}
          label={t(`onboarding.levels.${id}.label`)}
          description={t(`onboarding.levels.${id}.description`)}
          detail={t(`onboarding.levels.${id}.detail`)}
          selected={answers.level === id}
          onClick={() => set_('level', id)}
        />
      ))}
    </OnboardingStep>
  );
}

function StepDiscipline({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepDiscipline.title')}
      subtitle={t('onboarding.stepDiscipline.subtitle')}
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!answers.discipline}
    >
      {DISC_IDS.map((id) => (
        <OptionCard
          key={id}
          id={id}
          label={t(`onboarding.disciplines.${id}.label`)}
          description={t(`onboarding.disciplines.${id}.description`)}
          detail={t(`onboarding.disciplines.${id}.detail`)}
          selected={answers.discipline === id}
          onClick={() => {
            set_('discipline', id);
            if (id === 'strength' && !answers.goal) set_('goal', 'strength');
            if (id === 'glutes_legs' && !answers.goal) set_('goal', 'hypertrophy');
            if (id === 'glutes_legs') set_('distribution', 'full_body');
          }}
        />
      ))}
    </OnboardingStep>
  );
}

function StepDistribution({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepDistribution.title')}
      subtitle={t('onboarding.stepDistribution.subtitle')}
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!answers.distribution}
    >
      {DIST_IDS.map((id) => {
        const levelOk     = LEVEL_ORDER[answers.level] >= LEVEL_ORDER[DIST_MIN_LEVEL[id]];
        const disciplineOk = DIST_FOR[id].includes(answers.discipline);
        const available    = levelOk && disciplineOk;
        const disabledReason = !disciplineOk
          ? t('onboarding.disabledReasons.notForDiscipline', { discipline: t(`onboarding.disciplines.${answers.discipline}.label`) })
          : !levelOk
          ? (DIST_MIN_LEVEL[id] === 'intermediate' ? t('onboarding.disabledReasons.requiresIntermediate') : t('onboarding.disabledReasons.requiresAdvanced'))
          : undefined;
        return (
          <OptionCard
            key={id}
            id={id}
            label={t(`onboarding.distributions.${id}.label`)}
            description={t(`onboarding.distributions.${id}.description`)}
            selected={answers.distribution === id}
            disabled={!available}
            disabledReason={disabledReason}
            onClick={() => available && set_('distribution', id)}
          />
        );
      })}
    </OnboardingStep>
  );
}

function StepDays({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();

  if (answers.distribution === 'upper_lower') {
    return (
      <OnboardingStep
        title={t('onboarding.stepDays.titleUpperLower')}
        subtitle={t('onboarding.stepDays.subtitleUpperLower')}
        onNext={onNext}
        onBack={onBack}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { n: 2, title: t('onboarding.upperLowerOptions.2sessions'), desc: t('onboarding.upperLowerOptions.2sessionsDesc') },
            { n: 4, title: t('onboarding.upperLowerOptions.4sessions'), desc: t('onboarding.upperLowerOptions.4sessionsDesc') },
          ].map(({ n, title, desc }) => (
            <div
              key={n}
              onClick={() => set_('daysPerWeek', n)}
              style={{
                background: 'var(--surface)', border: 'var(--border-width) solid',
                borderColor: answers.daysPerWeek === n ? 'var(--accent)' : 'var(--border)',
                borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 16,
              }}
            >
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: answers.daysPerWeek === n ? 'var(--accent)' : 'var(--muted)', lineHeight: 1 }}>{n}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            {t('onboarding.stepDays.ulCycleHint')}
          </p>
        </div>
      </OnboardingStep>
    );
  }

  if (answers.distribution === 'push_pull_legs') {
    if (answers.daysPerWeek !== 3) set_('daysPerWeek', 3);
    return (
      <OnboardingStep
        title={t('onboarding.stepDays.titlePPL')}
        subtitle={t('onboarding.stepDays.subtitlePPL')}
        onNext={onNext}
        onBack={onBack}
      >
        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            t('onboarding.pplSessions.push'),
            t('onboarding.pplSessions.pull'),
            t('onboarding.pplSessions.legs'),
          ].map((label, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: 'var(--border-width) solid var(--accent-tint-border)',
              borderRadius: 8, padding: '12px 16px',
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
            }}>
              {label}
            </div>
          ))}
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{t('onboarding.stepDays.pplCycleHint')}</p>
        </div>
      </OnboardingStep>
    );
  }

  // Full Body
  const availableDays = [2, 3, 4, 5, 6];
  const d = answers.daysPerWeek;
  const hint = d <= 2
    ? ' · ' + t('onboarding.stepDays.allGroupsHint')
    : d >= 4
    ? ' · ' + t('onboarding.stepDays.moreVarietyHint')
    : '';

  return (
    <OnboardingStep
      title={t('onboarding.stepDays.titleFullBody')}
      subtitle={t('onboarding.stepDays.subtitleFullBody')}
      onNext={onNext}
      onBack={onBack}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {availableDays.map((n) => (
          <button
            key={n}
            onClick={() => set_('daysPerWeek', n)}
            style={{
              width: 64, height: 64, borderRadius: 10, border: 'var(--border-width) solid',
              borderColor: answers.daysPerWeek === n ? 'var(--accent)' : 'var(--border)',
              background: answers.daysPerWeek === n ? 'var(--accent-tint-active)' : 'var(--surface)',
              color: answers.daysPerWeek === n ? 'var(--accent)' : 'var(--text)',
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 28,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
        {t('onboarding.stepDays.sessionsCount', { count: d })}{hint}
      </p>
    </OnboardingStep>
  );
}

function StepGoal({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepGoal.title')}
      subtitle={t('onboarding.stepGoal.subtitle')}
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!answers.goal}
    >
      {GOAL_IDS.map((id) => {
        const available = goalIsAvailable(id, answers.level);
        return (
          <OptionCard
            key={id}
            id={id}
            label={t(`onboarding.goals.${id}.label`)}
            description={t(`onboarding.goals.${id}.description`)}
            selected={answers.goal === id}
            disabled={!available}
            disabledReason={!available ? (GOAL_MIN_LEVEL[id] === 'intermediate' ? t('onboarding.disabledReasons.requiresIntermediate') : t('onboarding.disabledReasons.requiresAdvanced')) : undefined}
            onClick={() => available && set_('goal', id)}
          />
        );
      })}
    </OnboardingStep>
  );
}

function StepEquipment({ answers, toggleMulti, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepEquipment.title')}
      subtitle={t('onboarding.stepEquipment.subtitle')}
      onNext={onNext}
      onBack={onBack}
      nextDisabled={answers.equipment.length === 0}
    >
      {EQUIP_IDS.map((id) => (
        <OptionCard
          key={id}
          id={id}
          label={t(`onboarding.equipment.${id}.label`)}
          description={t(`onboarding.equipment.${id}.description`)}
          multi
          selected={answers.equipment.includes(id)}
          onClick={() => toggleMulti('equipment', id)}
        />
      ))}
    </OnboardingStep>
  );
}

function StepLimitations({ answers, toggleMulti, onNext, onBack, isLast }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepLimitations.title')}
      subtitle={t('onboarding.stepLimitations.subtitle')}
      onNext={onNext}
      onBack={onBack}
      nextDisabled={answers.limitations.length === 0}
      isLast={isLast}
    >
      {LIMIT_IDS.map((id) => (
        <OptionCard
          key={id}
          id={id}
          label={t(`onboarding.limitations.${id}.label`)}
          description={t(`onboarding.limitations.${id}.description`)}
          multi
          selected={answers.limitations.includes(id)}
          onClick={() => toggleMulti('limitations', id)}
        />
      ))}
    </OnboardingStep>
  );
}

function StepProgression({ answers, set_, onNext, onBack, isLast }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepProgression.title')}
      subtitle={t('onboarding.stepProgression.subtitle')}
      onNext={onNext}
      onBack={onBack}
      isLast={isLast}
    >
      {PROG_IDS.map((id) => (
        <OptionCard
          key={id}
          id={id}
          label={t(`onboarding.progressionModels.${id}.label`)}
          description={t(`onboarding.progressionModels.${id}.description`)}
          selected={answers.progressionModel === id}
          onClick={() => set_('progressionModel', id)}
        />
      ))}
    </OnboardingStep>
  );
}

function ModeCard({ icon, title, desc, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: accent ? 'var(--accent-tint)' : 'var(--surface)',
        border: 'var(--border-width) solid',
        borderColor: accent ? 'var(--accent-tint-border)' : 'var(--border)',
        borderRadius: 12, padding: '18px 20px', cursor: 'pointer',
        textAlign: 'left', width: '100%',
        display: 'flex', alignItems: 'center', gap: 16,
        transition: 'background 0.15s',
      }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = accent ? 'var(--accent-tint)' : 'var(--surface)'}
      onPointerLeave={(e) => e.currentTarget.style.background = accent ? 'var(--accent-tint)' : 'var(--surface)'}
    >
      <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{
          fontSize: 14, fontWeight: 500,
          color: accent ? 'var(--accent)' : 'var(--text)',
          fontFamily: "'DM Sans', sans-serif", marginBottom: 3,
        }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</div>
      </div>
      <span style={{ color: 'var(--muted)', fontSize: 18, marginLeft: 'auto', flexShrink: 0 }}>›</span>
    </button>
  );
}
