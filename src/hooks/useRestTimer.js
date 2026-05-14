import { useStore, selectRestTimer } from '../store/useStore';

export function useRestTimer() {
  const restTimer = useStore(selectRestTimer);
  const stopRestTimer = useStore((s) => s.stopRestTimer);
  const { active, remaining, total, exerciseName } = restTimer;
  const CIRCUMFERENCE = 113.1;
  const strokeDashoffset = total > 0 ? CIRCUMFERENCE * (remaining / total) : 0;
  return { active, remaining, total, exerciseName, strokeDashoffset, CIRCUMFERENCE, skip: stopRestTimer };
}
