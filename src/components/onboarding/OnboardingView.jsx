import { useState } from 'react';
import { useStore } from '../../store/useStore';
import OnboardingProgress from './OnboardingProgress';
import OnboardingStep from './OnboardingStep';
import OptionCard from './OptionCard';

// ─── Definición de pasos ──────────────────────────────────────────────────────

const TOTAL_STEPS = 7; // +1 si advanced (modelo de progresión)

const LEVELS = [
  {
    id: 'beginner',
    label: 'Principiante',
    description: 'Menos de 1 año entrenando o volviendo tras una pausa larga.',
    detail: 'Ejercicios guiados por máquina, patrones básicos con peso corporal y mancuernas. Progresión sencilla y segura.',
  },
  {
    id: 'intermediate',
    label: 'Intermedio',
    description: '1–3 años entrenando con continuidad.',
    detail: 'Mancuernas, cables, kettlebell y ejercicios de peso corporal técnicos como dominadas o fondos. Doble progresión.',
  },
  {
    id: 'advanced',
    label: 'Avanzado',
    description: 'Más de 3 años con técnica sólida en movimientos libres.',
    detail: 'Barra libre, ejercicios lastrados, periodización. Requiere buena técnica en sentadilla, peso muerto y press.',
  },
];

const DISCIPLINES = [
  {
    id: 'standard',
    label: 'Estándar',
    description: 'Hipertrofia y fuerza general. El enfoque más completo y versátil.',
    detail: 'Cubre todos los patrones de movimiento con los mejores ejercicios para cada objetivo.',
  },
  {
    id: 'calisthenics',
    label: 'Calistenia / Funcional',
    description: 'Peso corporal, agarre y core. Con transferencia a deporte y disciplinas aéreas.',
    detail: 'Dominadas, fondos, L-sit, hollow body. Fuerza relativa y control corporal.',
  },
  {
    id: 'glutes_legs',
    label: 'Pierna & Glúteo',
    description: 'Máximo énfasis en glúteo, isquios y pierna. Popular en programas femeninos.',
    detail: 'Hip thrust, peso muerto rumano, prensa y variantes de sentadilla como ejercicios centrales.',
  },
  {
    id: 'strength',
    label: 'Fuerza / Powerlifting',
    description: 'Mover más peso. Sentadilla, peso muerto y press como eje central.',
    detail: 'Rangos de 3–6 reps, descansos largos y progresión de carga como prioridad.',
  },
];

const DISTRIBUTIONS = [
  {
    id: 'full_body',
    label: 'Full Body',
    description: 'Todos los grupos musculares en cada sesión. 2–6 días.',
    minLevel: 'beginner',
    availableFor: ['standard', 'calisthenics', 'glutes_legs', 'strength'],
  },
  {
    id: 'upper_lower',
    label: 'Upper / Lower',
    description: 'Tren superior un día, inferior otro. 2 sesiones distintas.',
    minLevel: 'intermediate',
    availableFor: ['standard', 'calisthenics', 'strength'],
  },
  {
    id: 'push_pull_legs',
    label: 'Push / Pull / Legs',
    description: 'Un día de empuje, uno de tracción, uno de pierna. 3 sesiones.',
    minLevel: 'intermediate',
    availableFor: ['standard', 'calisthenics', 'strength'],
  },
];

const GOALS = [
  { id: 'hypertrophy',  label: 'Hipertrofia',    description: 'Aumentar masa muscular. 8–12 reps por serie.',       minLevel: 'beginner' },
  { id: 'endurance',    label: 'Resistencia',     description: 'Aguantar más. 12–20 reps, descansos cortos.',        minLevel: 'beginner' },
  { id: 'strength',     label: 'Fuerza',          description: 'Mover más peso. 5–8 reps, descansos largos.',        minLevel: 'intermediate' },
  { id: 'max_strength', label: 'Fuerza máxima',   description: 'Máximo rendimiento. 3–5 reps, solo avanzado.',       minLevel: 'advanced' },
];

