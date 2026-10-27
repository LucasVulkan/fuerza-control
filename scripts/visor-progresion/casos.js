// Casos del visor de progresión (replanteo del motor, 27-oct-2026).
// Cada sesión dice lo que HIZO el atleta. Sin `peso`, usa el que le propuso la app
// (el gris); `reps: 'gris'` = hizo justo lo que pedía el gris.
//   dias: días desde la sesión anterior (para ver huecos largos).
//   nota: qué pasa ese día, en palabras.

const doble = (sets, min, max, extra = {}) => ({
  sets, minReps: min, maxReps: max, progression: { type: 'double', ...extra },
});

export const CASOS = [
  {
    id: 'ana', nombre: 'Ana · empieza y no quiere complicarse',
    perfil: '2-3 días por semana, máquinas. Sigue lo que le dice la app, sin RPE.',
    ejercicio: 'chest_press_machine', config: doble(3, 10, 12), pesoInicial: 30,
    sesiones: [
      { reps: [10, 10, 10], nota: 'Primera sesión: busca su peso y se queda en 30 kg' },
      { reps: [11, 10, 10] },
      { reps: [12, 11, 10] },
      { reps: [12, 12, 11] },
      { reps: [12, 12, 12], nota: 'Llega arriba del rango en las tres' },
      { reps: [10, 9, 9], nota: 'Primer día con el peso nuevo: falla por poco' },
      { reps: [11, 10, 10] },
      { reps: [11, 10, 10], dias: 9, nota: 'Se salta una semana' },
      { reps: [11, 11, 10], nota: 'Tres sesiones casi igual: se ha atascado' },
      { reps: [12, 12, 12] },
    ],
  },
  {
    id: 'luis', nombre: 'Luis · entrena cuando puede',
    perfil: '1-2 días por semana; a veces desaparece un mes.',
    ejercicio: 'leg_press_standard', config: doble(3, 10, 12), pesoInicial: 100,
    sesiones: [
      { reps: [12, 11, 11] },
      { reps: [12, 12, 12], dias: 7 },
      { reps: [11, 10, 10], dias: 4 },
      { reps: [12, 12, 12], dias: 10 },
      { reps: [9, 8, 7], dias: 31, nota: 'Vuelve tras un mes sin entrenar, con el peso que le pidió la app' },
      { reps: 'gris', dias: 5 },
      { reps: 'gris', dias: 6 },
    ],
  },
  {
    id: 'marta', nombre: 'Marta · hipertrofia comprometida, sin RPE',
    perfil: '4-5 días, torso/pierna. Quiere progresar rápido. Elevaciones laterales 3×12-15 (escalón 1,25).',
    ejercicio: 'lateral_raise_db', config: doble(3, 12, 15), pesoInicial: 8,
    sesiones: [
      { reps: [15, 15, 13], nota: 'Dos series arriba y la última no' },
      { reps: [15, 15, 14] },
      { reps: [15, 15, 15] },
      { reps: [13, 12, 11], nota: 'Peso nuevo: la última se queda a una rep del mínimo' },
      { reps: [14, 13, 12] },
      { reps: [14, 13, 12], nota: 'Estancada: tres sesiones casi iguales' },
      { reps: [14, 13, 13] },
      { reps: [10, 9, 9], nota: 'Día malo (durmió poco)' },
      { reps: [14, 14, 13] },
    ],
  },
  {
    id: 'marta-parcial', nombre: 'Marta · lo mismo con «Parcial 2 de 3»',
    perfil: 'Misma situación, pero el entrenador le pone que basta con que 2 de 3 series lleguen arriba.',
    ejercicio: 'lateral_raise_db', config: doble(3, 12, 15, { evaluation: { mode: 'part', need: 2 } }), pesoInicial: 8,
    sesiones: [
      { reps: [15, 15, 13] },
      { reps: [13, 12, 11] },
      { reps: [15, 14, 12] },
      { reps: [15, 15, 11] },
      { reps: [12, 11, 10] },
    ],
  },
  {
    id: 'carlos', nombre: 'Carlos · fuerza lineal 5×5, sin RPE',
    perfil: '3 días. Sentadilla 5×5 con los valores por defecto de la librería (escalón de 5 kg).',
    ejercicio: 'squat_barbell', config: doble(5, 5, 5), pesoInicial: 80,
    sesiones: [
      { reps: [5, 5, 5, 5, 5] },
      { reps: [5, 5, 5, 5, 5] },
      { reps: [5, 5, 5, 5, 5] },
      { reps: [5, 5, 5, 4, 4], nota: 'Fallo leve: las dos últimas a 4' },
      { reps: [5, 5, 5, 5, 4] },
      { reps: [5, 5, 4, 4, 4], nota: 'Fallo más claro' },
      { reps: [5, 4, 4, 3, 3], nota: 'Segundo fallo seguido' },
      { reps: 'gris' },
      { reps: [3, 3, 2, 2, 2], nota: 'Fallo grande' },
      { reps: 'gris' },
    ],
  },
  {
    id: 'javi', nombre: 'Javi · fuerza autorregulada (RPE)',
    perfil: '4-5 días, compite. Sentadilla 3×5 @RPE 8 por esfuerzo.',
    ejercicio: 'squat_barbell',
    config: { sets: 3, minReps: 5, maxReps: 5, progression: { type: 'effort', targetRpe: 8 } }, pesoInicial: 140,
    sesiones: [
      { reps: [5, 5, 5], rpe: [8, 8, 8.5] },
      { reps: [5, 5, 5], rpe: [7, 7.5, 8], nota: 'Le sale fácil' },
      { reps: [5, 5, 5], rpe: [8, 8, 8] },
      { reps: [5, 5, 4], rpe: [9, 9.5, 10], nota: 'Día malo' },
      { reps: [5, 5, 5], rpe: [8, 8, 8] },
      { reps: [5, 5, 5], rpe: ['', '', ''], nota: 'Se olvida de apuntar el RPE' },
      { reps: [5, 5, 5], rpe: [7, 7, 7.5] },
    ],
  },
  {
    id: 'elena', nombre: 'Elena · hipertrofia con «RPE máx. 8»',
    perfil: '5 días, avanzada. Press banca 3×8-12: sube si llega arriba sin pasar de RPE 8 de media.',
    ejercicio: 'bench_press_barbell',
    config: doble(3, 8, 12, { evaluation: { mode: 'rpe', maxRpe: 8 }, increment: { type: 'fixed', value: 2.5 } }), pesoInicial: 60,
    sesiones: [
      { reps: [12, 12, 12], rpe: [7, 8, 8.5] },
      { reps: [10, 10, 9], rpe: [8, 8, 9] },
      { reps: [12, 12, 12], rpe: [8, 9, 9.5], nota: 'Llega a 12 pero muy dura' },
      { reps: [12, 12, 12], rpe: [8, '', ''], nota: 'Solo apunta el RPE en la primera serie' },
      { reps: [14, 13, 12], rpe: [7, 7, 7], nota: 'Se pasa del rango con RPE bajo' },
      { reps: 'gris', rpe: [8, 8, 8] },
    ],
  },
  {
    id: 'pilar', nombre: 'Pilar · vuelve de una lesión (asistida)',
    perfil: '2 días. Dominada asistida 3×5-8: progresar es quitar ayuda (empieza con 30 kg de ayuda).',
    ejercicio: 'pull_up_assisted', config: doble(3, 5, 8), pesoInicial: 30,
    sesiones: [
      { reps: [8, 7, 6] },
      { reps: [8, 8, 8] },
      { reps: [7, 6, 5], nota: 'Con menos ayuda le cuesta' },
      { reps: [6, 4, 4], nota: 'Día malo' },
      { reps: 'gris' },
      { reps: [8, 8, 8] },
    ],
  },
  {
    id: 'pilar-plancha', nombre: 'Pilar · plancha por tiempo',
    perfil: 'Plancha 3 series, «Tiempo» empezando en 30 s.',
    ejercicio: 'plank',
    config: { sets: 3, minTime: 30, maxTime: 30, inputType: 'time', progression: { type: 'time' } },
    tiempo: true,
    sesiones: [
      { tiempos: [45, 40, 30] },
      { tiempos: [50, 45, 35] },
      { tiempos: [60, 45, 25], nota: 'La última se le cae' },
      { tiempos: 'gris' },
    ],
  },
  {
    id: 'sergio', nombre: 'Sergio · dominadas por reps (peso corporal)',
    perfil: 'Dominadas 3 series, «Reps» empezando en 6.',
    ejercicio: 'pull_up', config: { sets: 3, minReps: 6, maxReps: 6, progression: { type: 'reps' } }, pesoInicial: 0,
    sesiones: [
      { reps: [8, 7, 6] },
      { reps: [12, 12, 7], nota: 'Dos series muy buenas y una floja' },
      { reps: 'gris' },
      { reps: [10, 9, 8] },
      { reps: [7, 5, 4], nota: 'Día malo' },
      { reps: 'gris' },
      { reps: [15, 14, 13], nota: '¿Cuándo le toca lastrarse?' },
    ],
  },
];
