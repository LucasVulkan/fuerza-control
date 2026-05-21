import { useStore } from '../store/useStore';

export function useExerciseName() {
  const language = useStore((s) => s.profile.language);
  return (def) => {
    if (!def) return '';
    return language === 'en' ? (def.nameEn ?? def.name) : def.name;
  };
}