const EQUIPMENT_OPTIONS = [
  { id: 'machines',        label: 'Máquinas',           description: 'Prensa, polea, curl, extensión...' },
  { id: 'dumbbells',       label: 'Mancuernas',          description: 'Ajustables o fijas.' },
  { id: 'barbell',         label: 'Barra libre',         description: 'Barra olímpica con discos.' },
  { id: 'pullup_bar',      label: 'Barra de dominadas',  description: 'Fija o de puerta.' },
  { id: 'parallettes',     label: 'Paralelas / Dip bar', description: 'Para fondos y L-sit.' },
  { id: 'kettlebell',      label: 'Kettlebell',          description: 'Una o varias.' },
  { id: 'resistance_band', label: 'Bandas elásticas',    description: 'Para asistencia o activación.' },
  { id: 'ab_wheel',        label: 'Rueda abdominal',     description: 'Ab wheel rollout.' },
];

const LIMITATIONS = [
  { id: 'none',        label: 'Sin limitaciones',   description: 'Puedo hacer cualquier ejercicio sin restricciones.' },
  { id: 'shoulder',    label: 'Hombro / Trapecio',  description: 'Molestias en hombro, manguito rotador o trapecio.' },
  { id: 'lower_back',  label: 'Zona lumbar',         description: 'Problemas en la zona baja de la espalda.' },
  { id: 'knee',        label: 'Rodilla',             description: 'Molestias en rodilla o menisco.' },
];

const PROGRESSION_MODELS = [
  { id: 'double_progression', label: 'Doble progresión',    description: 'Llegas al máximo de reps → subes peso → vuelves al mínimo. El más habitual.' },
  { id: 'linear',             label: 'Progresión lineal',   description: 'Subes peso fijo cada sesión. Clásico en programas de fuerza como Starting Strength.' },
  { id: 'reps_progression',   label: 'Por repeticiones',   description: 'El peso no cambia, solo subes reps cada sesión.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

function goalIsAvailable(goal, level) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[goal.minLevel];
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function OnboardingView() {
  const generateAndActivateProgram = useStore((s) => s.generateAndActivateProgram);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
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
          GENERANDO PROGRAMA
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Construyendo tu plan personalizado...</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--accent)', letterSpacing: 1, marginBottom: 12 }}>
          FUERZA & CONTROL
        </div>
        <OnboardingProgress current={step + 1} total={totalSteps} />
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8, letterSpacing: 1 }}>
          PASO {step + 1} DE {totalSteps}
        </div>
      </div>

      {/* Pasos */}
      {step === 0 && (
        <StepLevel answers={answers} set_={set_} onNext={nextStep} />
      )}
      {step === 1 && (
        <StepDiscipline answers={answers} set_={set_} onNext={nextStep} onBack={prevStep} />
      )}
      {step === 2 && (
        <StepDistribution answers={answers} set_={set_} onNext={nextStep} onBack={prevStep} />
      )}
      {step === 3 && (
        <StepDays answers={answers} set_={set_} onNext={nextStep} onBack={prevStep} />
      )}
      {step === 4 && (
        <StepGoal answers={answers} set_={set_} onNext={nextStep} onBack={prevStep} />
      )}
      {step === 5 && (
        <StepEquipment answers={answers} toggleMulti={toggleMulti} onNext={nextStep} onBack={prevStep} />
      )}
      {step === 6 && (
        <StepLimitations answers={answers} toggleMulti={toggleMulti} onNext={nextStep} onBack={prevStep} isLast={answers.level !== 'advanced'} />
      )}
      {step === 7 && answers.level === 'advanced' && (
        <StepProgression answers={answers} set_={set_} onNext={nextStep} onBack={prevStep} isLast />
      )}
    </div>
  );
}

// ─── Pasos individuales ───────────────────────────────────────────────────────

function StepLevel({ answers, set_, onNext }) {
  return (
    <OnboardingStep
      title="¿Cuál es tu nivel?"
      subtitle="Esto determina qué ejercicios y estructuras se incluirán en tu programa."
      onNext={onNext}
      nextDisabled={!answers.level}
      showBack={false}
    >
      {LEVELS.map((l) => (
        <OptionCard
          key={l.id}
          {...l}
          selected={answers.level === l.id}
          onClick={() => set_('level', l.id)}
        />
      ))}
    </OnboardingStep>
  );
}

function StepDiscipline({ answers, set_, onNext, onBack }) {
  return (
    <OnboardingStep
      title="¿Cuál es tu enfoque?"
      subtitle="Define qué tipo de entrenamiento y ejercicios quieres priorizar."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!answers.discipline}
    >
      {DISCIPLINES.map((d) => (
        <OptionCard
          key={d.id}
          {...d}
          selected={answers.discipline === d.id}
          onClick={() => {
            set_('discipline', d.id);
            // Pre-seleccionar goal según disciplina
            if (d.id === 'strength' && !answers.goal) set_('goal', 'strength');
            if (d.id === 'glutes_legs' && !answers.goal) set_('goal', 'hypertrophy');
            // Resetear distribución si no es compatible
            if (d.id === 'glutes_legs') set_('distribution', 'full_body');
          }}
        />
      ))}
    </OnboardingStep>
  );
}

function StepDistribution({ answers, set_, onNext, onBack }) {
  return (
    <OnboardingStep
      title="¿Cómo distribuyes los días?"
      subtitle="La distribución define la estructura de cada sesión."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!answers.distribution}
    >
      {DISTRIBUTIONS.map((d) => {
        const levelOk = LEVEL_ORDER[answers.level] >= LEVEL_ORDER[d.minLevel];
        const disciplineOk = d.availableFor.includes(answers.discipline);
        const available = levelOk && disciplineOk;
        const disabledReason = !disciplineOk
          ? `No disponible para ${answers.discipline === 'glutes_legs' ? 'Pierna & Glúteo' : answers.discipline}`
          : !levelOk
          ? `Requiere nivel ${d.minLevel === 'intermediate' ? 'intermedio' : 'avanzado'}`
          : undefined;
        return (
          <OptionCard
            key={d.id}
            {...d}
            selected={answers.distribution === d.id}
            disabled={!available}
            disabledReason={disabledReason}
            onClick={() => available && set_('distribution', d.id)}
          />
        );
      })}
    </OnboardingStep>
  );
}

function StepDays({ answers, set_, onNext, onBack }) {
  if (answers.distribution === 'upper_lower') {
    return (
      <OnboardingStep
        title="Sesiones por ciclo"
        subtitle="Upper/Lower tiene 2 o 4 sesiones distintas. Puedes repetirlas con la frecuencia que quieras."
        onNext={onNext}
        onBack={onBack}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { n: 2, title: '2 sesiones', desc: 'A (superior) + B (inferior). Más sencillo, repite el ciclo.' },
            { n: 4, title: '4 sesiones', desc: 'A + B + A\' + B\'. Más variedad de ejercicios por ciclo.' },
          ].map(({ n, title, desc }) => (
            <div
              key={n}
              onClick={() => set_('daysPerWeek', n)}
              style={{
                background: 'var(--surface)',
                border: '1px solid',
                borderColor: answers.daysPerWeek === n ? 'var(--accent)' : 'var(--border)',
                borderRadius: 10,
                padding: '14px 18px',
                cursor: 'pointer',
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
            Puedes hacer 2 sesiones a la semana con 4 sesiones distintas — simplemente alternas el ciclo.
          </p>
        </div>
      </OnboardingStep>
    );
  }

  if (answers.distribution === 'push_pull_legs') {
    if (answers.daysPerWeek !== 3) set_('daysPerWeek', 3);
    return (
      <OnboardingStep
        title="Sesiones por ciclo"
        subtitle="Push/Pull/Legs usa 3 sesiones distintas. Puedes repetir el ciclo con la frecuencia que quieras."
        onNext={onNext}
        onBack={onBack}
      >
        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Sesión A — Empuje', 'Sesión B — Tracción', 'Sesión C — Pierna'].map((label, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid rgba(232,255,71,0.2)',
              borderRadius: 8, padding: '12px 16px',
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
            }}>
              {label}
            </div>
          ))}
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Alterna A → B → C → A → B → C a tu ritmo</p>
        </div>
      </OnboardingStep>
    );
  }

  // Full Body
  const availableDays = [2, 3, 4, 5, 6];
  return (
    <OnboardingStep
      title="¿Cuántas sesiones?"
      subtitle="Número de sesiones distintas por ciclo. A más sesiones, más variedad de ejercicios y patrones cubiertos."
      onNext={onNext}
      onBack={onBack}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {availableDays.map((d) => (
          <button
            key={d}
            onClick={() => set_('daysPerWeek', d)}
            style={{
              width: 64, height: 64,
              borderRadius: 10,
              border: '1px solid',
              borderColor: answers.daysPerWeek === d ? 'var(--accent)' : 'var(--border)',
              background: answers.daysPerWeek === d ? 'rgba(232,255,71,0.08)' : 'var(--surface)',
              color: answers.daysPerWeek === d ? 'var(--accent)' : 'var(--text)',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 28,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {d}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
        {answers.daysPerWeek} sesión{answers.daysPerWeek !== 1 ? 'es' : ''} por ciclo
        {answers.daysPerWeek <= 2 && ' · Todos los grupos en cada sesión'}
        {answers.daysPerWeek >= 4 && ' · Mayor variedad de ejercicios y patrones'}
      </p>
    </OnboardingStep>
  );
}

function StepGoal({ answers, set_, onNext, onBack }) {
  return (
    <OnboardingStep
      title="¿Cuál es tu objetivo?"
      subtitle="Determina el rango de repeticiones y el descanso entre series."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!answers.goal}
    >
      {GOALS.map((g) => {
        const available = goalIsAvailable(g, answers.level);
        return (
          <OptionCard
            key={g.id}
            {...g}
            selected={answers.goal === g.id}
            disabled={!available}
            disabledReason={!available ? `Requiere nivel ${g.minLevel === 'intermediate' ? 'intermedio' : 'avanzado'}` : undefined}
            onClick={() => available && set_('goal', g.id)}
          />
        );
      })}
    </OnboardingStep>
  );
}

function StepEquipment({ answers, toggleMulti, onNext, onBack }) {
  return (
    <OnboardingStep
      title="¿Qué equipo tienes?"
      subtitle="Selecciona todo lo que tienes disponible habitualmente."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={answers.equipment.length === 0}
    >
      {EQUIPMENT_OPTIONS.map((e) => (
        <OptionCard
          key={e.id}
          {...e}
          multi
          selected={answers.equipment.includes(e.id)}
          onClick={() => toggleMulti('equipment', e.id)}
        />
      ))}
    </OnboardingStep>
  );
}

function StepLimitations({ answers, toggleMulti, onNext, onBack, isLast }) {
  return (
    <OnboardingStep
      title="¿Tienes alguna limitación?"
      subtitle="Se evitarán ejercicios que puedan agravar estas zonas como ejercicio principal."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={answers.limitations.length === 0}
      isLast={isLast}
    >
      {LIMITATIONS.map((l) => (
        <OptionCard
          key={l.id}
          {...l}
          multi
          selected={answers.limitations.includes(l.id)}
          onClick={() => toggleMulti('limitations', l.id)}
        />
      ))}
    </OnboardingStep>
  );
}

function StepProgression({ answers, set_, onNext, onBack, isLast }) {
  return (
    <OnboardingStep
      title="Modelo de progresión"
      subtitle="Solo para avanzados. ¿Cómo prefieres progresar en los ejercicios principales?"
      onNext={onNext}
      onBack={onBack}
      isLast={isLast}
    >
      {PROGRESSION_MODELS.map((p) => (
        <OptionCard
          key={p.id}
          {...p}
          selected={answers.progressionModel === p.id}
          onClick={() => set_('progressionModel', p.id)}
        />
      ))}
    </OnboardingStep>
  );
}
